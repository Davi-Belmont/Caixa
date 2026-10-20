import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { createBillSchema } from '../schemas/billSchema.js';

export const billRegistry = new OpenAPIRegistry();

billRegistry.register('Bill', createBillSchema);

// Schema para os parâmetros de rota (ID)
const idParamSchema = z.object({
  id: z.string().openapi({ description: 'ID da conta' }),
});

billRegistry.registerPath({
  method: 'post',
  path: '/bills',
  summary: 'Criar uma nova conta a pagar ou receber',
  tags: ['Bills'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Bill' },
        },
      },
    },
  },
  responses: {
    201: { description: 'Conta criada com sucesso' },
    400: { description: 'Erro de validação nos dados' },
    401: { description: 'Não autorizado' },
  },
});

billRegistry.registerPath({
  method: 'get',
  path: '/bills',
  summary: 'Listar todas as contas do utilizador',
  tags: ['Bills'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Lista de contas retornada com sucesso' },
    401: { description: 'Não autorizado' },
  },
});

billRegistry.registerPath({
  method: 'put',
  path: '/bills/{id}',
  summary: 'Atualizar uma conta existente',
  tags: ['Bills'],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema, // <- Usamos o schema Zod aqui em vez de um objeto solto
    body: {
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Bill' },
        },
      },
    },
  },
  responses: {
    200: { description: 'Conta atualizada com sucesso' },
    404: { description: 'Conta não encontrada' },
    401: { description: 'Não autorizado' },
  },
});

billRegistry.registerPath({
  method: 'delete',
  path: '/bills/{id}',
  summary: 'Eliminar uma conta',
  tags: ['Bills'],
  security: [{ bearerAuth: [] }],
  request: {
    params: idParamSchema, 
  },
  responses: {
    204: { description: 'Conta eliminada com sucesso' },
    404: { description: 'Conta não encontrada' },
    401: { description: 'Não autorizado' },
  },
});