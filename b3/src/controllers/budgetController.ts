import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export class BudgetController {
  // Listar orçamentos de um mês (?month=2026-10).
  // Categorias sem limite próprio no mês herdam o do último mês anterior em que tinham um
  // (marcados com `inherited: true`, `inheritedFrom` e um `id` provisório "inherited-…" que não existe no banco).
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const month = String(req.query.month ?? '');

      if (!MONTH_RE.test(month)) {
        return res.status(400).json({ error: 'Informe o mês no formato YYYY-MM (ex.: ?month=2026-10)' });
      }

      const current = await prisma.budget.findMany({
        where: { userId, month },
        include: { category: true },
      });

      const covered = new Set(current.map((b) => b.categoryId));

      // Meses anteriores, do mais recente para o mais antigo: o primeiro de cada categoria é o que vale
      const earlier = await prisma.budget.findMany({
        where: { userId, month: { lt: month } },
        orderBy: { month: 'desc' },
        include: { category: true },
      });

      const inherited = new Map<string, (typeof earlier)[number]>();
      for (const b of earlier) {
        if (!covered.has(b.categoryId) && !inherited.has(b.categoryId)) inherited.set(b.categoryId, b);
      }

      return res.json([
        ...current.map((b) => ({ ...b, inherited: false })),
        ...[...inherited.values()].map((b) => ({
          ...b,
          id: `inherited-${b.categoryId}-${month}`,
          month,
          inherited: true,
          inheritedFrom: b.month,
        })),
      ]);
    } catch (error) {
      console.error('ERRO AO LISTAR ORÇAMENTOS:', error);
      return res.status(500).json({ error: 'Erro interno ao listar orçamentos' });
    }
  }

  // Criar ou atualizar o limite de uma categoria num mês
  async upsert(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { categoryId, month, limitAmount } = req.body ?? {};

      if (!categoryId || !month || limitAmount === undefined) {
        return res.status(400).json({ error: 'categoryId, month e limitAmount são obrigatórios' });
      }
      if (!MONTH_RE.test(String(month))) {
        return res.status(400).json({ error: 'O mês deve estar no formato YYYY-MM' });
      }
      const limit = Number(limitAmount);
      if (!Number.isFinite(limit) || limit < 0) {
        return res.status(400).json({ error: 'O limite deve ser um número maior ou igual a zero' });
      }

      // A categoria precisa ser do usuário
      const category = await prisma.category.findFirst({ where: { id: String(categoryId), userId } });
      if (!category) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      const budget = await prisma.budget.upsert({
        where: { userId_categoryId_month: { userId, categoryId: String(categoryId), month: String(month) } },
        update: { limitAmount: limit },
        create: { userId, categoryId: String(categoryId), month: String(month), limitAmount: limit },
        include: { category: true },
      });

      return res.json({ ...budget, inherited: false });
    } catch (error) {
      console.error('ERRO AO SALVAR ORÇAMENTO:', error);
      return res.status(500).json({ error: 'Erro interno ao salvar orçamento' });
    }
  }

  // Remover orçamento
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      if (String(id).startsWith('inherited-')) {
        return res.status(400).json({
          error: 'Este limite é herdado de um mês anterior e não está salvo neste mês. Salve um novo valor para o mês ou apague o orçamento do mês de origem (campo inheritedFrom).',
        });
      }

      const budget = await prisma.budget.findFirst({ where: { id: String(id), userId } });
      if (!budget) {
        return res.status(404).json({ error: 'Orçamento não encontrado' });
      }

      await prisma.budget.delete({ where: { id: String(id) } });
      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO REMOVER ORÇAMENTO:', error);
      return res.status(500).json({ error: 'Erro interno ao remover orçamento' });
    }
  }
}
