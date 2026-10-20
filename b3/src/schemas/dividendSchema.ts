import { z } from 'zod';

export const createDividendSchema = z.object({
  ticker: z.string().min(1, 'O ticker é obrigatório').transform((val) => val.toUpperCase().trim()),
  type: z.string().min(1, 'O tipo é obrigatório'), // 'DIVIDEND' ou 'JCP'
  amount: z.number().positive('O valor deve ser positivo'),
  date: z.string().or(z.date()).transform((val) => new Date(val)),
});

export const updateDividendSchema = createDividendSchema.partial();