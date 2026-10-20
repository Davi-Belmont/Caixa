import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { planEdit, type Op } from '../utils/position.js';

// Operação lançada nas transações: venda = receita ('in'), compra = despesa ('out'), pelo valor total (quantidade × preço).
const TX_CATEGORY = 'Investimentos';
const round2 = (n: number) => Math.round(n * 100) / 100;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const opDescription = (type: string, ticker: string, quantity: number, price: number) =>
  `${type === 'SELL' ? 'Venda' : 'Compra'} ${ticker.replace(/\.SA$/i, '')} · ${quantity} × ${brl(price)}`;
const opTxType = (type: string) => (type === 'SELL' ? 'in' : 'out');

// Os ativos da B3 são guardados como 'PETR4.SA' (é assim que POST /stocks grava a compra).
// Aqui aceitamos 'PETR4', 'petr4' ou 'PETR4.SA' e tratamos tudo como o mesmo ativo.
// Ativos com outro sufixo (ex.: 'AAPL.MX') ficam como vieram.
const normalizeTicker = (raw: string) => {
  const t = String(raw).toUpperCase().trim();
  return t.includes('.') ? t : `${t}.SA`;
};

// Operações antigas podem ter sido gravadas sem '.SA': na consulta usamos as duas formas.
const tickerVariants = (raw: string) => {
  const t = normalizeTicker(raw);
  return t.endsWith('.SA') ? [t, t.slice(0, -3)] : [t];
};

