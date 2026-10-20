import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../config/prisma.js';
import { createDividendSchema, updateDividendSchema } from '../schemas/dividendSchema.js';

export class DividendController {
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const dividends = await prisma.dividend.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      });
      return res.json(dividends);
    } catch (error) {
      console.error('ERRO AO LISTAR PROVENTOS:', error);
      return res.status(500).json({ error: 'Erro ao listar proventos' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = createDividendSchema.parse(req.body);

      const dividend = await prisma.dividend.create({
        data: {
          ...data,
          userId,
        },
      });

      return res.status(201).json({
        message: 'Provento registado com sucesso! 💰',
        dividend,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      console.error('ERRO AO CRIAR PROVENTO:', error);
      return res.status(500).json({ error: 'Erro interno ao criar provento' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const dividendExists = await prisma.dividend.findFirst({
        where: { id: String(id), userId },
      });

      if (!dividendExists) {
        return res.status(404).json({ error: 'Provento não encontrado' });
      }

      await prisma.dividend.delete({
        where: { id: String(id) },
      });

      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO APAGAR PROVENTO:', error);
      return res.status(500).json({ error: 'Erro ao apagar provento' });
    }
  }
}