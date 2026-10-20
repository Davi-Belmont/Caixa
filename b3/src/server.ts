import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiDocument } from './swagger/swagger.js';
import { transactionRoutes } from './routes/transactionRoutes.js';
import { stockRoutes } from './routes/stockRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { goalRoutes } from './routes/goalRoutes.js';
import {billRoutes} from './routes/billRoutes.js';
import {dashboardRoutes} from './routes/dashboardRoutes.js';
import { dividendRoutes } from './routes/dividendRoutes.js';
import {budgetRoutes} from './routes/budgetRoutes.js';
import {categoryRoutes} from './routes/categoryRoutes.js'
import {stockOperationRoutes} from './routes/stockOperationRoutes.js';
import {priceAlertRoutes} from './routes/priceAlertRoutes.js';
import { userRoutes } from './routes/userRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Gerando a rota da documentação do Swagger
const swaggerDocument = generateOpenApiDocument();
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Registro das rotas da API
app.use('/transactions', transactionRoutes);
app.use('/stocks',stockRoutes)
app.use('/auth', authRoutes);
app.use('/goals', goalRoutes);
app.use('/bills', billRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/dividends', dividendRoutes);
app.use('/categories', categoryRoutes);
app.use('/budgets', budgetRoutes);
app.use('/stock-operations', stockOperationRoutes);
app.use('/price-alerts', priceAlertRoutes);
app.use('/users', userRoutes);

app.get('/health', (req, res) => {
  return res.json({ status: 'API do Caixa operando com sucesso! 🚀' });
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
  console.log(`Swagger Docs disponível em http://localhost:${PORT}/docs`);
});