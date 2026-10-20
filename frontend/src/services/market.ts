/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from './api';
import { cx } from '../lib/cx';
import { day, round2, strip } from './mappers';

/**
 * Dados de mercado reais (Yahoo Finance via API):
 *  - cotações em lote (carteira, alertas e o que aparece na tela)
 *  - catálogo / busca de ativos (preço, setor, DY, P/L, ROE, beta)
 *  - histórico de preços (gráficos, médias móveis, RSI, volatilidade)
 * Tudo é guardado nas mesmas estruturas que o script legado usa (QT, OQ, CAT, SEC, LH).
 */

export type Kind = 'acao' | 'fii' | 'etf';
export interface CatItem {
  t: string; name: string; kind: Kind; sector: string;
  price: number; prev: number; dy: number; pe: number; roe: number; beta: number;
}

/** Tipo de cada ativo conhecido (ação, FII ou ETF). */
export const KIND: Record<string, Kind> = {};

const SECTOR_PT: Record<string, string> = {
  Energy: 'Energia', 'Basic Materials': 'Materiais Básicos', 'Financial Services': 'Financeiro', Industrials: 'Industrial',
  'Consumer Defensive': 'Consumo Defensivo', 'Consumer Cyclical': 'Consumo Cíclico', Utilities: 'Utilidades',
  Healthcare: 'Saúde', 'Real Estate': 'Imobiliário', Technology: 'Tecnologia', 'Communication Services': 'Comunicação',
};
export const sectorLabel = (kind: Kind, sector?: string) =>
  kind === 'etf' ? 'ETF' : kind === 'fii' ? 'FIIs' : SECTOR_PT[sector || ''] || (sector && sector !== 'Desconhecido' ? sector : 'Outros');

const sa = (t: string) => (t.includes('.') ? t : `${t}.SA`);

/* ---------- cotações ---------- */

export interface Quote { ticker: string; name?: string; price: number; prev: number | null }

/** Cotações em lote (a API aceita até 30 por chamada). */
export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  const out: Quote[] = [];
  const list = [...new Set(tickers.map(strip))];
  for (let i = 0; i < list.length; i += 30) {
    const chunk = list.slice(i, i + 30);
    const { data } = await api.get('/stocks/quotes', { params: { tickers: chunk.join(',') } });
    for (const q of data as any[]) {
      const price = Number(q.regularMarketPrice);
      if (!price) continue;
      out.push({ ticker: strip(q.ticker), name: q.shortName, price, prev: q.previousClose ? Number(q.previousClose) : null });
    }
  }
  return out;
}

export function applyQuotes(quotes: Quote[]) {
  const { QT, OQ } = cx();
  quotes.forEach((q) => {
    QT[q.ticker] = q.price;
    if (q.prev) OQ[q.ticker] = q.prev;
    else OQ[q.ticker] = OQ[q.ticker] || q.price;
    quoteAt[q.ticker] = Date.now();
  });
}

const quoteAt: Record<string, number> = {};

/** Atualiza a cotação da carteira e dos alertas (a cada 60 s e no botão "Atualizar"). */
export async function refreshQuotes() {
  const { S, tick } = cx();
  const ts = [...new Set<string>([...S.stocks.map((x: any) => x.t), ...S.watch.map((w: any) => w.t)])];
  if (ts.length) {
    try { applyQuotes(await fetchQuotes(ts)); } catch (e) { console.warn('Falha ao atualizar cotações:', e); }
  }
  tick();
}

/** Garante cotação recente para os tickers que aparecem na tela (cache de 60 s por ativo). */
export async function ensureQuotes(tickers: string[], maxAge = 60_000): Promise<boolean> {
  const stale = [...new Set(tickers.map(strip))].filter((t) => !quoteAt[t] || Date.now() - quoteAt[t] > maxAge);
  if (!stale.length) return false;
  stale.forEach((t) => { quoteAt[t] = Date.now(); }); // marca antes: evita buscar de novo enquanto espera
  try { applyQuotes(await fetchQuotes(stale)); return true; } catch { return false; }
}

