import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { createGoalSchema } from '../schemas/goalSchema.js';

export const goalRegistry = new OpenAPIRegistry();

// Regista o schema diretamente
goalRegistry.register('Goal', createGoalSchema);

goalRegistry.registerPath({
  method: 'post',
  path: '/goals',
  summary: 'Criar uma nova meta financeira',
  tags: ['Goals'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Goal' },
        },
      },
    },
  },
  responses: {
    201: { description: 'Meta criada com sucesso' },
    400: { description: 'Erro de validação nos dados enviados' },
    401: { description: 'Não autorizado' },
  },
});

goalRegistry.registerPath({
  method: 'get',
  path: '/goals',
  summary: 'Listar todas as metas do utilizador',
  tags: ['Goals'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Lista de metas retornada com sucesso' },
    401: { description: 'Não autorizado' },
  },
});