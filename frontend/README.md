# Caixa — frontend

Interface idêntica ao `financas8.html`, conectada à API (`b3`): login, transações, contas (com pagamento pelo servidor), metas e aportes, orçamento e categorias, proventos, alertas de preço, carteira de ações com operações, cotações, catálogo e histórico reais (Yahoo Finance via API).

## Rodar

```bash
npm install
cp .env.example .env     # ajuste VITE_PROXY_TARGET se a API não estiver em localhost:3000
npm run dev              # http://localhost:5173
```

Suba a API antes (porta 3000, já com `npx prisma migrate dev` aplicado). Na primeira vez, use **Criar conta** na tela de login.

Em produção: veja o **`README-DEPLOY.md`** na raiz do pacote (Docker Compose com Nginx; o app chama `/api` no mesmo endereço, sem CORS). Alternativa: `npm run build` e `VITE_API_URL=https://sua-api` (a API precisa de CORS).

## Documentação

**`DOCUMENTACAO.md`** — arquitetura, mapa de arquivos, fluxo de carga e de sincronização, mapeamento tela ⇄ API, de onde vem cada preço e como depurar.

## Estrutura

- `src/services/sync.ts` — carga inicial e envio de alterações à API.
- `src/services/mappers.ts` — conversão entre a tela e o formato da API.
- `src/services/market.ts` — cotações, catálogo e histórico reais.
- `src/pages/Dashboard.tsx`, `Stocks.tsx` — Painel e Ações em React.
- `src/legacy/` — as demais telas (Transações, Contas, Orçamento, Metas, Relatórios, Assistente) ainda vêm do script original do `financas8.html`.

## Requisitos da API

Versão corrigida (`b3-corrigido`): rotas `/transactions` (paginada), `/bills` e `/bills/:id/pay`, `/goals` e `/contributions`, `/dividends`, `/price-alerts`, `/categories`, `/budgets`, `/users/config`, `/stocks` (+ `/quotes`, `/catalog`, `/:ticker/history`) e `/stock-operations`.
