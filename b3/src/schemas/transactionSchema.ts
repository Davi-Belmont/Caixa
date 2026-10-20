import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const createTransactionSchema = z.object({
  description: z.string().min(1, 'A descrição é obrigatória'),
  value: z.number().positive('O valor deve ser maior que zero'),
  type: z.enum(['in', 'out'], { message: 'O tipo deve ser "in" (receita) ou "out" (despesa)' })
    .openapi({ example: "in" }),
  category: z.string().min(1, 'A categoria é obrigatória'),
  date: z.coerce.date()
    .optional()
    .default(() => new Date())
    .openapi({ example: "2026-10-12T00:00:00.000Z" }),
});

// Sem .partial(): no Zod 4 ele manteria o default de `date` e um PUT sem data mudaria a data para "agora".
export const updateTransactionSchema = z.object({
  description: z.string().min(1, 'A descrição é obrigatória').optional(),
  value: z.number().positive('O valor deve ser maior que zero').optional(),
  type: z.enum(['in', 'out'], { message: 'O tipo deve ser "in" (receita) ou "out" (despesa)' }).optional(),
  category: z.string().min(1, 'A categoria é obrigatória').optional(),
  date: z.coerce.date().optional(),
});

export type CreateTransactionDTO = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionDTO = z.infer<typeof updateTransactionSchema>;