import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const createStockSchema = z.object({
  ticker: z
    .string()
    .min(3, 'O ticker é obrigatório')
    .openapi({ example: "PETR4.SA" }),

  quantity: z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .positive('A quantidade deve ser maior que zero')
    .openapi({ example: 100 }),

  averagePrice: z
    .number()
    .positive('O preço médio deve ser maior que zero')
    .openapi({ example: 35.50 }),

  userId: z.string().uuid('ID de usuário inválido').openapi({ example: "3fa85f64-5717-4562-b3fc-2c963f66afa6" }),
}).openapi('Stock');

export type CreateStockDTO = z.infer<typeof createStockSchema>;