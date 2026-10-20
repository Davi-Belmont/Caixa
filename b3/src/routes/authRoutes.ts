import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';


const router = Router();
const authController = new AuthController();

router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.get('/me', ensureAuthenticated, authController.me);

export const authRoutes = router;