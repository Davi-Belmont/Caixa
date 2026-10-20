import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../config/prisma.js';
import { createGoalSchema, updateGoalSchema } from '../schemas/goalSchema.js';

export class GoalController {
  
// Listar metas do utilizador já com os aportes (contributions) incluídos em lote
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const goals = await prisma.goal.findMany({
        where: { userId },
        include: {
          contributions: {
            orderBy: { date: 'desc' }, // Traz os aportes ordenados do mais recente para o mais antigo
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(goals);
    } catch (error) {
      console.error('ERRO AO LISTAR METAS:', error);
      return res.status(500).json({ error: 'Erro interno ao listar metas' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = createGoalSchema.parse(req.body);

      const goal = await prisma.goal.create({
        data: {
          title: data.title,
          targetAmount: data.targetAmount,
          currentAmount: data.currentAmount ?? 0,
          icon: data.icon ?? '🎯',
          deadline: data.deadline ?? null,
          userId,
        },
      });

      return res.status(201).json({
        message: 'Meta criada com sucesso! 🎯',
        goal,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      return res.status(500).json({ error: 'Erro ao criar a meta.' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { title, targetAmount, currentAmount, icon, deadline } = req.body; // <--- Garantir currentAmount

      const goalExists = await prisma.goal.findFirst({
        where: { id: String(id), userId }
      });

      if (!goalExists) {
        return res.status(404).json({ error: 'Meta não encontrada' });
      }

      const updatedGoal = await prisma.goal.update({
        where: { id: String(id) },
        data: {
          ...(title !== undefined && { title }),
          ...(targetAmount !== undefined && { targetAmount }),
          ...(currentAmount !== undefined && { currentAmount }), 
          ...(icon !== undefined && { icon }),
          ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        },
      });

      return res.json(updatedGoal);
    } catch (error) {
      console.error('ERRO AO ATUALIZAR META:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar meta' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const goalExists = await prisma.goal.findFirst({
        where: { id: String(id), userId },
      });

      if (!goalExists) {
        return res.status(404).json({ error: 'Meta não encontrada.' });
      }

      await prisma.goal.delete({
        where: { id: String(id) },
      });

      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao apagar a meta.' });
    }
  }
}