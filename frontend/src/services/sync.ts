/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';
import { apiError } from './auth';
import { cx } from '../lib/cx';
import * as M from './mappers';
import { applyQuotes, catalogSearch, fetchQuotes, loadHistory, refreshQuotes, type Quote } from './market';

export { refreshQuotes } from './market';

/**
 * Sincronização entre o estado da tela (S, do financas8.html) e a API.
 *
 *  - Ao abrir: carrega tudo da API (fetchAll → hydrate) antes do primeiro desenho.
 *  - Depois: a cada save() compara S com o que o servidor já tem e envia só a diferença
 *    (POST / PUT / DELETE). Se a API recusar, a alteração é desfeita e o motivo aparece.
 *  - Casos especiais: pagamento de contas (rota própria que gera a transação e a próxima conta),
 *    metas (progresso só muda por aportes) e carteira (muda por operações de compra/venda).
 *  - Fica só no navegador (localStorage): filtros, notificações lidas, preferências de tela e favoritos.
 */

type Any = any;

export interface ServerData {
  tx: Any[]; bills: Any[]; goals: Any[]; stocks: Any[]; divs: Any[]; ops: Any[]; alerts: Any[]; cats: Any[]; budgets: Any[]; config: Any;
}

const monthNow = () => new Date().toISOString().slice(0, 7);
const esc = (s: string) => s.replace(/[<>&]/g, '');

/* ---------------------------------------------------------------- carga inicial */

async function fetchAllTx(): Promise<Any[]> {
  const out: Any[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get('/transactions', { params: { page, limit: 500 } });
    out.push(...data.data);
    if (page >= data.meta.totalPages) break;
  }
  return out;
}

let inflight: Promise<ServerData> | null = null;

/** Carga completa. Chamadas simultâneas (ex.: StrictMode no desenvolvimento) dividem a mesma requisição. */
export function fetchAll(): Promise<ServerData> {
  inflight ??= loadEverything().finally(() => { inflight = null; });
  return inflight;
}

async function loadEverything(): Promise<ServerData> {
  const get = (label: string, p: Promise<Any>) => p.catch((e) => { throw new Error(`${label}: ${apiError(e)}`); });
  const g = (url: string, params?: Any) => api.get(url, { params }).then((r) => r.data);
  const [tx, bills, goals, stocks, divs, ops, alerts, cats, budgets, config] = await Promise.all([
    get('transações', fetchAllTx()), get('contas', g('/bills')), get('metas', g('/goals')), get('carteira', g('/stocks')),
    get('proventos', g('/dividends')), get('operações', g('/stock-operations')), get('alertas', g('/price-alerts')),
    get('categorias', g('/categories')), get('orçamento', g('/budgets', { month: monthNow() })), get('configurações', g('/users/config')),
  ]);
  return { tx, bills, goals, stocks, divs, ops, alerts, cats, budgets, config };
}

/* ---------------------------------------------------------------- o que o servidor já tem */

type Ent = { sid: string; json: string; item: Any };
type ListKind = 'tx' | 'bills' | 'goals' | 'divs' | 'watch' | 'cl';
const snaps: Record<ListKind, Map<number, Ent>> = { tx: new Map(), bills: new Map(), goals: new Map(), divs: new Map(), watch: new Map(), cl: new Map() };
let srvGoalA = new Map<string, number>();            // meta (sid) -> valor atual no servidor
let srvStocks = new Map<string, { sid: string; q: number; pm: number }>(); // ticker -> posição no servidor
let srvBudget = new Map<string, number>();           // categoria (sid) -> limite do mês atual (herdado ou não)
let srvConfig = { ip: 0, rule: [50, 30, 20] };
let opSnaps = new Map<number, string>();             // operação (id local) -> corpo de edição que o servidor já tem
const stockMissingSince = new Map<string, number>(); // ativo removido na tela: espera o prazo do "Desfazer"
const STOCK_UNDO_MS = 4500;

