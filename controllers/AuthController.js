import { ObjectID } from 'mongodb';
import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const TOKEN_TTL = 60 * 60 * 24;

class AuthController {
  static async getUser(req) {
    const token = req.header('X-Token');
    if (!token) {
      return null;
    }
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return null;
    }
    let objectId;
    try {
      objectId = new ObjectID(userId);
    } catch (error) {
      return null;
    }
    const users = await dbClient.collection('users');
    const user = await users.findOne({ _id: objectId });
    return user || null;
  }

  static async getConnect(req, res) {
    const header = req.header('Authorization') || '';
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Basic') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    let decoded = '';
    try {
      decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const separator = decoded.indexOf(':');
    if (separator < 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const email = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const users = await dbClient.collection('users');
    const user = await users.findOne({ email, password: sha1(password) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), TOKEN_TTL);
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const user = await AuthController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = req.header('X-Token');
    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}

export default AuthController;
