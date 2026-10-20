import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export const dashboardRegistry = new OpenAPIRegistry();

dashboardRegistry.registerPath({
  method: 'get',
  path: '/dashboard',
  summary: 'Obter resumo financeiro consolidado (Dashboard)',
  description: 'Retorna o saldo total, receitas, despesas (separadas por categoria), contas pendentes e investimentos do utilizador autenticado.',
  tags: ['Dashboard'],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      startDate: z.string().optional().openapi({ example: '2026-10-01', description: 'Data inicial para filtro (YYYY-MM-DD)' }),
      endDate: z.string().optional().openapi({ example: '2026-10-31', description: 'Data final para filtro (YYYY-MM-DD)' }),
    }),
  },
  responses: {
    200: {
      description: 'Resumo financeiro gerado com sucesso',
      content: {
        'application/json': {
          schema: z.object({
            period: z.object({
              startDate: z.string().nullable(),
              endDate: z.string().nullable(),
            }),
            summary: z.object({
              totalIncome: z.number(),
              totalExpense: z.number(),
              balance: z.number(),
              totalPendingBills: z.number(),
              totalInvested: z.number(),
            }),
            breakdown: z.object({
              expensesByCategory: z.record(z.string(),z.number()),
              incomeByCategory: z.record(z.string(),z.number()),
            }),
            details: z.object({
              transactionsCount: z.number(),
              pendingBillsCount: z.number(),
              goalsCount: z.number(),
              stocksCount: z.number(),
            }),
          }),
        },
      },
    },
    401: { description: 'Não autorizado (Token JWT ausente ou inválido)' },
    500: { description: 'Erro interno do servidor' },
  },
});