function hydrate(d: ServerData) {
  const { S, applyCats } = cx();
  const id = () => ++S.nid;

  // categorias, grupos (50/30/20) e limites do mês
  const outCats = M.sortCategories(d.cats.filter((c) => String(c.type).toLowerCase() !== 'in'));
  srvBudget = new Map(d.budgets.map((b) => [b.categoryId, Number(b.limitAmount)]));
  if (outCats.length) {
    S.cl = outCats.map((c) => ({ id: id(), ...M.catFromApi(c) }));
    S.grp = {};
    outCats.forEach((c) => { S.grp[c.name] = M.GROUP_FROM_API[c.group] ?? 'des'; });
  } else {
    // conta sem categorias de despesa: cria as padrão (o envio acontece no primeiro save)
    S.cl = M.DEFAULT_CATS.map((c) => ({ id: id(), n: c.n, ic: c.ic, col: c.col }));
    S.grp = Object.fromEntries(M.DEFAULT_CATS.map((c) => [c.n, c.g]));
  }
  S.budget = {};
  S.cl.forEach((c: Any) => {
    const lim = c.sid ? srvBudget.get(c.sid) : undefined;
    S.budget[c.n] = lim ?? M.DEFAULT_LIMITS[c.n] ?? 500;
  });
  applyCats();

  S.ip = Number(d.config.expectedIncome) || 0;
  S.rule = [d.config.ruleNecessity, d.config.ruleWants, d.config.ruleFuture].map(Number);
  srvConfig = { ip: S.ip, rule: [...S.rule] };

  // transações, contas (com vínculo à transação do pagamento), metas e aportes
  S.tx = d.tx.map((r) => ({ id: id(), ...M.txFromApi(r) }));
  const txBySid = new Map<string, number>(S.tx.map((x: Any) => [x.sid, x.id]));
  S.bills = d.bills.map((r) => {
    const b: Any = { id: id(), ...M.billFromApi(r) };
    if (r.transactionId && txBySid.has(r.transactionId)) b.tid = txBySid.get(r.transactionId);
    return b;
  });
  M.linkNextBills(S.bills);
  S.goals = d.goals.map((r) => ({ id: id(), ...M.goalFromApi(r) }));
  srvGoalA = new Map(d.goals.map((r) => [r.id, Number(r.currentAmount)]));

  // proventos, alertas, operações e carteira
  S.divs = d.divs.map((r) => ({ id: id(), ...M.divFromApi(r) }));
  M.linkDividendTx(S.divs, S.tx);
  S.watch = d.alerts.map((r) => ({ id: id(), ...M.alertFromApi(r) }));
  S.ops = [...d.ops]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((r) => ({ id: id(), ...M.opFromApi(r) }));
  S.ops.forEach((o: Any) => { if (o.txsid && txBySid.has(o.txsid)) o.tid = txBySid.get(o.txsid); }); // venda -> receita nas transações
  opSnaps = new Map(S.ops.map((o: Any) => [o.id, opSnap(o)]));
  S.real = S.ops.filter((o: Any) => o.tp === 'Venda').reduce((a: number, o: Any) => a + (o.rp ?? 0), 0);

  srvStocks = new Map();
  const quotes: Quote[] = [];
  S.stocks = d.stocks.map((r) => {
    const t = M.strip(r.ticker);
    srvStocks.set(t, { sid: r.id, q: Number(r.quantity), pm: Number(r.averagePrice) });
    if (r.currentPrice) quotes.push({ ticker: t, price: Number(r.currentPrice), prev: r.previousClose ? Number(r.previousClose) : null });
    return { id: id(), t, q: Number(r.quantity), pm: Number(r.averagePrice) };
  });
  applyQuotes(quotes);
  stockMissingSince.clear();

  // fotografias do servidor, para detectar o que mudou depois
  const mk = (kind: ListKind, list: Any[], body: (x: Any) => Any) => {
    snaps[kind] = new Map(list.filter((x) => x.sid).map((x) => [x.id, { sid: x.sid, json: JSON.stringify(body(x)), item: x }]));
  };
  mk('tx', S.tx, M.txBody);
  mk('bills', S.bills, (b) => M.billBody(b));
  mk('goals', S.goals, M.goalBody);
  mk('divs', S.divs, M.divBody);
  mk('watch', S.watch, M.alertBody);
  mk('cl', S.cl, (c) => M.catBody(c, S.grp));
}

