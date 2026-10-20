# Correções aplicadas na API (sobre a v5)

## Como aplicar

```bash
npm install
npx prisma migrate dev  
npx prisma generate
npm run dev
```

A migration nova só **adiciona** colunas (`ruleNecessity`, `ruleWants`, `ruleFuture` em `user_configs`) e padroniza o `type` das categorias já gravadas (`EXPENSE` → `out`, `INCOME` → `in`). Não apaga nada.

> O `.env` **não** vai no pacote (tinha o segredo do JWT e a URL do banco). Copie `.env.example` para `.env` e preencha. Em produção (`NODE_ENV=production`) a API **não sobe** sem `JWT_SECRET`.

## O que foi corrigido

| # | Problema | Correção | Onde |
|---|----------|----------|------|
| 1 | `payBill` gravava `type: 'EXPENSE'` (despesa fora dos totais) e ignorava `date` | Grava `'out'` com valor positivo (`'in'` para conta a receber); aceita `date` e valida `paidAmount`/`date`; devolve `{ message, bill, transaction, nextBill }` | `billController.ts` |
| 2 | Próxima parcela usava `setMonth(+1)` (31/jan virava 3/mar) | `addMonthsClamped`: 31/jan → 28/fev (29 em bissexto) | `utils/date.ts` |
| 3 | `GET /transactions` sem filtros | Voltaram `from`, `to` (inclui o dia inteiro), `type`, `category`; `limit` máx. 500; datas inválidas → 400 | `transactionController.ts` |
| 4 | `UserController` sem rota | `GET/PUT /users/config` | `routes/userRoutes.ts`, `server.ts` |
| 5 | `checkAlerts` sem rota | `POST /price-alerts/check` (resposta padronizada com `triggeredCount`) | `priceAlertRoutes.ts` |
| 6 | Categoria sem `group` na criação/edição | `group` aceito em `POST`/`PUT /categories` (`NECESSITY/WANTS/FUTURE` ou `nec/des/fut`; `null` remove); `type` opcional; nome duplicado → 409 | `categoryController.ts` |
| 7 | Categorias padrão diferentes das do front; código duplicado | As 6 do front (nome, emoji, cor, grupo) + `Salário` e `Extras`; uma só implementação em `categoryService.ts` | `categoryService.ts`, `authController.ts` |
| 8 | `DELETE /stocks/:id` apagava as operações (e o resultado realizado) | Remove só o ativo; o histórico fica | `stockController.ts` |
| 9 | Operações dependiam do histórico para saber a posição (divergência de ticker/carteira) | A **carteira (`stocks`) é a fonte** da posição e do preço médio; venda e compra atualizam a carteira na mesma transação; aceita `PETR4`/`PETR4.SA`; quantidade inteira; erros de validação = 400, o resto = 500 | `stockOperationController.ts` |
| 10 | Catálogo sem setor/ROE/beta | Voltaram, via `quoteSummary` **com cache de 6 h**; cotações em **uma** chamada em lote; campo `kind` (`acao`/`fii`/`etf`); ≤ 30 tickers em `/stocks/quotes` | `stockController.ts` |
| 11 | Orçamento herdava só se o mês estivesse vazio | Herda **por categoria** (último mês anterior); itens com `inherited` e `inheritedFrom`; `DELETE` de id herdado → 400 explicativo; valida mês (`YYYY-MM`) e limite | `budgetController.ts` |
| 12 | Regra 50/30/20 só no front | `ruleNecessity/ruleWants/ruleFuture` em `user_configs` (inteiros, somam 100) | `schema.prisma`, `userController.ts` |
| 13 | Dados inválidos em cadastro/login/contas/metas/proventos davam **500** | No Zod 4 não existe `error.errors`; agora `400` com `[{ campo, message }]` | 6 controllers |
| 14 | `JWT_SECRET` com valor padrão no código; `.env` no zip | Segredo obrigatório em produção; `.env.example`; `.gitignore` | `config/env.ts` |
| 15 | Swagger sem a maioria das rotas | Documentadas: `/auth/*`, `/users/config`, `/bills/{id}/pay`, aportes, cotações, catálogo, histórico, `/stocks/{id}`, `/transactions/{id}` (com filtros) etc. | `swagger/extraSwagger.ts` |
| 16 | Rotas duplicadas em `transactionRoutes.ts` | Removidas | `transactionRoutes.ts` |
| 17 | **`PUT /goals/:id` zerava o progresso e o ícone da meta.** `updateGoalSchema = createGoalSchema.partial()` e, no Zod 4, `.partial()` mantém os `.default()`: um `PUT` sem `currentAmount`/`icon` gravava `0` e `🎯`. Achado ao ligar o front (editar o nome de uma meta com R$ 350 guardados voltava com R$ 0) | `updateGoalSchema` explícito, sem `default`; mesmo cuidado em `updateTransactionSchema` (que tinha `default` em `date`) e `PUT /transactions/:id` passou a validar o corpo (valor positivo, tipo `in`/`out`) | `goalSchema.ts`, `transactionSchema.ts`, `transactionRoutes.ts` |

