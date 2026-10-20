import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const categoryRegistry = new OpenAPIRegistry();

categoryRegistry.registerPath({
  method: 'get',
  path: '/categories',
  tags: ['Categorias'],
  summary: 'Listar categorias personalizadas',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Lista de categorias retornada com sucesso',
    },
  },
});

categoryRegistry.registerPath({
  method: 'post',
  path: '/categories',
  tags: ['Categorias'],
  summary: 'Criar nova categoria personalizada',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            icon: z.string().optional(),
            color: z.string().optional(),
            type: z.enum(['in', 'out', 'INCOME', 'EXPENSE']),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Categoria criada com sucesso',
    },
  },
});

categoryRegistry.registerPath({
  method: 'put',
  path: '/categories/{id}',
  tags: ['Categorias'],
  summary: 'Atualizar categoria existente',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().optional(),
            icon: z.string().optional(),
            color: z.string().optional(),
            type: z.enum(['in', 'out', 'INCOME', 'EXPENSE']).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Categoria atualizada com sucesso',
    },
  },
});

categoryRegistry.registerPath({
  method: 'delete',
  path: '/categories/{id}',
  tags: ['Categorias'],
  summary: 'Remover categoria',
  security: [{ bearerAuth: [] }],
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
  responses: {
    204: {
      description: 'Categoria removida com sucesso',
    },
  },
});