/** Chamado pelo script antes do primeiro render(). */
export function boot() {
  hydrate(window.__bootData as ServerData);
  const n = (window.__user?.name || 'A').trim();
  const av = document.querySelector('.av');
  if (av) av.textContent = n[0].toUpperCase();
  setTimeout(warmMarket, 0);
}

/** Depois do primeiro desenho: cotações, setores e histórico real da carteira (sem travar a tela). */
async function warmMarket() {
  const { S, render } = cx();
  const ts: string[] = [...new Set<string>(S.stocks.map((x: Any) => x.t))];
  await Promise.allSettled([refreshQuotes(), ...ts.map((t) => loadHistory(t)), ...ts.map((t) => catalogSearch(t))]);
  render();
}

export async function reload(quiet?: boolean) {
  try {
    hydrate(await fetchAll());
    cx().render();
    if (!quiet) cx().toast('Dados recarregados da API');
  } catch (e) {
    cx().toast('⚠️ Não foi possível recarregar: ' + esc(apiError(e)));
  }
}

/* ---------------------------------------------------------------- envio das alterações */

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;
export const scheduleSync = () => { clearTimeout(timer); timer = setTimeout(run, 150); };

async function run() {
  if (running) { again = true; return; }
  running = true;
  const fails: string[] = [];
  try {
    do { again = false; await syncAll(fails); } while (again);
  } finally { running = false; }
  if (fails.length) {
    await reload(true); // desfaz na tela o que a API recusou
    cx().toast(`⚠️ ${fails.length} alteração(ões) não salva(s): ${esc([...new Set(fails)].join(' | '))}`);
  }
}

async function syncAll(fails: string[]) {
  await syncList(CAT_CFG, fails);
  await syncOps(fails); // antes das transações: o servidor cria/atualiza/apaga a receita de cada venda
  await syncList(TX_CFG, fails);
  await syncBills(fails);
  await syncGoals(fails);
  await syncList(DIV_CFG, fails);
  await syncList(ALERT_CFG, fails);
  await syncStockRemoval(fails);
  await syncBudgets(fails);
  await syncConfig(fails);
}

interface Cfg {
  kind: ListKind; path: string; label: string;
  body: (it: Any) => Any;            // usado para comparar (e como corpo do PUT, se `put` não existir)
  create?: (it: Any) => Any;         // corpo do POST (padrão: body)
  put?: (it: Any) => Any;            // corpo do PUT
  pick: (resp: Any) => Any;          // de onde sai o registro criado na resposta do POST
  update?: boolean;                  // false = a API não tem PUT
  skip?: (it: Any) => boolean;       // itens que outro fluxo cuida (ex.: gerados pelo pagamento)
  after?: (it: Any) => Promise<void>; // depois do POST
}

const fail = (cfg: { label: string }, e: unknown) => `${cfg.label}: ${apiError(e)}`;

