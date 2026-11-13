import sha1 from 'sha1';
import dbClient from '../utils/db';
import AuthController from './AuthController';

class UsersController {
  static async postNew(req, res) {
    const body = req.body || {};
    const { email, password } = body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const users = await dbClient.collection('users');
    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const hashedPassword = sha1(password);
    const result = await users.insertOne({
      email,
      password: hashedPassword,
    });
    return res.status(201).json({
      id: result.insertedId.toString(),
      email,
    });
  }

  static async getMe(req, res) {
    const user = await AuthController.getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
    });
  }
}

export default UsersController;
