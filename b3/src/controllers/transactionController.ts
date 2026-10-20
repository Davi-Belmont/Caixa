import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../config/prisma.js';
import { createTransactionSchema, updateTransactionSchema } from '../schemas/transactionSchema.js';

export class TransactionController {
  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = createTransactionSchema.parse(req.body);

      const transaction = await prisma.transaction.create({
        data: {
          description: data.description,
          value: data.value,
          type: data.type,
          category: data.category,
          date: new Date(data.date), // Converte para o DateTime do Prisma
          userId,
        },
      });

      return res.status(201).json({
        message: 'Transação criada com sucesso! 💸',
        transaction,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      console.error('ERRO DETALHADO AO CRIAR TRANSAÇÃO:', error);
      return res.status(500).json({ error: 'Erro interno ao criar transação' });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { from, to, type, category } = req.query;

      const page = Math.max(Number(req.query.page) || 1, 1);
      // Padrão 10 por página; o cliente pode pedir até 500
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 500);
      const skip = (page - 1) * limit;

      // Filtros opcionais: ?from=2026-10-01&to=2026-10-31&type=out&category=Moradia
      const where: any = { userId };
      if (type) where.type = String(type);
      if (category) where.category = String(category);

      if (from || to) {
        where.date = {};
        if (from) {
          const start = new Date(String(from));
          if (Number.isNaN(start.getTime())) return res.status(400).json({ error: 'Parâmetro "from" inválido' });
          where.date.gte = start;
        }
        if (to) {
          const end = new Date(String(to));
          if (Number.isNaN(end.getTime())) return res.status(400).json({ error: 'Parâmetro "to" inválido' });
          end.setUTCHours(23, 59, 59, 999); // inclui o dia inteiro informado
          where.date.lte = end;
        }
      }

      const [transactions, total] = await prisma.$transaction([
        prisma.transaction.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: limit,
        }),
        prisma.transaction.count({ where }),
      ]);

      return res.json({
        data: transactions,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('ERRO AO LISTAR TRANSAÇÕES:', error);
      return res.status(500).json({ error: 'Erro interno ao listar transações' });
    }
  }

  // Atualizar transação existente
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { description, value, type, category, date } = req.body;

      const transactionExists = await prisma.transaction.findFirst({
        where: { id: String(id), userId }
      });

      if (!transactionExists) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }

      const updatedTransaction = await prisma.transaction.update({
        where: { id: String(id) },
        data: {
          ...(description !== undefined && { description }),
          ...(value !== undefined && { value }),
          ...(type !== undefined && { type }),
          ...(category !== undefined && { category }),
          ...(date !== undefined && { date: new Date(date) }),
        },
      });

      return res.json(updatedTransaction);
    } catch (error) {
      console.error('ERRO AO ATUALIZAR TRANSAÇÃO:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar transação' });
    }
  }

  // Excluir transação
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const transactionExists = await prisma.transaction.findFirst({
        where: { id: String(id), userId }
      });

      if (!transactionExists) {
        return res.status(404).json({ error: 'Transação não encontrada' });
      }

      await prisma.transaction.delete({
        where: { id: String(id) }
      });

      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO REMOVER TRANSAÇÃO:', error);
      return res.status(500).json({ error: 'Erro ao remover transação' });
    }
  }
}