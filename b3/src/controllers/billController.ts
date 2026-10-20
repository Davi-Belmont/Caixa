import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../config/prisma.js';
import { createBillSchema, updateBillSchema } from '../schemas/billSchema.js';
import { addMonthsClamped } from '../utils/date.js';

export class BillController {
  async list(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const bills = await prisma.bill.findMany({
        where: { userId },
        orderBy: { dueDate: 'asc' },
      });
      return res.json(bills);
    } catch (error) {
      console.error('ERRO AO LISTAR CONTAS:', error);
      return res.status(500).json({ error: 'Erro ao listar contas' });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const data = createBillSchema.parse(req.body);

      const bill = await prisma.bill.create({
        data: {
          title: data.title,
          amount: data.amount,
          dueDate: data.dueDate,
          type: data.type,
          ...(data.category !== undefined && { category: data.category }),
          ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
          ...(data.installments !== undefined && { installments: data.installments }),
          ...(data.currentInstallment !== undefined && { currentInstallment: data.currentInstallment }),
          ...(data.barcode !== undefined && { barcode: data.barcode }),
          userId,
        },
      });

      return res.status(201).json({
        message: 'Conta criada com sucesso! 📄',
        bill,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      console.error('ERRO AO CRIAR CONTA:', error);
      return res.status(500).json({ error: 'Erro interno ao criar conta' });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const data = updateBillSchema.parse(req.body);

      const billExists = await prisma.bill.findFirst({
        where: { id: String(id), userId },
      });

      if (!billExists) {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }

      const updatedBill = await prisma.bill.update({
        where: { id: String(id) },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
          ...(data.type !== undefined && { type: data.type }),
          ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
          ...(data.installments !== undefined && { installments: data.installments }),
          ...(data.currentInstallment !== undefined && { currentInstallment: data.currentInstallment }),
          ...(data.barcode !== undefined && { barcode: data.barcode }),
          ...(data.paidAt !== undefined && { paidAt: data.paidAt }),
          ...(data.paidAmount !== undefined && { paidAmount: data.paidAmount }),
        },
      });

      return res.json({
        message: 'Conta atualizada com sucesso! 📄',
        bill: updatedBill,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: error.issues.map((i) => ({ campo: i.path.join('.'), message: i.message })),
        });
      }
      console.error('ERRO AO ATUALIZAR CONTA:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar conta' });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const billExists = await prisma.bill.findFirst({
        where: { id: String(id), userId },
      });

      if (!billExists) {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }

      await prisma.bill.delete({
        where: { id: String(id) },
      });

      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO APAGAR CONTA:', error);
      return res.status(500).json({ error: 'Erro ao apagar conta' });
    }
  }
// Pagar uma conta: marca como paga, gera a transação no extrato e, se for parcelada/mensal, cria a próxima
  // Corpo (opcional): { paidAmount?: number, date?: string }
  async payBill(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { paidAmount, date } = req.body ?? {};

      const bill = await prisma.bill.findFirst({
        where: { id: String(id), userId },
      });

      if (!bill) {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }

      if (bill.isPaid) {
        return res.status(400).json({ error: 'Esta conta já foi paga' });
      }

      const finalPaidAmount = paidAmount !== undefined ? Number(paidAmount) : Number(bill.amount);
      if (!Number.isFinite(finalPaidAmount) || finalPaidAmount <= 0) {
        return res.status(400).json({ error: 'O valor pago deve ser maior que zero' });
      }

      const paymentDate = date ? new Date(date) : new Date();
      if (Number.isNaN(paymentDate.getTime())) {
        return res.status(400).json({ error: 'Data de pagamento inválida' });
      }

      // Conta a receber gera entrada ('in'); conta a pagar gera saída ('out'). Valor sempre positivo.
      const isReceivable = bill.type === 'RECEIVABLE';

      const result = await prisma.$transaction(async (tx) => {
        // 1. Transação no extrato (mesmo formato do restante da API: 'in' | 'out', valor positivo)
        const transaction = await tx.transaction.create({
          data: {
            description: `${isReceivable ? 'Recebido' : 'Pago'}: ${bill.title}`,
            value: finalPaidAmount,
            type: isReceivable ? 'in' : 'out',
            category: bill.category || 'Geral',
            date: paymentDate,
            userId,
          },
        });

        // 2. Conta marcada como paga e vinculada à transação
        const updatedBill = await tx.bill.update({
          where: { id: bill.id },
          data: {
            isPaid: true,
            paidAt: paymentDate,
            paidAmount: finalPaidAmount,
            transactionId: transaction.id,
          },
        });

        // 3. Próxima parcela (parcelada) ou próximo mês (recorrência mensal sem limite)
        let nextBill = null;
        const hasMoreInstallments =
          !!bill.installments && !!bill.currentInstallment && bill.currentInstallment < bill.installments;
        const isOpenMonthly = bill.recurrence === 'MONTHLY' && !bill.installments;

        if (hasMoreInstallments || isOpenMonthly) {
          nextBill = await tx.bill.create({
            data: {
              title: bill.title,
              amount: bill.amount,
              dueDate: addMonthsClamped(new Date(bill.dueDate), 1),
              type: bill.type,
              category: bill.category,
              recurrence: bill.recurrence,
              barcode: bill.barcode,
              userId,
              ...(hasMoreInstallments && {
                installments: bill.installments,
                currentInstallment: bill.currentInstallment! + 1,
              }),
            },
          });
        }

        return { bill: updatedBill, transaction, nextBill };
      });

      return res.json({
        message: result.nextBill
          ? 'Conta paga com sucesso e próxima parcela gerada! 💳'
          : 'Conta paga com sucesso! 💸',
        ...result,
      });
    } catch (error) {
      console.error('ERRO AO PAGAR CONTA:', error);
      return res.status(500).json({ error: 'Erro interno ao processar pagamento da conta' });
    }
  }
}
