import { z } from 'zod';

export const createGoalContributionSchema = z.object({
  amount: z.number().refine((val) => val !== 0, {
    message: 'O valor do aporte ou retirada não pode ser zero.',
  }),
  date: z.coerce.date().optional(),
  note: z.string().optional(),
});