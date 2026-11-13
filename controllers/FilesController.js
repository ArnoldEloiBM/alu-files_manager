import { promises as fs } from 'fs';
import path from 'path';
import mime from 'mime-types';
import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import AuthController from './AuthController';

const VALID_TYPES = ['folder', 'file', 'image'];
const PAGE_SIZE = 20;

function storageDirectory() {
  const folder = process.env.FOLDER_PATH;
  if (!folder) {
    return '/tmp/files_manager';
  }
  return folder;
}

function parseId(id) {
  try {
    return new ObjectID(id);
  } catch (error) {
    return null;
  }
}

function isRootParent(parentId) {
  return parentId === undefined
    || parentId === null
    || parentId === ''
    || parentId === 0
    || parentId === '0';
}

function formatParentId(parentId) {
  if (isRootParent(parentId)) {
    return 0;
  }
  return parentId.toString();
}

function serializeFile(file) {
  return {
    id: file._id.toString(),
    userId: file.userId.toString(),
    name: file.name,
    type: file.type,
    isPublic: !!file.isPublic,
    parentId: formatParentId(file.parentId),
  };
}

class FilesController {
  static async postUpload(req, res) {
    const user = await AuthController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const body = req.body || {};
    const { name, type, data } = body;
    const isPublic = body.isPublic === undefined ? false : body.isPublic;
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const files = await dbClient.collection('files');
    let storedParentId = 0;
    const rawParent = body.parentId;
    if (!isRootParent(rawParent)) {
      const parentObjectId = parseId(rawParent);
      if (!parentObjectId) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      const parent = await files.findOne({ _id: parentObjectId });
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
      storedParentId = parentObjectId;
    }

    const fileDocument = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: storedParentId,
    };

    if (type !== 'folder') {
      const directory = path.resolve(storageDirectory());
      const localPath = path.join(directory, uuidv4());
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(localPath, Buffer.from(data, 'base64'));
      fileDocument.localPath = localPath;
    }

    const result = await files.insertOne(fileDocument);
    return res.status(201).json(serializeFile({
      _id: result.insertedId,
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: storedParentId,
    }));
  }

  static async getShow(req, res) {
    const user = await AuthController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const objectId = parseId(req.params.id);
    if (!objectId) {
      return res.status(404).json({ error: 'Not found' });
    }
    const files = await dbClient.collection('files');
    const file = await files.findOne({ _id: objectId, userId: user._id });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(serializeFile(file));
  }

  static async getIndex(req, res) {
    const user = await AuthController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const rawPage = req.query.page || 0;
    const page = Number.parseInt(rawPage, 10);
    const safePage = Number.isNaN(page) || page < 0 ? 0 : page;
    const rawParent = req.query.parentId;
    let parentMatch;
    if (isRootParent(rawParent)) {
      parentMatch = { $in: [0, '0'] };
    } else {
      const parentObjectId = parseId(rawParent);
      if (!parentObjectId) {
        return res.status(200).json([]);
      }
      parentMatch = parentObjectId;
    }
    const files = await dbClient.collection('files');
    const docs = await files.aggregate([
      { $match: { userId: user._id, parentId: parentMatch } },
      { $sort: { _id: 1 } },
      { $skip: safePage * PAGE_SIZE },
      { $limit: PAGE_SIZE },
    ]).toArray();
    return res.status(200).json(docs.map((file) => serializeFile(file)));
  }

  static async setPublic(req, res, isPublic) {
    const user = await AuthController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const objectId = parseId(req.params.id);
    if (!objectId) {
      return res.status(404).json({ error: 'Not found' });
    }
    const files = await dbClient.collection('files');
    const result = await files.findOneAndUpdate(
      { _id: objectId, userId: user._id },
      { $set: { isPublic } },
      { returnOriginal: false },
    );
    if (!result || !result.value) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(serializeFile(result.value));
  }

  static putPublish(req, res) {
    return FilesController.setPublic(req, res, true);
  }

  static putUnpublish(req, res) {
    return FilesController.setPublic(req, res, false);
  }

  static async getFile(req, res) {
    const objectId = parseId(req.params.id);
    if (!objectId) {
      return res.status(404).json({ error: 'Not found' });
    }
    const files = await dbClient.collection('files');
    const file = await files.findOne({ _id: objectId });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!file.isPublic) {
      const user = await AuthController.getUser(req);
      if (!user || file.userId.toString() !== user._id.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }
    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }
    if (!file.localPath) {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      const data = await fs.readFile(file.localPath);
      const mimeType = mime.contentType(file.name) || 'application/octet-stream';
      return res.status(200).set('Content-Type', mimeType).send(data);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
