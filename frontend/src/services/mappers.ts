/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Conversão entre o estado da tela (S, herdado do financas8.html) e o formato da API.
 * Funções puras: não tocam em S nem na rede.
 */
type Any = any;

export const strip = (t: string) => String(t).replace(/\.SA$/i, '').toUpperCase().trim();
export const day = (iso: string) => String(iso).slice(0, 10);
/** Meio-dia UTC: evita que o fuso horário vire o dia. */
export const noon = (d: string) => `${d}T12:00:00.000Z`;
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));

/* ---------- grupos da regra 50/30/20 ---------- */
export const GROUP_TO_API: Record<string, string> = { nec: 'NECESSITY', des: 'WANTS', fut: 'FUTURE' };
export const GROUP_FROM_API: Record<string, string> = { NECESSITY: 'nec', WANTS: 'des', FUTURE: 'fut' };

/** Ordem em que o front sempre mostrou as categorias padrão; as demais vêm depois, por nome. */
const CAT_ORDER = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação'];
export const sortCategories = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a.name), ib = CAT_ORDER.indexOf(b.name);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.name.localeCompare(b.name, 'pt-BR');
  });

/** Categorias padrão do front (usadas só se a conta ainda não tiver nenhuma categoria de despesa na API). */
export const DEFAULT_CATS = [
  { n: 'Moradia', ic: '🏠', col: '#3a5bff', g: 'nec' }, { n: 'Alimentação', ic: '🍽️', col: '#8b5cf6', g: 'nec' },
  { n: 'Transporte', ic: '🚌', col: '#ec4899', g: 'nec' }, { n: 'Lazer', ic: '🎬', col: '#f59e0b', g: 'des' },
  { n: 'Saúde', ic: '💊', col: '#3ddc97', g: 'nec' }, { n: 'Educação', ic: '📚', col: '#22b8cf', g: 'fut' },
];

/** Limites que o front já usava na primeira execução (usados só para quem ainda não tem orçamento salvo). */
export const DEFAULT_LIMITS: Record<string, number> = { Moradia: 2000, Alimentação: 900, Transporte: 300, Lazer: 250, Saúde: 300, Educação: 300 };

/* ---------- transações ---------- */
export const txBody = (t: Any) => ({ description: t.d, value: t.v, type: t.tp, category: t.c, date: noon(t.dt) });
export const txFromApi = (r: Any) => ({ sid: r.id, d: r.description, v: Number(r.value), tp: r.type, c: r.category, dt: day(r.date) });

/* ---------- contas ---------- */
const REC_TO_API: Record<string, string> = { '0': 'SINGLE', m: 'MONTHLY', p: 'INSTALLMENT' };

/** Corpo completo da conta (usado para comparar e para PUT). `unpaid` força "em aberto". */
export const billBody = (b: Any, opts: { unpaid?: boolean } = {}) => {
  const paid = !opts.unpaid && !!b.paid;
  return {
    title: b.n,
    amount: b.v,
    dueDate: noon(b.due),
    type: 'PAYABLE',
    category: b.c || 'Moradia',
    recurrence: REC_TO_API[b.rec || '0'] ?? 'SINGLE',
    // 0 limpa o valor no servidor quando a conta deixa de ser parcelada
    installments: b.rec === 'p' ? b.np || 0 : 0,
    currentInstallment: b.rec === 'p' ? b.pk || 1 : 0,
    barcode: b.cb || '',
    isPaid: paid,
    ...(paid ? { paidAt: noon(b.paidAt || b.due), paidAmount: b.pv ?? b.v } : {}),
  };
};
/** Corpo aceito no POST (a API não aceita isPaid/paidAt/paidAmount na criação). */
export const billCreate = (b: Any) => {
  const { isPaid: _i, paidAt: _a, paidAmount: _p, ...rest } = billBody(b);
  void _i; void _a; void _p;
  return rest;
};
export const billFromApi = (r: Any) => {
  const rec = r.recurrence === 'MONTHLY' ? 'm' : r.recurrence === 'INSTALLMENT' || num(r.installments) > 0 ? 'p' : '0';
  const b: Any = { sid: r.id, n: r.title, v: Number(r.amount), due: day(r.dueDate), paid: !!r.isPaid, c: r.category || 'Moradia', rec, cb: r.barcode || '' };
  if (rec === 'p') { b.np = num(r.installments); b.pk = num(r.currentInstallment) || 1; }
  if (b.paid) { b.paidAt = r.paidAt ? day(r.paidAt) : b.due; b.pv = r.paidAmount != null ? Number(r.paidAmount) : b.v; }
  return b;
};

