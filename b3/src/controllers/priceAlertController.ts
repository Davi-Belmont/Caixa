import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export class PriceAlertController {
  // Listar alertas do utilizador
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const alerts = await prisma.priceAlert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(alerts);
    } catch (error) {
      console.error('ERRO AO LISTAR ALERTAS:', error);
      return res.status(500).json({ error: 'Erro interno ao listar alertas' });
    }
  }

  // Criar alerta de preço
  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { ticker, target, direction } = req.body;

      if (!ticker || target === undefined || !direction) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (ticker, target, direction)' });
      }

      const upperDirection = String(direction).toUpperCase();
      if (upperDirection !== 'ABOVE' && upperDirection !== 'BELOW') {
        return res.status(400).json({ error: 'A direção deve ser "ABOVE" (acima) ou "BELOW" (abaixo)' });
      }

      const upperTicker = ticker.toUpperCase().trim();
      const numTarget = Number(target);

      if (numTarget <= 0) {
        return res.status(400).json({ error: 'O preço alvo deve ser superior a zero' });
      }

      const alert = await prisma.priceAlert.create({
        data: {
          ticker: upperTicker,
          target: numTarget,
          direction: upperDirection,
          userId,
        },
      });

      return res.status(201).json({
        message: 'Alerta de preço criado com sucesso! 🔔',
        alert,
      });
    } catch (error) {
      console.error('ERRO AO CRIAR ALERTA:', error);
      return res.status(500).json({ error: 'Erro interno ao criar alerta' });
    }
  }

  // Atualizar alerta com validação correta de direction
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { ticker, target, direction, hit } = req.body;

      const alertExists = await prisma.priceAlert.findFirst({
        where: { id: String(id), userId },
      });

      if (!alertExists) {
        return res.status(404).json({ error: 'Alerta não encontrado' });
      }

      const updateData: any = {};

      if (ticker !== undefined) {
        updateData.ticker = String(ticker).toUpperCase().trim();
      }

      if (target !== undefined) {
        const numTarget = Number(target);
        if (numTarget <= 0) {
          return res.status(400).json({ error: 'O preço alvo deve ser superior a zero' });
        }
        updateData.target = numTarget;
      }

      // Validação estrita de direction no PUT
      if (direction !== undefined) {
        const upperDirection = String(direction).toUpperCase();
        if (upperDirection !== 'ABOVE' && upperDirection !== 'BELOW') {
          return res.status(400).json({ error: 'A direção deve ser "ABOVE" (acima) ou "BELOW" (abaixo)' });
        }
        updateData.direction = upperDirection;
      }

      if (hit !== undefined) {
        updateData.hit = Boolean(hit);
      }

      const updatedAlert = await prisma.priceAlert.update({
        where: { id: String(id) },
        data: updateData,
      });

      return res.json({
        message: 'Alerta atualizado com sucesso! 🔄',
        alert: updatedAlert,
      });
    } catch (error) {
      console.error('ERRO AO ATUALIZAR ALERTA:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar alerta' });
    }
  }

  // Avaliar e verificar alertas ativos contra o preço de mercado atual (Yahoo Finance)
  async checkAlerts(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      // Busca apenas os alertas que ainda não dispararam
      const activeAlerts = await prisma.priceAlert.findMany({
        where: { userId, hit: false },
      });

      if (activeAlerts.length === 0) {
        return res.json({ message: 'Nenhum alerta ativo para verificar', triggeredCount: 0, triggered: [] });
      }

      const triggeredAlerts = [];

      for (const alert of activeAlerts) {
        try {
          let quote: any = null;
          try {
            quote = await yahooFinance.quote(alert.ticker);
          } catch {
            if (!alert.ticker.includes('.')) {
              quote = await yahooFinance.quote(`${alert.ticker}.SA`).catch(() => null);
            }
          }

          if (Array.isArray(quote)) quote = quote[0];
          if (!quote) continue;

          const currentPrice = quote.regularMarketPrice ?? quote.currentPrice ?? 0;
          if (currentPrice === 0) continue;

          let isHit = false;
          if (alert.direction === 'ABOVE' && currentPrice >= alert.target) {
            isHit = true;
          } else if (alert.direction === 'BELOW' && currentPrice <= alert.target) {
            isHit = true;
          }

          if (isHit) {
            const updated = await prisma.priceAlert.update({
              where: { id: alert.id },
              data: { hit: true },
            });
            triggeredAlerts.push({ ...updated, currentPrice });
          }
        } catch (err) {
          console.error(`Erro ao checar cotação para o alerta ${alert.ticker}:`, err);
        }
      }

      return res.json({
        message: 'Verificação de alertas concluída com sucesso! 🎯',
        triggeredCount: triggeredAlerts.length,
        triggered: triggeredAlerts,
      });
    } catch (error) {
      console.error('ERRO AO VERIFICAR ALERTAS:', error);
      return res.status(500).json({ error: 'Erro interno ao verificar alertas' });
    }
  }

  // Remover alerta
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const alert = await prisma.priceAlert.findFirst({
        where: { id: String(id), userId },
      });

      if (!alert) {
        return res.status(404).json({ error: 'Alerta não encontrado' });
      }

      await prisma.priceAlert.delete({
        where: { id: String(id) },
      });

      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO REMOVER ALERTA:', error);
      return res.status(500).json({ error: 'Erro interno ao remover alerta' });
    }
  }
}