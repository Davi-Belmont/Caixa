import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const dashboardRoutes = Router();
const dashboardController = new DashboardController();

dashboardRoutes.use(ensureAuthenticated);
dashboardRoutes.get('/', dashboardController.getSummary);

export { dashboardRoutes };