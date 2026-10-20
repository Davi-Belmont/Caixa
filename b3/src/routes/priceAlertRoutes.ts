import { Router } from 'express';
import { PriceAlertController } from '../controllers/priceAlertController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const priceAlertRoutes = Router();
const priceAlertController = new PriceAlertController();

priceAlertRoutes.use(ensureAuthenticated);

priceAlertRoutes.get('/', priceAlertController.list);
priceAlertRoutes.post('/check', priceAlertController.checkAlerts);
priceAlertRoutes.post('/', priceAlertController.create);
priceAlertRoutes.put('/:id', priceAlertController.update);
priceAlertRoutes.delete('/:id', priceAlertController.delete);

export { priceAlertRoutes };