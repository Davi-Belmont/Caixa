import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const createGoalSchema = z.object({
  title: z.string().min(1, 'O título da meta é obrigatório.'),
  targetAmount: z.number().positive('O valor alvo deve ser superior a zero.'),
  currentAmount: z.number().nonnegative('O valor atual não pode ser negativo.').optional().default(0),
  icon: z.string().optional().default('🎯'),
  deadline: z.coerce.date().optional().nullable(),
});

// Atenção: NÃO usar createGoalSchema.partial() aqui. No Zod 4 o .partial() mantém os .default(),
// então um PUT sem currentAmount/icon zerava o progresso da meta e trocava o ícone para 🎯.
export const updateGoalSchema = z.object({
  title: z.string().min(1, 'O título da meta é obrigatório.').optional(),
  targetAmount: z.number().positive('O valor alvo deve ser superior a zero.').optional(),
  currentAmount: z.number().nonnegative('O valor atual não pode ser negativo.').optional(),
  icon: z.string().optional(),
  deadline: z.coerce.date().optional().nullable(),
});

export type CreateGoalDto = z.infer<typeof createGoalSchema>;
export type UpdateGoalDto = z.infer<typeof updateGoalSchema>;