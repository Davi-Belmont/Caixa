import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

// Lista inicial do catálogo (aba "Explorar" sem busca)
const DEFAULT_CATALOG = [
  'PETR4.SA', 'VALE3.SA', 'ITUB4.SA', 'BBDC4.SA', 'ABEV3.SA', 'WEGE3.SA', 'BBAS3.SA',
  'HGLG11.SA', 'MXRF11.SA', 'BOVA11.SA',
];

type Fundamentals = { sector: string; industry: string; dividendYield: number; peRatio: number; roe: number; beta: number };
const FUNDAMENTALS_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const fundamentalsCache = new Map<string, { at: number; data: Fundamentals }>();

// Cotações de vários símbolos numa chamada só; se o lote falhar, tenta um a um.
async function fetchQuotesMap(symbols: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  try {
    const result: any = await yahooFinance.quote(symbols);
    (Array.isArray(result) ? result : [result]).forEach((q: any) => q?.symbol && map.set(q.symbol, q));
  } catch {
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const q: any = await yahooFinance.quote(sym);
          if (q) map.set(q.symbol || sym, q);
        } catch { /* ativo sem cotação: fica de fora */ }
      }),
    );
  }
  return map;
}

// Fundamentos do ativo (setor, P/L, ROE, beta, dividend yield) com cache em memória.
async function getFundamentals(symbol: string, quote: any): Promise<Fundamentals> {
  const hit = fundamentalsCache.get(symbol);
  if (hit && Date.now() - hit.at < FUNDAMENTALS_TTL_MS) return hit.data;

  let summary: any = null;
  try {
    summary = await yahooFinance.quoteSummary(symbol, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
    });
  } catch {
    summary = null;
  }

  const sd = summary?.summaryDetail ?? {};
  const ks = summary?.defaultKeyStatistics ?? {};
  const fd = summary?.financialData ?? {};
  const ap = summary?.assetProfile ?? {};

  const pe = sd.trailingPE ?? quote?.trailingPE ?? ks.forwardPE ?? 0;
  const dy = sd.dividendYield ?? quote?.trailingAnnualDividendYield ?? 0;

  const data: Fundamentals = {
    sector: ap.sector || 'Desconhecido',
    industry: ap.industry || 'Desconhecido',
    dividendYield: dy ? dy * 100 : 0,
    peRatio: pe > 0 ? pe : 0,
    roe: fd.returnOnEquity ? fd.returnOnEquity * 100 : 0,
    beta: sd.beta ?? ks.beta ?? quote?.beta ?? 0,
  };

  if (summary) fundamentalsCache.set(symbol, { at: Date.now(), data }); // só guarda se a consulta deu certo
  return data;
}

export class StockController {
  // Criar registo de ação na carteira (com normalização automática do ticker / .SA)
async create(req: Request, res: Response) {
    try {
      const { ticker, quantity, averagePrice } = req.body;
      const userId = req.user!.id;

      if (!ticker || quantity === undefined || averagePrice === undefined) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (ticker, quantity, averagePrice)' });
      }

const numQuantity = Number(quantity);
      // Validação estrita: quantity é Int no banco de dados
      if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
        return res.status(400).json({ error: 'A quantidade deve ser um número inteiro superior a zero' });
      }

      const numAveragePrice = Number(averagePrice);
      if (numAveragePrice <= 0) {
        return res.status(400).json({ error: 'O preço médio deve ser superior a zero' });
      }

      const upperTicker = ticker.toUpperCase().trim();
      let finalTicker = upperTicker;

      // Validação do ativo no Yahoo Finance
      let quote: any = null;
      if (!upperTicker.includes('.')) {
        try {
          quote = await yahooFinance.quote(`${upperTicker}.SA`);
          if (quote) finalTicker = `${upperTicker}.SA`;
        } catch {
          try {
            quote = await yahooFinance.quote(upperTicker);
          } catch {
            quote = null;
          }
        }
      } else {
        try {
          quote = await yahooFinance.quote(upperTicker);
        } catch {
          quote = null;
        }
      }

