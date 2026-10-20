import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const budgetRegistry = new OpenAPIRegistry();

budgetRegistry.registerPath({
  method: 'get',
  path: '/budgets',
  tags: ['Orçamentos'],
  summary: 'Listar orçamentos mensais do usuário',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Lista de orçamentos retornada com sucesso',
    },
  },
});

budgetRegistry.registerPath({
  method: 'post',
  path: '/budgets',
  tags: ['Orçamentos'],
  summary: 'Criar ou atualizar orçamento por categoria/mês',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            month: z.string(),
            category: z.string(),
            limit: z.number(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Orçamento guardado com sucesso',
    },
  },
});