## Compra/venda de ações: lançamento nas transações e correção (v6)

- `StockOperation.transactionId` (opcional, único) liga a **venda** à receita que ela gerou. Migration só **adiciona** a coluna.
- `POST /stock-operations` aceita `date` (operações antigas) e `launch`: cria uma transação (venda = `in`, compra = `out`), categoria `Investimentos`, valor = quantidade × preço, e devolve `{ operation, transaction }`. Padrão: venda `true` (como antes desta versão não existia lançamento) e **compra `false`** — para lançar a despesa da compra é preciso enviar `launch: true`; registrar uma posição antiga = compra sem `launch`.
- **Novo** `PUT /stock-operations/:id` (`quantity`, `price`, `date`, `launch`): em uma transação do banco recalcula a carteira, o lucro realizado e o lançamento (receita da venda / despesa da compra: cria, atualiza ou apaga). Se o histórico explica exatamente a posição, o histórico é reprocessado (exato, inclusive o lucro das vendas seguintes); senão (ex.: ativo removido e recomprado) só a operação editada é desfeita e refeita. Recusa (400) alterações que deixariam a posição negativa. Resposta: `{ operation, transaction, deletedTransactionId, affected, stock, mode }`.
- Lógica pura em `utils/position.ts`. `DELETE /stock-operations/:id` continua só apagando o histórico.

## Contratos que o front deve conhecer

| Rota | Resposta |
|------|----------|
| `GET /transactions` | `{ data: [...], meta: { total, page, limit, totalPages } }` |
| `POST /bills/:id/pay` | `{ message, bill, transaction, nextBill }` (`nextBill` é `null` se não houver) |
| `GET /budgets?month=YYYY-MM` | lista com `inherited` (bool) e `inheritedFrom` (mês de origem) |
| `GET/PUT /users/config` | `{ expectedIncome, ruleNecessity, ruleWants, ruleFuture }` (no `PUT`: `{ message, config }`) |
| `POST /stock-operations` | `{ message, operation, transaction }`; a carteira já é atualizada (`transaction` = receita da venda, ou `null`) |
| `POST /stocks` | `{ message, stock }`; também soma na posição existente e registra a compra |
| `POST /price-alerts/check` | `{ message, triggeredCount, triggered: [...] }` |
| Categoria | `group` ∈ `NECESSITY` / `WANTS` / `FUTURE` (a entrada aceita também `nec` / `des` / `fut`) |

## O que NÃO foi alterado (de propósito)

- **Migration `fix_tables_mapping`** (recria `transactions.date` como `NOT NULL`): editar uma migration já aplicada quebra o checksum do Prisma. Em banco **novo** com dados, rode `npx prisma migrate reset` (desenvolvimento).
- **`DELETE /stock-operations/:id`** só apaga o registro do histórico; não reverte a carteira.
- **`PUT /stocks/:id`** continua sem schema (já valida os números).
- **Orçamento mensal na API × limite fixo no front:** a herança resolve a leitura; para gravar, o front envia o limite para o mês exibido.
- **Recorrência mensal:** a próxima conta usa o dia da conta anterior (31/jan → 28/fev → 28/mar); a API não guarda o "dia âncora".

## Como foi verificado

- `tsc --noEmit` sem erros, com o client do Prisma regenerado a partir do schema novo.
- Os controllers corrigidos também foram exercitados **pelo front real** (navegador automatizado, 141 verificações: contas e pagamento, metas e aportes, carteira e operações, proventos, alertas, categorias, orçamento, configurações, catálogo e histórico), usando banco em memória e Yahoo simulado.
- **95 testes** nos controllers e **21 testes** via HTTP (Express real, com todas as rotas montadas como no `server.ts`), usando um banco em memória e um Yahoo Finance simulado: pagamento (parcelada, mensal, a receber, datas), filtros e teto de transações, operações/carteira, orçamento, categorias, configurações, catálogo (incluindo o cache), autenticação, JWT e geração do Swagger.
- **Não** foi testado contra um PostgreSQL nem contra o Yahoo Finance reais: rode `prisma migrate dev` e faça um teste manual em `/docs`.
