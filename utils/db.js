import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    this.dbName = process.env.DB_DATABASE || 'files_manager';
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    this.db = null;
    this.connected = false;
    this.ready = this.client.connect()
      .then(() => {
        this.db = this.client.db(this.dbName);
        this.connected = true;
        return this.db;
      })
      .catch((error) => {
        this.connected = false;
        console.log(error);
        return null;
      });
  }

  isAlive() {
    if (typeof this.client.isConnected === 'function') {
      return this.client.isConnected();
    }
    return this.connected;
  }

  async collection(name) {
    await this.ready;
    if (!this.isAlive()) {
      throw new Error('DB not connected');
    }
    if (!this.db) {
      this.db = this.client.db(this.dbName);
    }
    return this.db.collection(name);
  }

  async nbUsers() {
    const users = await this.collection('users');
    const count = await users.countDocuments();
    return count;
  }

  async nbFiles() {
    const files = await this.collection('files');
    const count = await files.countDocuments();
    return count;
  }
}

const dbClient = new DBClient();
export default dbClient;
