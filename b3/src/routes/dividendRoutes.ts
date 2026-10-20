import { Router } from 'express';
import { DividendController } from '../controllers/dividendController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const dividendRoutes = Router();
const dividendController = new DividendController();

dividendRoutes.use(ensureAuthenticated);

dividendRoutes.get('/', dividendController.list);
dividendRoutes.post('/', dividendController.create);
dividendRoutes.delete('/:id', dividendController.delete);

export { dividendRoutes };