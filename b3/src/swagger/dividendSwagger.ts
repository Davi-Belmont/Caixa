import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const dividendRegistry = new OpenAPIRegistry();

// Exemplo de schema Zod com anotação OpenAPI para Proventos
const dividendSchema = dividendRegistry.register(
  'Dividend',
  z.object({
    id: z.string(),
    ticker: z.string(),
    amount: z.number(),
    date: z.string(),
    userId: z.string(),
  })
);

dividendRegistry.registerPath({
  method: 'get',
  path: '/dividends',
  tags: ['Proventos'],
  summary: 'Listar proventos do usuário',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Lista de proventos retornada com sucesso',
    },
  },
});

dividendRegistry.registerPath({
  method: 'post',
  path: '/dividends',
  tags: ['Proventos'],
  summary: 'Registar novo provento',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ticker: z.string(),
            amount: z.number(),
            date: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Provento criado com sucesso',
    },
  },
});