// Erro de validação com status HTTP próprio (qualquer outro erro vira 500)
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class StockOperationController {
  // Listar todas as operações de ações do usuário
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { ticker } = req.query;

      const operations = await prisma.stockOperation.findMany({
        where: {
          userId,
          ...(ticker ? { ticker: { in: tickerVariants(String(ticker)) } } : {}),
        },
        orderBy: { date: 'desc' },
      });

      return res.json(operations);
    } catch (error) {
      console.error('ERRO AO LISTAR OPERAÇÕES:', error);
      return res.status(500).json({ error: 'Erro interno ao listar operações' });
    }
  }

  // Registar uma operação (compra ou venda). A carteira (`stocks`) é a fonte da posição e do preço médio:
  // a operação e a atualização da carteira acontecem na mesma transação.
  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { ticker, type, quantity, price, date, launch } = req.body ?? {};

      if (!ticker || !type || quantity === undefined || price === undefined) {
        throw new HttpError(400, 'ticker, type (BUY/SELL), quantity e price são obrigatórios');
      }

      const opType = String(type).toUpperCase();
      if (opType !== 'BUY' && opType !== 'SELL') {
        throw new HttpError(400, 'O tipo deve ser "BUY" (compra) ou "SELL" (venda)');
      }

      const numQuantity = Number(quantity);
      const numPrice = Number(price);
      if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
        throw new HttpError(400, 'A quantidade deve ser um número inteiro superior a zero');
      }
      if (!Number.isFinite(numPrice) || numPrice <= 0) {
        throw new HttpError(400, 'O preço deve ser superior a zero');
      }

      const opDate = date ? new Date(date) : new Date();
      if (Number.isNaN(opDate.getTime())) throw new HttpError(400, 'Data inválida');

      const variants = tickerVariants(String(ticker));
      const normalizedTicker = normalizeTicker(String(ticker));

      // Venda: vira receita por padrão (launch: false desliga). Compra: só vira despesa se launch: true
      // (registrar uma posição que o usuário já tinha não deve mexer no saldo).
      const launchOp = opType === 'SELL' ? launch !== false : launch === true;

      const { operation, transaction } = await prisma.$transaction(async (tx) => {
        // Posição atual: procura o ativo na carteira nas duas grafias (PETR4.SA / PETR4)
        const stock = await tx.stock.findFirst({ where: { userId, ticker: { in: variants } } });
        const activeTicker = stock?.ticker ?? normalizedTicker;

        let realizedPnL: number | null = null;

        if (opType === 'BUY') {
          if (stock) {
            const totalQty = stock.quantity + numQuantity;
            const totalCost = stock.quantity * stock.averagePrice + numQuantity * numPrice;
            await tx.stock.update({
              where: { id: stock.id },
              data: { quantity: totalQty, averagePrice: totalCost / totalQty },
            });
          } else {
            await tx.stock.create({
              data: { ticker: activeTicker, quantity: numQuantity, averagePrice: numPrice, userId },
            });
          }
        } else {
          const owned = stock?.quantity ?? 0;
          if (!stock || numQuantity > owned) {
            throw new HttpError(
              400,
              `Quantidade insuficiente em carteira para venda. Possui ${owned}, tentou vender ${numQuantity}.`,
            );
          }

          // Lucro/prejuízo realizado = (preço de venda − preço médio) × quantidade vendida
          realizedPnL = (numPrice - stock.averagePrice) * numQuantity;

          const remaining = stock.quantity - numQuantity;
          if (remaining === 0) {
            await tx.stock.delete({ where: { id: stock.id } }); // vendeu tudo: sai da carteira (o histórico fica)
          } else {
            await tx.stock.update({ where: { id: stock.id }, data: { quantity: remaining } }); // o preço médio não muda na venda
          }
        }

        const saleTx = launchOp
          ? await tx.transaction.create({
              data: {
                description: opDescription(opType, activeTicker, numQuantity, numPrice),
                value: round2(numQuantity * numPrice),
                type: opTxType(opType),
                category: TX_CATEGORY,
                date: opDate,
                userId,
              },
            })
          : null;

        const op = await tx.stockOperation.create({
          data: {
            ticker: activeTicker,
            type: opType,
            quantity: numQuantity,
            price: numPrice,
            realizedPnL,
            date: opDate,
            transactionId: saleTx?.id ?? null,
            userId,
          },
        });
        return { operation: op, transaction: saleTx };
      });

      return res.status(201).json({
        message:
          opType === 'BUY'
            ? 'Compra registada com sucesso!'
            : `Venda registada com sucesso! Lucro/Prejuízo: ${operation.realizedPnL?.toFixed(2)}`,
        operation,
        transaction, // lançamento gerado (receita da venda / despesa da compra), ou null
      });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('ERRO AO REGISTAR OPERAÇÃO:', error);
      return res.status(500).json({ error: 'Erro interno ao registar operação' });
    }
  }

  // Corrigir uma operação já registada (quantidade, preço e/ou data). A posição da carteira, o lucro das vendas
  // e a receita lançada nas transações são recalculados na mesma transação do banco.
  async update(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);
      const { quantity, price, date, launch } = req.body ?? {};

      const result = await prisma.$transaction(async (tx) => {
        const op = await tx.stockOperation.findFirst({ where: { id, userId } });
        if (!op) throw new HttpError(404, 'Operação não encontrada');
        if (op.type !== 'BUY' && op.type !== 'SELL') throw new HttpError(400, 'Operação com tipo desconhecido');

        const newQty = quantity === undefined ? op.quantity : Number(quantity);
        const newPrice = price === undefined ? op.price : Number(price);
        const newDate = date === undefined ? op.date : new Date(date);
        if (!Number.isInteger(newQty) || newQty <= 0) {
          throw new HttpError(400, 'A quantidade deve ser um número inteiro superior a zero');
        }
        if (!Number.isFinite(newPrice) || newPrice <= 0) throw new HttpError(400, 'O preço deve ser superior a zero');
        if (Number.isNaN(newDate.getTime())) throw new HttpError(400, 'Data inválida');

        const variants = tickerVariants(op.ticker);
        const stock = await tx.stock.findFirst({ where: { userId, ticker: { in: variants } } });
        const rows = await tx.stockOperation.findMany({ where: { userId, ticker: { in: variants } } });
        const ops: Op[] = rows.map((r) => ({
          id: r.id,
          type: r.type === 'SELL' ? 'SELL' : 'BUY',
          quantity: r.quantity,
          price: r.price,
          date: r.date,
          createdAt: r.createdAt,
          realizedPnL: r.realizedPnL,
        }));

        const plan = planEdit(
          ops,
          { id, quantity: newQty, price: newPrice, date: newDate },
          stock ? { quantity: stock.quantity, averagePrice: stock.averagePrice } : null,
        );
        if (!plan.ok) throw new HttpError(400, plan.error);

        // 1) carteira
        let newStock = stock;
        if (plan.position) {
          newStock = stock
            ? await tx.stock.update({ where: { id: stock.id }, data: plan.position })
            : await tx.stock.create({ data: { ticker: op.ticker, userId, ...plan.position } });
        } else if (stock) {
          await tx.stock.delete({ where: { id: stock.id } });
          newStock = null;
        }

        // 2) lucro realizado das vendas que mudaram (a própria operação e, no modo exato, as seguintes)
        const affected: { id: string; realizedPnL: number }[] = [];
        for (const [opId, pnl] of plan.pnl) {
          const prev = rows.find((r) => r.id === opId);
          if (!prev || (prev.realizedPnL != null && Math.abs(prev.realizedPnL - pnl) < 1e-9)) continue;
          await tx.stockOperation.update({ where: { id: opId }, data: { realizedPnL: pnl } });
          if (opId !== id) affected.push({ id: opId, realizedPnL: pnl });
        }

        // 3) a própria operação
        await tx.stockOperation.update({ where: { id }, data: { quantity: newQty, price: newPrice, date: newDate } });

        // 4) lançamento nas transações (acompanha quantidade, preço e data; `launch` liga/desliga)
        let transaction: Record<string, unknown> | null = null;
        let deletedTransactionId: string | null = null;
        const wantLaunch = launch === undefined ? !!op.transactionId : Boolean(launch);
        const fields = { description: opDescription(op.type, op.ticker, newQty, newPrice), value: round2(newQty * newPrice), date: newDate };
        if (wantLaunch && op.transactionId) {
          transaction = await tx.transaction.update({ where: { id: op.transactionId }, data: fields });
        } else if (wantLaunch) {
          transaction = await tx.transaction.create({ data: { ...fields, type: opTxType(op.type), category: TX_CATEGORY, userId } });
          await tx.stockOperation.update({ where: { id }, data: { transactionId: transaction.id as string } });
        } else if (op.transactionId) {
          await tx.stockOperation.update({ where: { id }, data: { transactionId: null } });
          await tx.transaction.delete({ where: { id: op.transactionId } });
          deletedTransactionId = op.transactionId;
        }

        const operation = await tx.stockOperation.findUniqueOrThrow({ where: { id } });
        return { operation, transaction, deletedTransactionId, affected, stock: newStock, mode: plan.mode };
      });

      return res.json({ message: 'Operação atualizada com sucesso!', ...result });
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('ERRO AO ATUALIZAR OPERAÇÃO:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar operação' });
    }
  }

  // Apagar uma operação
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const operation = await prisma.stockOperation.findFirst({
        where: { id: String(id), userId },
      });

      if (!operation) {
        return res.status(404).json({ error: 'Operação não encontrada' });
      }

      await prisma.stockOperation.delete({
        where: { id: String(id) },
      });

      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO REMOVER OPERAÇÃO:', error);
      return res.status(500).json({ error: 'Erro interno ao remover operação' });
    }
  }
}