/* ---------- metas ---------- */
/** Corpo sem currentAmount: o progresso só muda por aportes (POST /contributions). */
export const goalBody = (g: Any) => ({ title: g.n, targetAmount: g.t, icon: g.ic || '🎯', deadline: g.dl ? noon(g.dl) : null });
export const goalFromApi = (r: Any) => ({
  sid: r.id, n: r.title, t: Number(r.targetAmount), a: Number(r.currentAmount), ic: r.icon || '🎯', dl: r.deadline ? day(r.deadline) : '',
  h: [...(r.contributions || [])]
    .sort((a: Any, b: Any) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((c: Any) => ({ dt: day(c.date), v: Number(c.amount), cid: c.id })),
});

/* ---------- proventos ---------- */
export const divBody = (d: Any) => ({ ticker: strip(d.t), type: d.tp === 'JCP' ? 'JCP' : 'DIVIDEND', amount: d.v, date: noon(d.dt) });
export const divFromApi = (r: Any) => ({ sid: r.id, t: strip(r.ticker), tp: r.type === 'JCP' ? 'JCP' : 'Dividendo', v: Number(r.amount), dt: day(r.date) });

/* ---------- alertas de preço ---------- */
export const alertBody = (w: Any) => ({ ticker: strip(w.t), target: w.alvo, direction: w.dir === 'dn' ? 'BELOW' : 'ABOVE', hit: !!w.hit });
export const alertFromApi = (r: Any) => ({ sid: r.id, t: strip(r.ticker), alvo: Number(r.target), dir: r.direction === 'BELOW' ? 'dn' : 'up', hit: !!r.hit });

/* ---------- categorias ---------- */
export const catBody = (c: Any, grp: Record<string, string>) => ({ name: c.n, icon: c.ic, color: c.col, group: GROUP_TO_API[grp[c.n]] ?? null });
export const catFromApi = (r: Any) => ({ sid: r.id, n: r.name, ic: r.icon || '📁', col: r.color || '#3a5bff' });

/* ---------- operações da carteira ---------- */
/** Corpo do POST. `launch`: lança a operação nas transações (venda = receita, compra = despesa). */
export const opBody = (o: Any, launch?: boolean) => ({
  ticker: strip(o.t), type: o.tp === 'Compra' ? 'BUY' : 'SELL', quantity: o.q, price: o.p, date: noon(o.dt),
  ...(launch !== undefined ? { launch } : {}),
});
/** Corpo do PUT (correção de quantidade, preço, data e, nas vendas, do lançamento nas transações). */
export const opEditBody = (o: Any, launch?: boolean) => ({
  quantity: o.q, price: o.p, date: noon(o.dt),
  ...(launch !== undefined ? { launch } : {}),
});
export const opFromApi = (r: Any) => ({
  sid: r.id, t: strip(r.ticker), tp: r.type === 'BUY' ? 'Compra' : 'Venda', q: Number(r.quantity), p: Number(r.price), dt: day(r.date),
  rp: r.realizedPnL == null ? null : Number(r.realizedPnL),
  txsid: (r.transactionId ?? null) as string | null, // transação gerada pela operação (receita da venda / despesa da compra)
});

/* ---------- vínculos que a API não guarda (reconstruídos ao carregar) ---------- */
/** Soma de meses sem estourar o dia (igual ao servidor): 31/jan + 1 = 28/fev. */
export function addMonthsClamped(isoDay: string, n: number): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Liga cada conta paga à próxima conta (mesmo título, mês seguinte, ainda em aberto). */
export function linkNextBills(bills: Any[]) {
  for (const b of bills) {
    if (!b.paid || (b.rec !== 'm' && b.rec !== 'p')) continue;
    const due = addMonthsClamped(b.due, 1);
    const next = bills.find((x) => !x.paid && x !== b && x.n === b.n && x.rec === b.rec && x.due === due && (b.rec !== 'p' || x.pk === (b.pk || 1) + 1));
    if (next) b.nx = next.id;
  }
}

/** Liga cada provento à transação "Provento XXX" que foi lançada como receita. */
export function linkDividendTx(divs: Any[], txs: Any[]) {
  for (const d of divs) {
    const t = txs.find((x) => x.tp === 'in' && x.d === `Provento ${d.t}` && x.dt === d.dt && Math.abs(x.v - d.v) < 0.005);
    if (t) d.tid = t.id;
  }
}
