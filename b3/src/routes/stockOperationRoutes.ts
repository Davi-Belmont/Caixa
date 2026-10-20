import { Router } from 'express';
import { StockOperationController } from '../controllers/stockOperationController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const stockOperationRoutes = Router();
const stockOperationController = new StockOperationController();

stockOperationRoutes.use(ensureAuthenticated);

stockOperationRoutes.get('/', stockOperationController.list);
stockOperationRoutes.post('/', stockOperationController.create);
stockOperationRoutes.put('/:id', stockOperationController.update);
stockOperationRoutes.delete('/:id', stockOperationController.delete);

export { stockOperationRoutes };