import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

const isPercent = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 100;

export class UserController {
  // Obter configurações do usuário (receita prevista e regra 50/30/20). Cria o padrão se não existir.
  async getConfig(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const config = await prisma.userConfig.upsert({
        where: { userId },
        update: {},
        create: { userId },
      });
      return res.json(config);
    } catch (error) {
      console.error('ERRO AO BUSCAR CONFIGURAÇÕES:', error);
      return res.status(500).json({ error: 'Erro interno ao buscar configurações' });
    }
  }

  // Atualizar receita prevista e/ou percentuais da regra. Envie só o que quer alterar.
  async updateConfig(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { expectedIncome, ruleNecessity, ruleWants, ruleFuture } = req.body ?? {};

      const data: { expectedIncome?: number; ruleNecessity?: number; ruleWants?: number; ruleFuture?: number } = {};

      if (expectedIncome !== undefined) {
        const income = Number(expectedIncome);
        if (!Number.isFinite(income) || income < 0) {
          return res.status(400).json({ error: 'A receita prevista deve ser um número maior ou igual a zero' });
        }
        data.expectedIncome = income;
      }

      const rules = { ruleNecessity, ruleWants, ruleFuture };
      const sent = Object.entries(rules).filter(([, v]) => v !== undefined);
      if (sent.length > 0) {
        if (sent.length !== 3) {
          return res.status(400).json({ error: 'Envie ruleNecessity, ruleWants e ruleFuture juntos' });
        }
        if (![ruleNecessity, ruleWants, ruleFuture].every(isPercent)) {
          return res.status(400).json({ error: 'Os percentuais devem ser números inteiros entre 0 e 100' });
        }
        if (ruleNecessity + ruleWants + ruleFuture !== 100) {
          return res.status(400).json({ error: 'Os percentuais da regra devem somar 100' });
        }
        Object.assign(data, { ruleNecessity, ruleWants, ruleFuture });
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'Nenhuma configuração enviada' });
      }

      const config = await prisma.userConfig.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });

      return res.json({ message: 'Configurações atualizadas com sucesso! ⚙️', config });
    } catch (error) {
      console.error('ERRO AO ATUALIZAR CONFIGURAÇÕES:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar configurações' });
    }
  }
}