async function syncList(cfg: Cfg, fails: string[]) {
  const { S } = cx();
  const snap = snaps[cfg.kind];
  const live = new Set<number>();
  for (const it of [...S[cfg.kind]] as Any[]) {
    if (it.id == null) it.id = ++S.nid;
    live.add(it.id);
    if (cfg.skip?.(it)) continue;
    const json = JSON.stringify(cfg.body(it)), ent = snap.get(it.id);
    try {
      if (!it.sid) {
        const r = await api.post(cfg.path, (cfg.create ?? cfg.body)(it));
        it.sid = cfg.pick(r.data).id;
        await cfg.after?.(it);
        snap.set(it.id, { sid: it.sid, json, item: it });
      } else if (!ent) {
        snap.set(it.id, { sid: it.sid, json, item: it });
      } else if (ent.json !== json && cfg.update !== false) {
        await api.put(`${cfg.path}/${it.sid}`, (cfg.put ?? cfg.body)(it));
        ent.json = json;
      }
    } catch (e) { fails.push(fail(cfg, e)); }
  }
  for (const [id, ent] of [...snap]) {
    if (live.has(id)) continue;
    try {
      await api.delete(`${cfg.path}/${ent.sid}`);
      ent.item.sid = undefined; // se o usuário clicar em "Desfazer", volta como registro novo
      snap.delete(id);
    } catch (e) { fails.push(fail(cfg, e)); }
  }
}

const CAT_CFG: Cfg = {
  kind: 'cl', path: '/categories', label: 'categorias', pick: (d) => d,
  body: (c) => M.catBody(c, cx().S.grp),
  create: (c) => ({ ...M.catBody(c, cx().S.grp), type: 'out' }),
};
const TX_CFG: Cfg = { kind: 'tx', path: '/transactions', label: 'transações', body: M.txBody, pick: (d) => d.transaction, skip: (t) => t._via === 'pay' || t._via === 'sell' };
const DIV_CFG: Cfg = { kind: 'divs', path: '/dividends', label: 'proventos', body: M.divBody, pick: (d) => d.dividend, update: false };
const ALERT_CFG: Cfg = {
  kind: 'watch', path: '/price-alerts', label: 'alertas', pick: (d) => d.alert, body: M.alertBody,
  create: (w) => ({ ticker: M.strip(w.t), target: w.alvo, direction: w.dir === 'dn' ? 'BELOW' : 'ABOVE' }),
  put: (w) => ({ target: w.alvo, direction: w.dir === 'dn' ? 'BELOW' : 'ABOVE', hit: !!w.hit }),
};

/* ---------------------------------------------------------------- contas e pagamento */

const BILL_CFG: Cfg = {
  kind: 'bills', path: '/bills', label: 'contas', pick: (d) => d.bill,
  body: (b) => M.billBody(b), create: M.billCreate,
  skip: (b) => b._via === 'pay' || !!b._pay, // o fluxo de pagamento cuida deles
  // a API não aceita "paga" na criação: se já nasceu paga, completa com um PUT
  after: async (b) => { if (b.paid) await api.put(`/bills/${b.sid}`, M.billBody(b)); },
};

async function syncBills(fails: string[]) {
  const { S } = cx();
  // 1) pagamentos pedidos na tela
  for (const b of [...S.bills] as Any[]) {
    if (!b._pay) continue;
    try { await payBill(b); } catch (e) { fails.push(`pagamento de "${b.n}": ${apiError(e)}`); }
    delete b._pay;
  }
  // 2) o restante (novas contas, edições, exclusões, "desfazer pagamento")
  await syncList(BILL_CFG, fails);
}

