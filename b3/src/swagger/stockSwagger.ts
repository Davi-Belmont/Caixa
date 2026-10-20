import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { createStockSchema } from '../schemas/stockSchema.js';
import { z } from 'zod';

export const stockRegistry = new OpenAPIRegistry();

stockRegistry.register('Stock', createStockSchema);

stockRegistry.registerPath({
  method: 'post',
  path: '/stocks',
  summary: 'Registar um novo ativo (ação/FII) na carteira',
  tags: ['Stocks'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Stock' },
        },
      },
    },
  },
  responses: {
    201: { description: 'Ativo registado com sucesso' },
    400: { description: 'Erro de validação ou utilizador não encontrado' },
  },
});

stockRegistry.registerPath({
  method: 'get',
  path: '/stocks',
  summary: 'Listar ativos do utilizador com cotação atual em tempo real',
  tags: ['Stocks'],
  request: {
    query: z.object({
      userId: z.string().uuid().openapi({
        description: 'UUID do utilizador',
        example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      }),
    }),
  },
  responses: {
    200: { description: 'Lista de ativos enriquecida com dados do Yahoo Finance' },
    400: { description: 'Parâmetro userId obrigatório em falta' },
  },
});