/**
 * Cálculo da posição (quantidade e preço médio) a partir das operações de uma ação.
 * Funções puras: não acessam banco nem rede, para poderem ser testadas isoladamente.
 *
 * Regras (as mesmas do POST /stock-operations):
 *  - compra: quantidade soma; preço médio = custo total ÷ quantidade total;
 *  - venda: o preço médio NÃO muda; resultado = (preço de venda − preço médio) × quantidade;
 *  - zerou a posição: o custo zera (uma nova compra começa do zero).
 */

export interface Op {
  id: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  date: Date;
  createdAt: Date;
  realizedPnL: number | null;
}

export interface Pos {
  quantity: number;
  averagePrice: number;
}

export interface Target {
  id: string;
  quantity: number;
  price: number;
  date: Date;
}

/** Ordem cronológica (data, depois criação, depois id) — a mesma que o usuário enxerga no extrato. */
export const sortOps = <T extends Pick<Op, 'id' | 'date' | 'createdAt'>>(ops: T[]): T[] =>
  [...ops].sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );

/**
 * Reproduz as operações em ordem cronológica.
 * Devolve `null` se alguma venda passar do que havia em carteira naquele momento.
 */
export function replay(ops: Op[]): { position: Pos; pnl: Map<string, number> } | null {
  let qty = 0;
  let cost = 0;
  const pnl = new Map<string, number>();
  for (const o of sortOps(ops)) {
    if (o.type === 'BUY') {
      qty += o.quantity;
      cost += o.quantity * o.price;
    } else {
      if (o.quantity > qty) return null;
      const avg = qty > 0 ? cost / qty : 0;
      pnl.set(o.id, (o.price - avg) * o.quantity);
      cost -= avg * o.quantity;
      qty -= o.quantity;
      if (qty === 0) cost = 0;
    }
  }
  return { position: { quantity: qty, averagePrice: qty > 0 ? cost / qty : 0 }, pnl };
}

/** A posição guardada na carteira bate com a que as operações produzem? */
export function matches(pos: Pos, stock: Pos | null): boolean {
  if (!stock) return pos.quantity === 0;
  return pos.quantity === stock.quantity && Math.abs(pos.averagePrice - stock.averagePrice) < 0.005;
}

export type EditPlan =
  | {
      ok: true;
      /** `replay`: histórico inteiro reprocessado (exato). `delta`: só esta operação foi desfeita e refeita. */
      mode: 'replay' | 'delta';
      /** Nova posição (`null` = não sobra nada: a linha da carteira some). */
      position: Pos | null;
      /** Resultado realizado de cada venda que mudou (id da operação → valor). */
      pnl: Map<string, number>;
    }
  | { ok: false; error: string };

/**
 * Planeja a edição de uma operação (quantidade, preço e/ou data).
 *
 * 1. Se as operações explicam exatamente a posição atual da carteira, o histórico é reprocessado:
 *    o resultado é exato e o lucro das vendas seguintes é recalculado.
 * 2. Se não explicam (ex.: o ativo foi removido da carteira e comprado de novo, ou a posição foi
 *    ajustada à mão), só esta operação é desfeita e refeita sobre a posição atual — o resto fica como está.
 */
export function planEdit(ops: Op[], target: Target, stock: Pos | null): EditPlan {
  const old = ops.find((o) => o.id === target.id);
  if (!old) return { ok: false, error: 'Operação não encontrada' };

  const edited = ops.map((o) => (o.id === target.id ? { ...o, quantity: target.quantity, price: target.price, date: target.date } : o));
  const before = replay(ops);

  if (before && matches(before.position, stock)) {
    const after = replay(edited);
    if (!after) {
      return {
        ok: false,
        error:
          'Com essa alteração, alguma venda ficaria maior do que as ações que você tinha na data. Ajuste a quantidade ou a data.',
      };
    }
    const p = after.position;
    return { ok: true, mode: 'replay', position: p.quantity > 0 ? p : null, pnl: after.pnl };
  }

  // Caminho alternativo: desfaz esta operação e aplica a nova sobre a posição atual.
  let qty = stock?.quantity ?? 0;
  const avgNow = stock?.averagePrice ?? 0;
  let cost = qty * avgNow;
  const pnl = new Map<string, number>();

  if (old.type === 'BUY') {
    qty = qty - old.quantity + target.quantity;
    cost = cost - old.quantity * old.price + target.quantity * target.price;
    if (qty < 0) {
      const min = old.quantity - (stock?.quantity ?? 0);
      return { ok: false, error: `Você já vendeu parte dessas ações: a quantidade mínima desta compra é ${min}.` };
    }
  } else {
    // custo por ação na data da venda = preço de venda − lucro por ação
    const basis = old.realizedPnL != null && old.quantity > 0 ? old.price - old.realizedPnL / old.quantity : avgNow || target.price;
    qty = qty + old.quantity - target.quantity;
    cost = cost + (old.quantity - target.quantity) * basis;
    if (qty < 0) {
      const max = (stock?.quantity ?? 0) + old.quantity;
      return { ok: false, error: `Quantidade acima do que há em carteira: o máximo desta venda é ${max}.` };
    }
    pnl.set(old.id, (target.price - basis) * target.quantity);
  }

  return { ok: true, mode: 'delta', position: qty > 0 ? { quantity: qty, averagePrice: cost / qty } : null, pnl };
}
