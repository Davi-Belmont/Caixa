import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const userRoutes = Router();
const userController = new UserController();

userRoutes.use(ensureAuthenticated);

userRoutes.get('/config', userController.getConfig);
userRoutes.put('/config', userController.updateConfig);

export { userRoutes };