async function payBill(b: Any) {
  const { S } = cx();
  const snap = snaps.bills;
  if (!b.sid) { // a conta ainda nem existia no servidor
    const r = await api.post('/bills', M.billCreate(b));
    b.sid = r.data.bill.id;
  }
  if (b._pay.l) {
    // 1) grava edições (ex.: categoria escolhida no pagamento) ainda como "em aberto"
    await api.put(`/bills/${b.sid}`, M.billBody(b, { unpaid: true }));
    // 2) o servidor paga: cria a transação "Pago: …" e, se for parcelada/mensal, a próxima conta
    const { data } = await api.post(`/bills/${b.sid}/pay`, { paidAmount: b.pv ?? b.v, date: M.noon(b.paidAt) });
    snap.set(b.id, { sid: b.sid, json: JSON.stringify(M.billBody(b)), item: b });

    const tx = S.tx.find((x: Any) => x.id === b.tid);
    if (tx) {
      tx.sid = data.transaction.id;
      delete tx._via;
      snaps.tx.set(tx.id, { sid: tx.sid, json: JSON.stringify(M.txBody(tx)), item: tx });
    }
    const nb = S.bills.find((x: Any) => x.id === b.nx), sn = data.nextBill;
    if (nb && sn) {
      Object.assign(nb, M.billFromApi(sn)); // usa os dados que o servidor calculou (data, parcela…)
      delete nb._via;
      snap.set(nb.id, { sid: nb.sid, json: JSON.stringify(M.billBody(nb)), item: nb });
    } else if (nb) {
      delete nb._via; // o servidor não criou: segue como conta nova comum
    } else if (sn) {
      const created = { id: ++S.nid, ...M.billFromApi(sn) };
      S.bills.push(created);
      b.nx = created.id;
      snap.set(created.id, { sid: created.sid, json: JSON.stringify(M.billBody(created)), item: created });
    }
  } else {
    // "não lançar nas despesas": só marca a conta como paga (a próxima conta, se houver, sai pelo envio normal)
    await api.put(`/bills/${b.sid}`, M.billBody(b));
    snap.set(b.id, { sid: b.sid, json: JSON.stringify(M.billBody(b)), item: b });
  }
}

/* ---------------------------------------------------------------- metas e aportes */

async function syncGoals(fails: string[]) {
  const { S } = cx();
  const snap = snaps.goals;
  const live = new Set<number>();
  for (const g of [...S.goals] as Any[]) {
    if (g.id == null) g.id = ++S.nid;
    live.add(g.id);
    g.h = g.h || [];
    try {
      if (!g.sid) {
        // o "já guardei" inicial vai na criação; aportes ainda pendentes entram depois como aportes
        const pending = g.h.filter((x: Any) => !x.cid).reduce((a: number, x: Any) => a + x.v, 0);
        const initial = Math.max(0, M.round2(g.a - pending));
        const r = await api.post('/goals', { ...M.goalBody(g), currentAmount: initial });
        g.sid = r.data.goal.id;
        srvGoalA.set(g.sid, initial);
        snap.set(g.id, { sid: g.sid, json: JSON.stringify(M.goalBody(g)), item: g });
      }
      for (const h of g.h) {
        if (h.cid) continue;
        const r = await api.post(`/goals/${g.sid}/contributions`, { amount: h.v, date: M.noon(h.dt) });
        h.cid = r.data.contribution.id;
        srvGoalA.set(g.sid, Number(r.data.updatedGoal.currentAmount));
      }
      const json = JSON.stringify(M.goalBody(g)), ent = snap.get(g.id);
      if (!ent) snap.set(g.id, { sid: g.sid, json, item: g });
      else if (ent.json !== json) {
        // sempre manda o valor atual do servidor: o progresso só muda por aportes (e protege APIs sem a correção do PUT)
        await api.put(`/goals/${g.sid}`, { ...M.goalBody(g), currentAmount: srvGoalA.get(g.sid) ?? g.a });
        ent.json = json;
      }
      const srv = srvGoalA.get(g.sid);
      if (srv !== undefined && Math.abs(srv - g.a) > 0.004 && g.h.every((x: Any) => x.cid)) g.a = srv;
    } catch (e) { fails.push(`metas: ${apiError(e)}`); }
  }
  for (const [id, ent] of [...snap]) {
    if (live.has(id)) continue;
    try {
      await api.delete(`/goals/${ent.sid}`);
      ent.item.sid = undefined;
      snap.delete(id);
    } catch (e) { fails.push(`metas: ${apiError(e)}`); }
  }
}

/* ---------------------------------------------------------------- carteira (operações) */

const validatedTickers = new Set<string>();

