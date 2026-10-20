import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const stockOperationRegistry = new OpenAPIRegistry();

stockOperationRegistry.registerPath({
  method: 'get',
  path: '/stock-operations',
  tags: ['Operações de Ações'],
  summary: 'Listar histórico de operações de compra e venda',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Histórico de operações retornado com sucesso',
    },
  },
});

stockOperationRegistry.registerPath({
  method: 'post',
  path: '/stock-operations',
  tags: ['Operações de Ações'],
  summary: 'Registar nova operação na carteira (Compra/Venda)',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            ticker: z.string(),
            type: z.enum(['BUY', 'SELL']),
            quantity: z.number(),
            price: z.number(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Operação registada com sucesso',
    },
  },
});

stockOperationRegistry.registerPath({
  method: 'put',
  path: '/stock-operations/{id}',
  tags: ['Operações de Ações'],
  summary: 'Corrigir uma operação (quantidade, preço e/ou data)',
  description:
    'Recalcula a posição da carteira, o lucro realizado das vendas e a receita lançada nas transações. ' +
    'Recusa alterações que deixariam a posição negativa.',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            quantity: z.number().optional(),
            price: z.number().optional(),
            date: z.string().optional(),
            launch: z.boolean().optional().openapi({ description: 'Liga/desliga o lançamento nas transações (receita da venda / despesa da compra).' }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: 'Operação atualizada: { operation, transaction, deletedTransactionId, affected, stock }' },
    400: { description: 'Dados inválidos ou alteração que deixaria a posição negativa' },
    404: { description: 'Operação não encontrada' },
  },
});