      if (!quote) {
        return res.status(404).json({ error: 'Ativo não encontrado no Yahoo Finance. Verifique o ticker.' });
      }

// Executa a transação atómica no Prisma: atualiza/cria a posição na carteira e regista a operação de compra
      const result = await prisma.$transaction(async (tx) => {
        // 1. Regista a operação de compra no histórico
        await tx.stockOperation.create({
          data: {
            ticker: finalTicker,
            type: 'BUY',
            quantity: numQuantity,
            price: numAveragePrice,
            userId,
          },
        });

        // 2. Verifica se o ativo já existe na carteira do utilizador (usar 'stock' em minúscula)
        const existingStock = await tx.stock.findFirst({
          where: { ticker: finalTicker, userId },
        });

        let savedStock;
        if (existingStock) {
          // Recalcula o preço médio ponderado
          const totalQty = existingStock.quantity + numQuantity;
          const totalCost = (existingStock.quantity * existingStock.averagePrice) + (numQuantity * numAveragePrice);
          const newAvgPrice = totalCost / totalQty;

          savedStock = await tx.stock.update({
            where: { id: existingStock.id },
            data: {
              quantity: totalQty,
              averagePrice: newAvgPrice,
            },
          });
        } else {
          savedStock = await tx.stock.create({
            data: {
              ticker: finalTicker,
              quantity: numQuantity,
              averagePrice: numAveragePrice,
              userId,
            },
          });
        }

        return savedStock;
      });

      return res.status(201).json({
        message: 'Ativo adicionado à carteira e operação registada com sucesso! 📈',
        stock: result,
      });
    } catch (error) {
      console.error('ERRO AO CRIAR STOCK:', error);
      return res.status(500).json({ error: 'Erro interno ao criar ativo' });
    }
  }

 // Listar ativos do usuário com cotação atual, fechamento anterior e variação em tempo real
  async listByUser(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const stocks = await prisma.stock.findMany({
        where: { userId },
      });

      // Busca a cotação atual e dados de mercado de cada ativo em paralelo usando o Yahoo Finance
      const enrichedStocks = await Promise.all(
        stocks.map(async (stock) => {
          let quote: any = null;
          try {
            try {
              quote = await yahooFinance.quote(stock.ticker);
            } catch (err) {
              if (!stock.ticker.includes('.')) {
                quote = await yahooFinance.quote(`${stock.ticker}.SA`);
              } else {
                throw err;
              }
            }

            if (Array.isArray(quote)) quote = quote[0];

            const currentPrice = quote?.regularMarketPrice ?? quote?.currentPrice ?? stock.averagePrice;
            const previousClose = quote?.regularMarketPreviousClose ?? quote?.previousClose ?? currentPrice;
            const changePercent = quote?.regularMarketChangePercent ?? quote?.marketChangePercent ?? 0;
            
            const totalInvested = stock.quantity * stock.averagePrice;
            const currentTotalValue = stock.quantity * currentPrice;
            const variation = currentTotalValue - totalInvested;
            const variationPercentage = totalInvested > 0 ? (variation / totalInvested) * 100 : 0;

            return {
              ...stock,
              currentPrice,
              previousClose,
              changePercent,
              currentTotalValue,
              variation,
              variationPercentage,
            };
          } catch (err) {
            return {
              ...stock,
              currentPrice: null,
              previousClose: null,
              changePercent: 0,
              currentTotalValue: stock.quantity * stock.averagePrice,
              variation: 0,
              variationPercentage: 0,
            };
          }
        })
      );

      return res.json(enrichedStocks);
    } catch (error) {
      console.error('ERRO AO LISTAR STOCKS:', error);
      return res.status(500).json({ error: 'Erro interno ao listar ativos' });
    }
  }
  // Pesquisar cotação de um ativo em tempo real pelo ticker (com prioridade para .SA)
  async searchTicker(req: Request, res: Response) {
    try {
      const rawTicker = req.params.ticker as string;

      if (!rawTicker) {
        return res.status(400).json({ error: 'O parâmetro ticker é obrigatório' });
      }

      const upperTicker = rawTicker.toUpperCase();
      let quote: any = null;
      let symbolToSearch = upperTicker;

      if (!upperTicker.includes('.')) {
        try {
          symbolToSearch = `${upperTicker}.SA`;
          quote = await yahooFinance.quote(symbolToSearch);
        } catch (err) {
          symbolToSearch = upperTicker;
          quote = await yahooFinance.quote(symbolToSearch);
        }
      } else {
        quote = await yahooFinance.quote(symbolToSearch);
      }

      if (Array.isArray(quote)) {
        quote = quote[0];
      }

      if (!quote || !quote.symbol) {
        return res.status(404).json({ error: 'Ativo não encontrado no Yahoo Finance' });
      }

      return res.json({
        ticker: quote.symbol,
        shortName: quote.shortName || quote.longName || upperTicker,
        regularMarketPrice: quote.regularMarketPrice ?? quote.currentPrice ?? 0,
        regularMarketChange: quote.regularMarketChange ?? 0,
        regularMarketChangePercent: quote.regularMarketChangePercent ?? 0,
        currency: quote.currency || 'BRL',
      });
    } catch (error) {
      console.error('ERRO AO PESQUISAR TICKER:', error);
      return res.status(500).json({ error: 'Erro ao buscar cotação do ativo. Verifique se o ticker é válido.' });
    }
  }