/* ---------- catálogo ---------- */

const CATALOG_TTL = 5 * 60_000;
const catalogCache = new Map<string, { at: number; items: CatItem[] }>();
const catalogInflight = new Map<string, Promise<CatItem[]>>();

function fillCatalog(items: CatItem[]) {
  const { CAT, SEC, QT, OQ } = cx();
  items.forEach((i) => {
    CAT[i.t] = [i.name, i.sector, i.price, i.dy, i.pe, i.roe, i.beta];
    SEC[i.t] = i.sector;
    KIND[i.t] = i.kind;
    QT[i.t] = i.price;
    OQ[i.t] = i.prev || i.price;
    quoteAt[i.t] = Date.now();
  });
}

/** Busca no catálogo da B3 (texto vazio = lista inicial de ativos populares). */
export function catalogSearch(q: string): Promise<CatItem[]> {
  const key = q.trim().toLowerCase();
  const hit = catalogCache.get(key);
  if (hit && Date.now() - hit.at < CATALOG_TTL) return Promise.resolve(hit.items);
  const running = catalogInflight.get(key);
  if (running) return running;
  const p = api
    .get('/stocks/catalog', { params: key ? { q: q.trim() } : {} })
    .then(({ data }) => {
      const items: CatItem[] = (data as any[]).map((r) => {
        const kind: Kind = r.kind === 'etf' ? 'etf' : r.kind === 'fii' ? 'fii' : 'acao';
        return {
          t: strip(r.ticker), name: r.shortName || strip(r.ticker), kind, sector: sectorLabel(kind, r.sector),
          price: Number(r.regularMarketPrice) || 0, prev: Number(r.previousClose) || 0,
          dy: Number(r.dividendYield) || 0, pe: Number(r.peRatio) || 0, roe: Number(r.roe) || 0, beta: Number(r.beta) || 0,
        };
      }).filter((i) => i.price > 0);
      fillCatalog(items);
      catalogCache.set(key, { at: Date.now(), items });
      return items;
    })
    .finally(() => catalogInflight.delete(key));
  catalogInflight.set(key, p);
  return p;
}

/* ---------- histórico ---------- */

const histInflight = new Map<string, Promise<boolean>>();
const histFailed = new Map<string, number>();

/** Histórico diário (2 anos) do ativo: alimenta gráficos, médias móveis, RSI e volatilidade. */
export function loadHistory(ticker: string): Promise<boolean> {
  const t = strip(ticker);
  const { LH } = cx();
  if (LH[t]) return Promise.resolve(false);
  if ((histFailed.get(t) ?? 0) > Date.now() - 60_000) return Promise.resolve(false);
  const running = histInflight.get(t);
  if (running) return running;
  const p = api
    .get(`/stocks/${encodeURIComponent(sa(t))}/history`, { params: { range: '2y' } })
    .then(({ data }) => {
      const seen = new Set<string>();
      const rows = (data as any[])
        .filter((r) => r.close != null && Number(r.close) > 0)
        .map((r) => ({ d: day(r.date), p: round2(Number(r.close)) }))
        .filter((r) => (seen.has(r.d) ? false : (seen.add(r.d), true)));
      if (rows.length < 30) throw new Error('histórico curto');
      LH[t] = rows;
      return true;
    })
    .catch(() => { histFailed.set(t, Date.now()); return false; })
    .finally(() => histInflight.delete(t));
  histInflight.set(t, p);
  return p;
}

/** Carrega tudo que a análise de um ativo precisa (cotação, fundamentos e histórico). */
export async function loadTicker(ticker: string): Promise<boolean> {
  const t = strip(ticker);
  const { CAT } = cx();
  await Promise.allSettled([CAT[t] ? ensureQuotes([t]) : catalogSearch(t), loadHistory(t)]);
  const { QT } = cx();
  return !!QT[t];
}
