import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Habilita .openapi() antes de criar os schemas deste arquivo (não depende da ordem de import do swagger.ts)
extendZodWithOpenApi(z);

/** Rotas que não estavam documentadas: autenticação, pagamento de contas, aportes, ações, operações e configurações. */
export const extraRegistry = new OpenAPIRegistry();

const auth = [{ bearerAuth: [] }];
const idParam = [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' as const } }];
const json = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });

/* ---------- Autenticação ---------- */
extraRegistry.registerPath({
  method: 'post', path: '/auth/register', tags: ['Autenticação'],
  summary: 'Cadastrar usuário (cria também as categorias padrão e as configurações)',
  request: { body: json(z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) })) },
  responses: { 201: { description: 'Usuário cadastrado' }, 400: { description: 'Dados inválidos ou e-mail já cadastrado' } },
});
extraRegistry.registerPath({
  method: 'post', path: '/auth/login', tags: ['Autenticação'],
  summary: 'Entrar (devolve o token JWT e o usuário)',
  request: { body: json(z.object({ email: z.string().email(), password: z.string() })) },
  responses: { 200: { description: 'Login realizado: { token, user }' }, 400: { description: 'Credenciais inválidas' } },
});
extraRegistry.registerPath({
  method: 'get', path: '/auth/me', tags: ['Autenticação'], summary: 'Dados do usuário autenticado', security: auth,
  responses: { 200: { description: 'Usuário logado' }, 401: { description: 'Token ausente ou inválido' } },
});

/* ---------- Configurações do usuário ---------- */
extraRegistry.registerPath({
  method: 'get', path: '/users/config', tags: ['Configurações'], security: auth,
  summary: 'Receita prevista e percentuais da regra 50/30/20 (cria o padrão se não existir)',
  responses: { 200: { description: '{ expectedIncome, ruleNecessity, ruleWants, ruleFuture }' } },
});
extraRegistry.registerPath({
  method: 'put', path: '/users/config', tags: ['Configurações'], security: auth,
  summary: 'Atualizar receita prevista e/ou a regra (os 3 percentuais juntos, somando 100)',
  request: {
    body: json(z.object({
      expectedIncome: z.number().min(0).optional(),
      ruleNecessity: z.number().int().optional(),
      ruleWants: z.number().int().optional(),
      ruleFuture: z.number().int().optional(),
    })),
  },
  responses: { 200: { description: 'Configurações atualizadas' }, 400: { description: 'Valores inválidos' } },
});

/* ---------- Transações ---------- */
extraRegistry.registerPath({
  method: 'get', path: '/transactions', tags: ['Transações'], security: auth,
  summary: 'Listar transações (paginado: { data, meta }) com filtros opcionais',
  request: {
    query: z.object({
      page: z.string().optional(), limit: z.string().optional().describe('Padrão 10, máximo 500'),
      from: z.string().optional().describe('YYYY-MM-DD'), to: z.string().optional().describe('YYYY-MM-DD (inclui o dia)'),
      type: z.enum(['in', 'out']).optional(), category: z.string().optional(),
    }),
  },
  responses: { 200: { description: '{ data: Transaction[], meta: { total, page, limit, totalPages } }' } },
});
extraRegistry.registerPath({
  method: 'put', path: '/transactions/{id}', tags: ['Transações'], security: auth, parameters: idParam,
  summary: 'Atualizar transação',
  request: { body: json(z.object({ description: z.string().optional(), value: z.number().optional(), type: z.enum(['in', 'out']).optional(), category: z.string().optional(), date: z.string().optional() })) },
  responses: { 200: { description: 'Transação atualizada' }, 404: { description: 'Não encontrada' } },
});
extraRegistry.registerPath({
  method: 'delete', path: '/transactions/{id}', tags: ['Transações'], security: auth, parameters: idParam,
  summary: 'Excluir transação', responses: { 204: { description: 'Excluída' }, 404: { description: 'Não encontrada' } },
});

/* ---------- Contas ---------- */
extraRegistry.registerPath({
  method: 'post', path: '/bills/{id}/pay', tags: ['Contas'], security: auth, parameters: idParam,
  summary: 'Pagar conta: gera a transação (out, valor positivo) e, se parcelada/mensal, cria a próxima conta',
  request: { body: json(z.object({ paidAmount: z.number().positive().optional(), date: z.string().optional().describe('Data do pagamento (padrão: agora)') })) },
  responses: { 200: { description: '{ message, bill, transaction, nextBill }' }, 400: { description: 'Conta já paga ou dados inválidos' }, 404: { description: 'Não encontrada' } },
});

