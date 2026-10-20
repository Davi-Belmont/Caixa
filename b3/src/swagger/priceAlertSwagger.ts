import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const priceAlertRegistry = new OpenAPIRegistry();

priceAlertRegistry.registerPath({
  method: 'get',
  path: '/price-alerts',
  tags: ['Alertas de Preço'],
  summary: 'Listar alertas de preço do usuário',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Lista de alertas retornada com sucesso',
    },
  },
});

priceAlertRegistry.registerPath({
  method: 'post',
  path: '/price-alerts',
  tags: ['Alertas de Preço'],
  summary: 'Criar alerta de preço',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ticker: z.string(),
            target: z.number(),
            direction: z.enum(['ABOVE', 'BELOW']),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Alerta criado com sucesso',
    },
  },
});

priceAlertRegistry.registerPath({
  method: 'put',
  path: '/price-alerts/{id}',
  tags: ['Alertas de Preço'],
  summary: 'Atualizar ou rearmar alerta de preço',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            target: z.number().optional(),
            direction: z.enum(['ABOVE', 'BELOW']).optional(),
            hit: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Alerta atualizado com sucesso',
    },
  },
});

priceAlertRegistry.registerPath({
  method: 'delete',
  path: '/price-alerts/{id}',
  tags: ['Alertas de Preço'],
  summary: 'Remover alerta de preço',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: {
    204: {
      description: 'Alerta removido com sucesso',
    },
  },
});