/** A operação só é lançada nas transações se a transação ainda existir na tela. */
const opLaunch = (o: Any): boolean => cx().S.tx.some((t: Any) => t.id === o.tid);
/** O que identifica uma correção: quantidade, preço e data. (`o._re` marca a mudança só do lançamento nas transações.) */
const opSnap = (o: Any) => JSON.stringify({ q: o.q, p: o.p, dt: o.dt });

/** Adota a transação (receita da venda / despesa da compra) que o servidor criou/atualizou/apagou por causa da operação. */
function adoptSaleTx(o: Any, srv: Any, deletedSid?: string | null) {
  const { S } = cx();
  let local: Any = S.tx.find((t: Any) => t.id === o.tid);
  if (srv) {
    const mapped = M.txFromApi(srv);
    if (local) Object.assign(local, mapped);
    else { local = { id: ++S.nid, ...mapped }; S.tx.push(local); o.tid = local.id; }
    delete local._via;
    snaps.tx.set(local.id, { sid: local.sid, json: JSON.stringify(M.txBody(local)), item: local });
    return;
  }
  if (deletedSid) for (const [id, ent] of [...snaps.tx]) if (ent.sid === deletedSid) snaps.tx.delete(id);
  if (local?._via === 'sell') delete local._via; // o servidor não lançou: segue como transação comum (envio normal)
}

async function syncOps(fails: string[]) {
  const { S } = cx();
  const pending = (S.ops as Any[]).filter((o) => !o.sid).sort((a, b) => a.id - b.id);
  const edited = (S.ops as Any[]).filter((o) => o.sid && opSnaps.has(o.id) && (o._re || opSnaps.get(o.id) !== opSnap(o)));
  if (!pending.length && !edited.length) return;
  let posted = false, corrected = false;

  // 1) operações novas
  for (const o of pending) {
    try {
      const t = M.strip(o.t);
      if (o.tp === 'Compra' && !srvStocks.has(t) && !validatedTickers.has(t)) {
        // ticker novo: confere se existe antes de registrar (ticker inexistente não volta no lote)
        const found = await fetchQuotes([t]).catch(() => []);
        if (!found.length) throw new Error(`Ativo ${t} não encontrado no Yahoo Finance`);
        applyQuotes(found);
        validatedTickers.add(t);
      }
      const { data } = await api.post('/stock-operations', M.opBody(o, opLaunch(o)));
      o.sid = data.operation.id;
      o.rp = data.operation.realizedPnL == null ? null : Number(data.operation.realizedPnL);
      adoptSaleTx(o, data.transaction);
      opSnaps.set(o.id, opSnap(o));
      posted = true;
    } catch (e) { fails.push(`operações: ${apiError(e)}`); }
  }

  // 2) operações corrigidas na tela (quantidade, preço, data): o servidor recalcula carteira, lucros e a receita da venda
  for (const o of edited) {
    try {
      const { data } = await api.put(`/stock-operations/${o.sid}`, M.opEditBody(o, opLaunch(o)));
      o.rp = data.operation.realizedPnL == null ? null : Number(data.operation.realizedPnL);
      for (const a of (data.affected ?? []) as Any[]) {
        const x = (S.ops as Any[]).find((y) => y.sid === a.id);
        if (x) x.rp = Number(a.realizedPnL);
      }
      adoptSaleTx(o, data.transaction, data.deletedTransactionId);
      opSnaps.set(o.id, opSnap(o));
      delete o._re;
      posted = corrected = true;
    } catch (e) { fails.push(`operações: ${apiError(e)}`); }
  }

  if (!posted) return;
  await refreshStocksFromServer();
  if (!(S.ops as Any[]).some((o) => !o.sid)) {
    S.real = (S.ops as Any[]).filter((o) => o.tp === 'Venda').reduce((a, o) => a + (o.rp ?? 0), 0);
  }
  if (corrected) cx().render(); // a posição e os lucros mudaram no servidor: redesenha
}

