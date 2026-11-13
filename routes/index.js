import express from 'express';
import AppController from '../controllers/AppController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';
import UsersController from '../controllers/UsersController';

const router = express.Router();

function asyncRoute(handler) {
  return (req, res) => {
    let result;
    try {
      result = handler(req, res);
    } catch (error) {
      console.log(error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
      return;
    }
    Promise.resolve(result).catch((error) => {
      console.log(error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  };
}

router.get('/status', asyncRoute(AppController.getStatus));
router.get('/stats', asyncRoute(AppController.getStats));

router.post('/users', asyncRoute(UsersController.postNew));
router.get('/connect', asyncRoute(AuthController.getConnect));
router.get('/disconnect', asyncRoute(AuthController.getDisconnect));
router.get('/users/me', asyncRoute(UsersController.getMe));

router.post('/files', asyncRoute(FilesController.postUpload));
router.get('/files/:id/data', asyncRoute(FilesController.getFile));
router.get('/files/:id', asyncRoute(FilesController.getShow));
router.get('/files', asyncRoute(FilesController.getIndex));
router.put('/files/:id/publish', asyncRoute(FilesController.putPublish));
router.put('/files/:id/unpublish', asyncRoute(FilesController.putUnpublish));

export default router;
