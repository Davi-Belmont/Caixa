import { z } from 'zod';

export const createBillSchema = z.object({
  title: z.string().min(1, 'O título é obrigatório'),
  amount: z.number().positive('O valor deve ser positivo'),
  dueDate: z.string().or(z.date()).transform((val) => new Date(val)),
  type: z.string().min(1, 'O tipo é obrigatório'), // 'PAYABLE' ou 'RECEIVABLE'
  category: z.string().optional(),
  recurrence: z.string().optional(),
  installments: z.number().int().optional(),
  currentInstallment: z.number().int().optional(),
  barcode: z.string().optional(),
});

export const updateBillSchema = createBillSchema.partial().extend({
  isPaid: z.boolean().optional(),
  paidAt: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  paidAmount: z.number().positive().optional(),
});