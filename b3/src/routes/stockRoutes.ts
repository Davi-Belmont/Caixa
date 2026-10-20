import { Router } from 'express';
import { StockController } from '../controllers/stockController.js';
import { ensureAuthenticated } from '../middlewares/authMiddleware.js';

const stockRoutes = Router();
const stockController = new StockController();

// Aplica o middleware de autenticação a todas as rotas de stocks
stockRoutes.use(ensureAuthenticated);

// 1. Rotas estáticas e específicas primeiro (para evitar conflitos com parâmetros)
stockRoutes.get('/', stockController.listByUser);
stockRoutes.post('/', stockController.create);
stockRoutes.get('/catalog', stockController.catalog);
stockRoutes.get('/search/:ticker', stockController.searchTicker);

// Rota de cotações em lote
stockRoutes.get('/quotes', stockController.getQuotesBatch);

// 2. Rotas dinâmicas com parâmetros a seguir
stockRoutes.get('/:ticker/history', stockController.getHistory);
stockRoutes.put('/:id', stockController.update);
stockRoutes.delete('/:id', stockController.delete);

export { stockRoutes };