// Remover ativo da carteira. O histórico de operações (e o resultado realizado) é preservado.
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const stock = await prisma.stock.findFirst({
        where: { id: String(id), userId }
      });

      if (!stock) {
        return res.status(404).json({ error: 'Ativo não encontrado na carteira' });
      }

      await prisma.stock.delete({ where: { id: String(id) } });

      return res.status(204).send();
    } catch (error) {
      console.error('ERRO AO REMOVER STOCK:', error);
      return res.status(500).json({ error: 'Erro ao remover ativo da carteira' });
    }
  }

  // Atualizar ativo na carteira com validação rigorosa de inteiros e decimais
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { quantity, averagePrice } = req.body;

      const stockExists = await prisma.stock.findFirst({
        where: { id: String(id), userId }
      });

      if (!stockExists) {
        return res.status(404).json({ error: 'Ativo não encontrado na carteira' });
      }

      const updateData: any = {};

      if (quantity !== undefined) {
        const numQuantity = Number(quantity);
        // Validação estrita para o PUT também[cite: 1]
        if (!Number.isInteger(numQuantity) || numQuantity <= 0) {
          return res.status(400).json({ error: 'A quantidade deve ser um número inteiro superior a zero' });
        }
        updateData.quantity = numQuantity;
      }

      if (averagePrice !== undefined) {
        const numPrice = Number(averagePrice);
        if (numPrice <= 0) {
          return res.status(400).json({ error: 'O preço médio deve ser superior a zero' });
        }
        updateData.averagePrice = numPrice;
      }

      const updatedStock = await prisma.stock.update({
        where: { id: String(id) },
        data: updateData,
      });

      return res.json({
        message: 'Ativo atualizado com sucesso! 📈',
        stock: updatedStock,
      });
    } catch (error) {
      console.error('ERRO AO ATUALIZAR STOCK:', error);
      return res.status(500).json({ error: 'Erro interno ao atualizar ativo' });
    }
  }

// Buscar histórico de preços de um ativo para gráficos e análises
  async getHistory(req: Request, res: Response) {
    try {
      const ticker = String(req.params.ticker);
      const range = (req.query.range as string) || '1y';

      if (!ticker || ticker === 'undefined') {
        return res.status(400).json({ error: 'O parâmetro ticker é obrigatório' });
      }

      const upperTicker = ticker.toUpperCase();
      
      const today = new Date();
      const period1Date = new Date();

      switch (range.toLowerCase()) {
        case '1m':
          period1Date.setMonth(today.getMonth() - 1);
          break;
        case '3m':
          period1Date.setMonth(today.getMonth() - 3);
          break;
        case '6m':
          period1Date.setMonth(today.getMonth() - 6);
          break;
        case '1y':
          period1Date.setFullYear(today.getFullYear() - 1);
          break;
        case '2y':
          period1Date.setFullYear(today.getFullYear() - 2);
          break;
        case '5y':
          period1Date.setFullYear(today.getFullYear() - 5);
          break;
        default:
          period1Date.setFullYear(today.getFullYear() - 1);
      }

      let historicalData: any = null;
      let symbolToSearch = upperTicker;

      // Intervalo fixado em '1d' para garantir total compatibilidade com o yahoo-finance2
      const queryOptions: any = {
        period1: period1Date,
        period2: today,
        interval: '1d',
      };

      try {
        historicalData = await yahooFinance.historical(symbolToSearch, queryOptions);
      } catch (err) {
        if (!upperTicker.includes('.')) {
          symbolToSearch = `${upperTicker}.SA`;
          historicalData = await yahooFinance.historical(symbolToSearch, queryOptions);
        } else {
          throw err;
        }
      }

      if (!historicalData || historicalData.length === 0) {
        return res.status(404).json({ error: 'Nenhum histórico encontrado para este ativo' });
      }

      const formattedHistory = historicalData.map((item: any) => ({
        date: item.date,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
      }));

      return res.json(formattedHistory);
    } catch (error) {
      console.error('ERRO AO BUSCAR HISTÓRICO DO ATIVO:', error);
      return res.status(500).json({ error: 'Erro ao buscar histórico de preços. Verifique o ticker.' });
    }
  }

