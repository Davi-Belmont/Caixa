import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { createTransactionSchema } from '../schemas/transactionSchema.js';
import { z } from 'zod';

export const transactionRegistry = new OpenAPIRegistry();

transactionRegistry.register('Transaction', createTransactionSchema);

transactionRegistry.registerPath({
  method: 'post',
  path: '/transactions',
  summary: 'Criar uma nova transação financeira',
  tags: ['Transactions'],
  security: [{ bearerAuth: [] }], // <- Exige autenticação no Swagger
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Transaction' },
        },
      },
    },
  },
  responses: {
    201: { description: 'Transação criada com sucesso' },
    400: { description: 'Erro de validação nos dados enviados' },
    401: { description: 'Não autorizado' },
  },
});

transactionRegistry.registerPath({
  method: 'get',
  path: '/transactions',
  summary: 'Listar todas as transações do utilizador',
  tags: ['Transactions'],
  security: [{ bearerAuth: [] }], // <- Exige autenticação no Swagger
  responses: {
    200: { description: 'Lista de transações retornada com sucesso' },
    401: { description: 'Não autorizado' },
  },
});