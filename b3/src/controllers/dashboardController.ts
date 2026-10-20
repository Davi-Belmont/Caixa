import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

export class DashboardController {
  async getSummary(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { startDate, endDate } = req.query;

      // Construção dinâmica do filtro de datas
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate as string);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate as string);
      }

      const hasDateFilter = startDate || endDate;

      // 1. Buscar transações com filtro de data opcional
      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
        orderBy: { date: 'desc' },
      });

      let totalIncome = 0;
      let totalExpense = 0;
      const expensesByCategory: Record<string, number> = {};
      const incomeByCategory: Record<string, number> = {};

      for (const t of transactions) {
        if (t.type === 'in') {
          totalIncome += t.value;
          incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.value;
        } else if (t.type === 'out') {
          totalExpense += t.value;
          expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.value;
        }
      }

      const balance = totalIncome - totalExpense;

      // 2. Buscar Contas (Bills) pendentes
      const bills = await prisma.bill.findMany({
        where: { userId },
      });

      const pendingBills = bills.filter(b => !b.isPaid);
      const totalPendingBills = pendingBills.reduce((acc, b) => acc + Number(b.amount), 0);

      // 3. Buscar Metas (Goals) e Investimentos (Stocks)
      const goals = await prisma.goal.findMany({ where: { userId } });
      const stocks = await prisma.stock.findMany({ where: { userId } });

      const totalInvested = stocks.reduce((acc, s) => acc + (s.quantity * s.averagePrice), 0);

      return res.json({
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        summary: {
          totalIncome,
          totalExpense,
          balance,
          totalPendingBills,
          totalInvested,
        },
        breakdown: {
          expensesByCategory,
          incomeByCategory,
        },
        details: {
          transactionsCount: transactions.length,
          pendingBillsCount: pendingBills.length,
          goalsCount: goals.length,
          stocksCount: stocks.length,
        },
      });
    } catch (error) {
      console.error('ERRO AO GERAR DASHBOARD:', error);
      return res.status(500).json({ error: 'Erro interno ao gerar resumo financeiro' });
    }
  }
}