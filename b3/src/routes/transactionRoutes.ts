import { Router } from 'express';
import { TransactionController } from '../controllers/transactionController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';
import { validarBody } from '../middlewares/validarSchema.js';
import { createTransactionSchema, updateTransactionSchema } from '../schemas/transactionSchema.js';

const transactionRoutes = Router();
const transactionController = new TransactionController();

transactionRoutes.use(ensureAuthenticated);

transactionRoutes.get('/', transactionController.list);
transactionRoutes.post('/', validarBody(createTransactionSchema), transactionController.create);
transactionRoutes.delete('/:id', ensureAuthenticated, transactionController.delete);
transactionRoutes.put('/:id', ensureAuthenticated, validarBody(updateTransactionSchema), transactionController.update);


export { transactionRoutes };