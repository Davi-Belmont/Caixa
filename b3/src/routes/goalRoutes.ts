import { Router } from 'express';
import { GoalController } from '../controllers/goalController.js';
import { validarBody } from '../middlewares/validarSchema.js';
import { createGoalSchema, updateGoalSchema } from '../schemas/goalSchema.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';
import { GoalContributionController } from '../controllers/goalContributionController.js';



const goalRoutes = Router();
const goalController = new GoalController();
const contributionController = new GoalContributionController();

// Todas as rotas de metas exigem autenticação
goalRoutes.use(ensureAuthenticated);

goalRoutes.get('/', goalController.list);
goalRoutes.post('/', validarBody(createGoalSchema), goalController.create);
goalRoutes.put('/:id', validarBody(updateGoalSchema), goalController.update);
goalRoutes.delete('/:id', goalController.delete);

// Rotas de aportes para uma meta
goalRoutes.get('/:goalId/contributions', contributionController.listByGoal);
goalRoutes.post('/:goalId/contributions', contributionController.create);
goalRoutes.delete('/contributions/:id', contributionController.delete);

export { goalRoutes };