/** Depois de registrar operações, o servidor é quem sabe a posição e o preço médio de cada ativo. */
async function refreshStocksFromServer() {
  const { S } = cx();
  const { data } = await api.get('/stocks');
  srvStocks = new Map();
  const quotes: Quote[] = [];
  const unsynced = new Set((S.ops as Any[]).filter((o) => !o.sid).map((o) => M.strip(o.t)));
  const byT = new Map<string, Any>((S.stocks as Any[]).map((s) => [s.t, s]));
  for (const r of data as Any[]) {
    const t = M.strip(r.ticker);
    srvStocks.set(t, { sid: r.id, q: Number(r.quantity), pm: Number(r.averagePrice) });
    if (r.currentPrice) quotes.push({ ticker: t, price: Number(r.currentPrice), prev: r.previousClose ? Number(r.previousClose) : null });
    if (stockMissingSince.has(t) || unsynced.has(t)) continue; // removido agora na tela / ainda tem operação por enviar
    const cur = byT.get(t);
    if (cur) Object.assign(cur, { q: Number(r.quantity), pm: Number(r.averagePrice) });
    else S.stocks.push({ id: ++S.nid, t, q: Number(r.quantity), pm: Number(r.averagePrice) });
  }
  applyQuotes(quotes);
}

/** "Remover da carteira" na tela: espera o prazo do "Desfazer" e então apaga a posição (o histórico fica). */
async function syncStockRemoval(fails: string[]) {
  const { S } = cx();
  const local = new Set((S.stocks as Any[]).map((s) => s.t));
  let wait = false;
  for (const [t, srv] of [...srvStocks]) {
    if (local.has(t)) { stockMissingSince.delete(t); continue; }
    const since = stockMissingSince.get(t) ?? Date.now();
    stockMissingSince.set(t, since);
    if (Date.now() - since < STOCK_UNDO_MS) { wait = true; continue; }
    try {
      await api.delete(`/stocks/${srv.sid}`);
      srvStocks.delete(t);
      stockMissingSince.delete(t);
    } catch (e) { fails.push(`carteira: ${apiError(e)}`); }
  }
  if (wait) setTimeout(scheduleSync, STOCK_UNDO_MS + 100);
}

/* ---------------------------------------------------------------- orçamento e configurações */

async function syncBudgets(fails: string[]) {
  const { S } = cx();
  for (const c of S.cl as Any[]) {
    if (!c.sid) continue; // a categoria ainda não foi criada (falhou): o reload cuida
    const want = M.round2(Number(S.budget[c.n]));
    if (!Number.isFinite(want) || want < 0) continue;
    const have = srvBudget.get(c.sid);
    if (have !== undefined && Math.abs(have - want) < 0.005) continue;
    try {
      await api.post('/budgets', { categoryId: c.sid, month: monthNow(), limitAmount: want });
      srvBudget.set(c.sid, want);
    } catch (e) { fails.push(`orçamento: ${apiError(e)}`); }
  }
}

async function syncConfig(fails: string[]) {
  const { S } = cx();
  const body: Any = {};
  const ip = M.round2(Number(S.ip));
  if (Number.isFinite(ip) && ip >= 0 && ip !== srvConfig.ip) body.expectedIncome = ip;
  const r = (S.rule as number[]).map(Number);
  const valid = r.length === 3 && r.every((x) => Number.isInteger(x) && x >= 0 && x <= 100) && r[0] + r[1] + r[2] === 100;
  // enquanto a soma não fecha 100 (usuário ainda digitando), mantém só na tela
  if (valid && r.some((x, i) => x !== srvConfig.rule[i])) Object.assign(body, { ruleNecessity: r[0], ruleWants: r[1], ruleFuture: r[2] });
  if (!Object.keys(body).length) return;
  try {
    await api.put('/users/config', body);
    if (body.expectedIncome !== undefined) srvConfig.ip = body.expectedIncome;
    if (body.ruleNecessity !== undefined) srvConfig.rule = r;
  } catch (e) { fails.push(`configurações: ${apiError(e)}`); }
}
