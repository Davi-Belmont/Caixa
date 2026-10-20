import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const categoryRoutes = Router();
const categoryController = new CategoryController();

categoryRoutes.use(ensureAuthenticated);

categoryRoutes.get('/', categoryController.list);
categoryRoutes.post('/', categoryController.create);
categoryRoutes.delete('/:id', categoryController.delete);
categoryRoutes.put('/:id', categoryController.update);

export { categoryRoutes };