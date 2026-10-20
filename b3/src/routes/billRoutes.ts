import { Router } from 'express';
import { BillController } from '../controllers/billController.js';
import { validarBody } from '../middlewares/validarSchema.js';
import { createBillSchema, updateBillSchema } from '../schemas/billSchema.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const billRoutes = Router();
const billController = new BillController();

billRoutes.use(ensureAuthenticated);

billRoutes.get('/', billController.list);
billRoutes.post('/', validarBody(createBillSchema), billController.create);

billRoutes.post('/:id/pay', billController.payBill);

billRoutes.put('/:id', validarBody(updateBillSchema), billController.update);
billRoutes.delete('/:id', billController.delete);

export { billRoutes };