// Catálogo de ativos da B3 (.SA): busca por texto; com `q` vazio devolve uma lista inicial de ativos populares.
  // Preços vêm de UMA chamada em lote; os fundamentos (setor, P/L, ROE, beta, DY) mudam devagar e ficam em cache.
  async catalog(req: Request, res: Response) {
    try {
      const query = String(req.query.q ?? '').trim();

      let symbols: string[];
      if (!query) {
        symbols = DEFAULT_CATALOG;
      } else {
        const searchResult = await yahooFinance.search(query);
        const quotes = searchResult.quotes || [];

        // Só ações/ETFs/FIIs listados na B3
        symbols = quotes
          .filter((q: any) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && q.symbol.endsWith('.SA'))
          .slice(0, 10)
          .map((q: any) => q.symbol as string);

        // Digitou um ticker direto (ex.: PETR4) e a busca textual não achou nada
        if (symbols.length === 0 && !query.includes('.')) {
          symbols = [`${query.toUpperCase()}.SA`];
        }
      }

      if (symbols.length === 0) return res.json([]);

      const quoteBySymbol = await fetchQuotesMap(symbols);

      const items = await Promise.all(
        symbols.map(async (symbol) => {
          const quote = quoteBySymbol.get(symbol);
          if (!quote) return null;
          const f = await getFundamentals(symbol, quote);
          const price = quote.regularMarketPrice ?? quote.currentPrice ?? 0;
          return {
            ticker: quote.symbol || symbol,
            shortName: quote.shortName || quote.longName || symbol,
            kind: quote.quoteType === 'ETF' ? 'etf' : /11\.SA$/.test(symbol) ? 'fii' : 'acao',
            sector: f.sector,
            industry: f.industry,
            regularMarketPrice: price,
            previousClose: quote.regularMarketPreviousClose ?? quote.previousClose ?? price,
            regularMarketChangePercent: quote.regularMarketChangePercent ?? quote.marketChangePercent ?? 0,
            currency: quote.currency || 'BRL',
            dividendYield: f.dividendYield,
            peRatio: f.peRatio,
            roe: f.roe,
            beta: f.beta,
          };
        }),
      );

      return res.json(items.filter(Boolean));
    } catch (error) {
      console.error('ERRO NO CATÁLOGO DE AÇÕES:', error);
      return res.status(500).json({ error: 'Erro ao pesquisar catálogo de ativos.' });
    }
  }

  // Buscar cotações em lote de forma otimizada para múltiplos ativos
  async getQuotesBatch(req: Request, res: Response) {
    try {
      const { tickers } = req.query;

      if (!tickers || typeof tickers !== 'string') {
        return res.status(400).json({ error: 'Parâmetro "tickers" é obrigatório e deve ser uma string separada por vírgulas.' });
      }

      // Separa os tickers e garante a normalização automática (adicionando .SA se necessário)
      const tickerList = tickers
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 30) // protege o Yahoo Finance de pedidos enormes
        .map((t) => (t.includes('.') ? t : `${t}.SA`));

      if (tickerList.length === 0) {
        return res.json([]);
      }

      // Utiliza o yahoo-finance2 para buscar todos de uma vez (ou com tratamento individual seguro)
      const results = await Promise.all(
        tickerList.map(async (ticker) => {
          try {
            let quote: any = null;
            try {
              quote = await yahooFinance.quote(ticker);
            } catch (err) {
              // Fallback: se falhar com .SA, tenta sem o .SA
              if (ticker.endsWith('.SA')) {
                const rawTicker = ticker.replace('.SA', '');
                quote = await yahooFinance.quote(rawTicker);
              } else {
                throw err;
              }
            }

            if (Array.isArray(quote)) quote = quote[0];
            if (!quote) return { ticker, error: 'Ativo não encontrado' };

            const currentPrice = quote.regularMarketPrice ?? quote.currentPrice ?? 0;
            const previousClose = quote.regularMarketPreviousClose ?? quote.previousClose ?? currentPrice;
            const changePercent = quote.regularMarketChangePercent ?? quote.marketChangePercent ?? 0;

            return {
              ticker: quote.symbol || ticker,
              shortName: quote.shortName || quote.longName || ticker,
              regularMarketPrice: currentPrice,
              previousClose,
              changePercent,
              currency: quote.currency || 'BRL',
            };
          } catch (err) {
            return { ticker, error: 'Não foi possível obter cotação' };
          }
        })
      );

      return res.json(results);
    } catch (error) {
      console.error('Erro ao buscar cotações em lote:', error);
      return res.status(500).json({ error: 'Erro interno ao processar cotações em lote.' });
    }
  }
}