/* ---------- Metas e aportes ---------- */
const goalParam = [{ name: 'goalId', in: 'path' as const, required: true, schema: { type: 'string' as const } }];
extraRegistry.registerPath({
  method: 'put', path: '/goals/{id}', tags: ['Metas'], security: auth, parameters: idParam, summary: 'Atualizar meta',
  request: { body: json(z.object({ title: z.string().optional(), targetAmount: z.number().optional(), currentAmount: z.number().optional(), icon: z.string().optional(), deadline: z.string().nullable().optional() })) },
  responses: { 200: { description: 'Meta atualizada' } },
});
extraRegistry.registerPath({
  method: 'delete', path: '/goals/{id}', tags: ['Metas'], security: auth, parameters: idParam, summary: 'Excluir meta',
  responses: { 204: { description: 'Excluída' } },
});
extraRegistry.registerPath({
  method: 'get', path: '/goals/{goalId}/contributions', tags: ['Metas'], security: auth, parameters: goalParam,
  summary: 'Listar aportes e retiradas da meta (GET /goals já traz os aportes de todas)',
  responses: { 200: { description: 'Lista de aportes' } },
});
extraRegistry.registerPath({
  method: 'post', path: '/goals/{goalId}/contributions', tags: ['Metas'], security: auth, parameters: goalParam,
  summary: 'Registrar aporte (valor positivo) ou retirada (valor negativo); atualiza o valor atual da meta',
  request: { body: json(z.object({ amount: z.number(), date: z.string().optional(), note: z.string().optional() })) },
  responses: { 201: { description: 'Aporte registrado' } },
});
extraRegistry.registerPath({
  method: 'delete', path: '/goals/contributions/{id}', tags: ['Metas'], security: auth, parameters: idParam,
  summary: 'Excluir aporte (desfaz o efeito no valor atual da meta)', responses: { 204: { description: 'Excluído' } },
});

/* ---------- Proventos e orçamento ---------- */
extraRegistry.registerPath({
  method: 'delete', path: '/dividends/{id}', tags: ['Proventos'], security: auth, parameters: idParam,
  summary: 'Excluir provento', responses: { 204: { description: 'Excluído' } },
});
extraRegistry.registerPath({
  method: 'get', path: '/budgets', tags: ['Orçamento'], security: auth,
  summary: 'Orçamentos do mês; categorias sem limite no mês herdam o do último mês anterior (inherited: true)',
  request: { query: z.object({ month: z.string().describe('YYYY-MM') }) },
  responses: { 200: { description: 'Lista de orçamentos' }, 400: { description: 'Mês inválido' } },
});
extraRegistry.registerPath({
  method: 'delete', path: '/budgets/{id}', tags: ['Orçamento'], security: auth, parameters: idParam,
  summary: 'Excluir orçamento (ids "inherited-…" não existem no banco e retornam 400)',
  responses: { 204: { description: 'Excluído' }, 400: { description: 'Orçamento herdado' }, 404: { description: 'Não encontrado' } },
});

/* ---------- Ações ---------- */
const tickerParam = [{ name: 'ticker', in: 'path' as const, required: true, schema: { type: 'string' as const } }];
extraRegistry.registerPath({
  method: 'get', path: '/stocks/search/{ticker}', tags: ['Ações'], security: auth, parameters: tickerParam,
  summary: 'Cotação de um ativo (tenta .SA primeiro)', responses: { 200: { description: 'Cotação' }, 404: { description: 'Ativo não encontrado' } },
});
extraRegistry.registerPath({
  method: 'get', path: '/stocks/quotes', tags: ['Ações'], security: auth,
  summary: 'Cotações em lote (máx. 30; o .SA é acrescentado sozinho)',
  request: { query: z.object({ tickers: z.string().describe('Ex.: PETR4,VALE3,ITUB4') }) },
  responses: { 200: { description: 'Lista com regularMarketPrice, previousClose e changePercent' } },
});
extraRegistry.registerPath({
  method: 'get', path: '/stocks/catalog', tags: ['Ações'], security: auth,
  summary: 'Catálogo de ativos da B3 (com q vazio devolve uma lista inicial). Fundamentos ficam em cache por 6 h',
  request: { query: z.object({ q: z.string().optional().describe('Ticker ou nome') }) },
  responses: { 200: { description: 'ticker, shortName, kind (acao/fii/etf), sector, dividendYield, peRatio, roe, beta, preço…' } },
});
extraRegistry.registerPath({
  method: 'get', path: '/stocks/{ticker}/history', tags: ['Ações'], security: auth, parameters: tickerParam,
  summary: 'Histórico diário de preços',
  request: { query: z.object({ range: z.enum(['1m', '3m', '6m', '1y', '2y', '5y']).optional() }) },
  responses: { 200: { description: 'Pontos { date, open, high, low, close, volume }' } },
});
extraRegistry.registerPath({
  method: 'put', path: '/stocks/{id}', tags: ['Ações'], security: auth, parameters: idParam,
  summary: 'Ajustar quantidade (inteira) e/ou preço médio da posição',
  request: { body: json(z.object({ quantity: z.number().int().positive().optional(), averagePrice: z.number().positive().optional() })) },
  responses: { 200: { description: 'Posição atualizada' } },
});
extraRegistry.registerPath({
  method: 'delete', path: '/stocks/{id}', tags: ['Ações'], security: auth, parameters: idParam,
  summary: 'Remover ativo da carteira (o histórico de operações e o resultado realizado são mantidos)',
  responses: { 204: { description: 'Removido' } },
});
extraRegistry.registerPath({
  method: 'delete', path: '/stock-operations/{id}', tags: ['Ações'], security: auth, parameters: idParam,
  summary: 'Excluir um registro do histórico (não altera a carteira)', responses: { 204: { description: 'Excluído' } },
});

/* ---------- Alertas ---------- */
extraRegistry.registerPath({
  method: 'post', path: '/price-alerts/check', tags: ['Alertas de Preço'], security: auth,
  summary: 'Avalia os alertas ativos contra a cotação atual e marca como atingidos (hit: true)',
  responses: { 200: { description: '{ triggeredCount, triggered: [...] }' } },
});
