import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../config/prisma.js';
import { createGoalContributionSchema } from '../schemas/goalContributionSchema.js';

export class GoalContributionController {
  // Listar aportes de uma meta específica
  async listByGoal(req: Request, res: Response) {
    try {
      const { goalId } = req.params;
      const userId = req.user!.id;

      // Verificar se a meta pertence ao utilizador
      const goalExists = await prisma.goal.findFirst({
        where: { id: String(goalId), userId },
      });

      if (!goalExists) {
        return res.status(404).json({ error: 'Meta não encontrada' });
      }

      const contributions = await prisma.goalContribution.findMany({
        where: { goalId: String(goalId), userId },
        orderBy: { date: 'desc' },
      });

      return res.json(contributions);
    } catch (error) {
      console.error('ERRO AO LISTAR APORTES:', error);
      return res.status(500).json({ error: 'Erro ao listar aportes da meta' });
    }
  }

  // Criar um novo aporte e atualizar o progresso da meta
  async create(req: Request, res: Response) {
    try {
      const { goalId } = req.params;
      const userId = req.user!.id;
      const data = createGoalContributionSchema.parse(req.body);

      // Verificar se a meta existe e pertence ao utilizador
      const goalExists = await prisma.goal.findFirst({
        where: { id: String(goalId), userId },
      });

      if (!goalExists) {
        return res.status(404).json({ error: 'Meta não encontrada' });
      }

      // Transação para garantir consistência: cria o aporte e incrementa a meta em simultâneo
        const [contribution, updatedGoal] = await prisma.$transaction([
        prisma.goalContribution.create({
          data: {
            amount: data.amount,
            date: data.date ?? new Date(),
            ...(data.note !== undefined && { note: data.note }),
            goalId: String(goalId),
            userId,
          },
        }),
        prisma.goal.update({
          where: { id: String(goalId) },
          data: {
            currentAmount: {
              increment: data.amount,
            },
          },
        }),
      ]);

      return res.status(201).json({
        message: 'Aporte registado com sucesso! 🎯💰',
        contribution,
        updatedGoal,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      console.error('ERRO AO CRIAR APORTE:', error);
      return res.status(500).json({ error: 'Erro interno ao criar aporte' });
    }
  }

  // Apagar um aporte e decrementar o valor da meta
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const contribution = await prisma.goalContribution.findFirst({
        where: { id: String(id), userId },
      });

      if (!contribution) {
        return res.status(404).json({ error: 'Aporte não encontrado' });
      }

      // Apagar o aporte e decrementar o currentAmount da meta
      await prisma.$transaction([
        prisma.goal.update({
          where: { id: contribution.goalId },
          data: {
            currentAmount: {
              decrement: contribution.amount.toNumber(),
            },
          },
        }),
        prisma.goalContribution.delete({
          where: { id: String(id) },
        }),
      ]);

      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO APAGAR APORTE:', error);
      return res.status(500).json({ error: 'Erro ao apagar aporte' });
    }
  }
}