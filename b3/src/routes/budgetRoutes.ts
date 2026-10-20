import { Router } from 'express';
import { BudgetController } from '../controllers/budgetController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const budgetRoutes = Router();
const budgetController = new BudgetController();

budgetRoutes.use(ensureAuthenticated);

budgetRoutes.get('/', budgetController.list);
budgetRoutes.post('/', budgetController.upsert);
budgetRoutes.delete('/:id', budgetController.delete);

export { budgetRoutes };