# Caixa — Documentação do frontend

Guia de "onde está cada coisa" depois da integração completa com a API (`b3`). Os nomes de função são estáveis; use a busca do editor (os números de linha do `caixa.js` mudam).

---

## 1. Visão geral

```
┌──────────────────────────────────────────────────────────────────────┐
│ React  (App.tsx, ReactViews.tsx, pages/, components/)                │
│   Login · Boot · Painel e Ações como componentes                     │
├──────────────────────────────────────────────────────────────────────┤
│ Ponte  window.CX   (lib/cx.ts  ⇄  final de legacy/caixa.js)          │
│   React lê/escreve o estado S e chama as funções do script           │
├──────────────────────────────────────────────────────────────────────┤
│ Script legado  (legacy/caixa.js + shell.html)                        │
│   Estado S, modais, telas ainda não migradas, regras de negócio      │
├──────────────────────────────────────────────────────────────────────┤
│ Dados  (services/)                                                   │
│   sync.ts · mappers.ts · market.ts · api.ts · auth.ts                │
└──────────────────────────────────────────────────────────────────────┘
```

O script legado é o `financas8.html` original. Ele foi mantido para o visual e o comportamento ficarem idênticos; **Painel** e **Ações** já são componentes React. Tudo que o usuário faz continua alterando o objeto `S`; a camada `services/` cuida de levar isso à API.

---

## 2. Mapa de arquivos

| Arquivo | Para que serve |
|---|---|
| `src/App.tsx` | Login → `Boot` (carrega a API) → `Shell` (monta o HTML e roda o script). Registra os ganchos `window.__*`. |
| `src/components/Login.tsx` | Login e cadastro. |
| `src/pages/Dashboard.tsx` | **Painel** (tela `home`). |
| `src/pages/Stocks.tsx` | **Ações**: Carteira, Explorar, Proventos e alertas, Análise do ativo. |
| `src/components/BalanceChart.tsx`, `StockChart.tsx`, `ui.tsx` | Gráficos, miniaturas, linha de conta, `brl()`. |
| `src/lib/cx.ts` | Tipos da ponte `window.CX` e o store que re-renderiza o React. |
| `src/services/api.ts` | Cliente axios (`/api`, token JWT, 401 → logout). |
| `src/services/auth.ts` | `login`, `register`, `logout`, `getSession`, `apiError` (traduz erros da API). |
| `src/services/mappers.ts` | **Funções puras** tela ⇄ API (corpo de cada rota, grupos, ordem das categorias, vínculos). |
| `src/services/sync.ts` | **Carga inicial e envio de alterações** (a peça central). |
| `src/services/market.ts` | **Cotações, catálogo e histórico reais** (Yahoo Finance via API). |
| `src/legacy/caixa.js` | Script original (estado `S`, modais, telas não migradas). |
| `src/legacy/shell.html` | HTML estático (sidebar, topo, `#main`, `#rxm`, modal, toast). |
| `vite.config.ts` | Proxy `/api` → API (sem CORS em desenvolvimento). |

---

## 3. Do login à tela

1. `App` lê a sessão (`caixa_token`, `caixa_user` no `localStorage`). Sem sessão → `Login`.
2. `Boot` chama `fetchAll()`: em paralelo transações (paginadas, 500 por página), contas, metas, carteira, proventos, operações, alertas, categorias, orçamento do mês e configurações. Se qualquer uma falhar, aparece "Não foi possível carregar os dados" com o motivo e **Tentar de novo** / **Sair**.
3. `Shell` monta o `shell.html`, cria o root React em `#rxm` e injeta `caixa.js` como script clássico.
4. No fim do `caixa.js`, antes do primeiro `render(1)`, roda `window.__boot()` → `boot()` → `hydrate()`, que copia tudo da API para `S`.
5. Logo após o primeiro desenho, `warmMarket()` busca em segundo plano: cotações, setor/fundamentos e histórico de 2 anos de cada ativo da carteira.

Ganchos `window.__*` (definidos em `App.tsx`):

| Gancho | Função | Usado em |
|---|---|---|
| `__rx` | `pushView` | `render()` — desenha `home`/`stk` no React |
| `__boot` | `boot` | fim do `caixa.js` |
| `__sync` | `scheduleSync` | `save()` — a cada gravação do estado |
| `__reload` | `reload` | botão ↺ da barra lateral |
| `__logout` | `logout` | botão ⏻ e erro 401 |
| `__refreshQuotes` | `refreshQuotes` | a cada 60 s e botão "Atualizar" |
| `__searchCatalog` | `catalogSearch` | busca global do topo (`gsSugg`) |
| `__ensureQuotes` | `ensureQuotes` | `watchForm` |
| `__loadTicker` | `loadTicker` | (disponível para o script) |

---

## 4. Quem é dono de cada dado

| Dado em `S` | Onde fica | Rotas |
|---|---|---|
| `tx` transações | **API** | `/transactions` |
| `bills` contas | **API** | `/bills`, `/bills/:id/pay` |
| `goals` metas e `h` (aportes) | **API** | `/goals`, `/goals/:id/contributions` |
| `divs` proventos | **API** | `/dividends` |
| `watch` alertas de preço | **API** | `/price-alerts` |
| `cl` categorias e `grp` (grupo 50/30/20) | **API** | `/categories` |
| `budget` limite por categoria | **API** (mês atual) | `/budgets` |
| `ip` receita prevista e `rule` (50/30/20) | **API** | `/users/config` |
| `stocks` carteira, `ops` operações, `real` resultado realizado | **API** | `/stocks`, `/stock-operations` |
| filtros, tela atual, favoritos (`fav`), recentes (`sh`), notificações lidas, preferências, chat | só `localStorage` (`caixa-v2:<id do usuário>`) | — |

---

## 5. Como as alterações chegam à API (`sync.ts`)

A tela continua alterando `S` como no original. A cada `save()`, `scheduleSync()` espera 150 ms e `syncAll()` compara `S` com a "fotografia" do servidor (`snaps`) e envia **só a diferença**:

```
syncAll:  categorias → transações → contas → metas → proventos → alertas → operações → remoção de ativo → orçamento → configurações
```

- Item novo (sem `sid`) → `POST`; mudou → `PUT`; sumiu → `DELETE`.
- `id` = número local (usado nos `onclick` do HTML); `sid` = uuid do servidor.
- Se a API recusa algo, `reload(true)` desfaz na tela e um toast mostra o motivo (`apiError`).
- Várias alterações seguidas são agrupadas; nada é reenviado se nada mudou.

### Mapeamento tela ⇄ API (`mappers.ts`)

| Tela | API |
|---|---|
| Transação `{d, v, tp, c, dt}` | `{description, value, type, category, date}` |
| Conta `{n, v, due, c, rec, np, pk, cb, paid, paidAt, pv}` | `{title, amount, dueDate, category, recurrence, installments, currentInstallment, barcode, isPaid, paidAt, paidAmount}` — `rec`: `'0'`→`SINGLE`, `'m'`→`MONTHLY`, `'p'`→`INSTALLMENT` |
| Meta `{n, t, a, ic, dl, h:[{dt,v,cid}]}` | `{title, targetAmount, currentAmount, icon, deadline}` + `contributions` |
| Provento `{t, tp, v, dt}` | `{ticker, type: DIVIDEND/JCP, amount, date}` |
| Alerta `{t, alvo, dir:'up'/'dn', hit}` | `{ticker, target, direction: ABOVE/BELOW, hit}` |
| Categoria `{n, ic, col}` + `S.grp[n]` | `{name, icon, color, group}` — `nec/des/fut` ⇄ `NECESSITY/WANTS/FUTURE` |
| Operação `{t, tp:'Compra'/'Venda', q, p, dt, rp, tid}` | `{ticker, type: BUY/SELL, quantity, price, date, launch}` · `rp` = `realizedPnL` · `tid` = receita gerada (`transactionId`) |
| Ação `{t, q, pm}` | linha de `/stocks` (`PETR4.SA`, `quantity`, `averagePrice`) |

Vínculos que a API não guarda são **reconstruídos ao carregar** (`linkNextBills`, `linkDividendTx`): conta paga → próxima conta; provento → receita "Provento XXX". O vínculo conta → transação vem de `transactionId`.

---

## 6. Fluxos especiais

**Pagar conta** (`doPay` no script + `payBill` no `sync.ts`)
- `doPay` marca a conta com `b._pay = {l}` e cria localmente a transação e a próxima conta com `_via:'pay'` (assim o envio comum não os duplica).
- Lançando nas despesas (`l`): `PUT` das edições (ex.: categoria escolhida) → `POST /bills/:id/pay` → o **servidor** cria a transação e a próxima parcela/mês; o front adota os ids e dados devolvidos.
- Sem lançar: só `PUT` marcando como paga; a próxima conta, se houver, sai pelo envio comum.
- **Desfazer pagamento**: a conta volta a aberta (`PUT`), a transação e a próxima conta são excluídas.

**Metas**: o progresso só muda por aportes. Aporte novo (sem `cid`) → `POST /goals/:id/contributions` (negativo = retirada). O `PUT /goals` sempre envia o `currentAmount` conhecido do servidor, para nunca zerar o progresso.

**Carteira**: comprar/vender no script adiciona uma operação em `S.ops` (sem `sid`); `syncOps` envia cada uma a `/stock-operations` (o servidor atualiza a posição e o preço médio e calcula o resultado). Depois, `refreshStocksFromServer` alinha `S.stocks` e `S.real` com o servidor. Ticker novo é conferido antes (`/stocks/quotes`); inexistente → compra recusada com o motivo.
- **Remover da carteira** espera 4,5 s (o prazo do "Desfazer") e então faz `DELETE /stocks/:id`. O histórico e o resultado realizado ficam.

**Categorias/orçamento/regra**: criar, renomear (as transações e contas são atualizadas), trocar cor/ícone/grupo e excluir viram `POST/PUT/DELETE /categories`. O limite vai em `POST /budgets` para o mês atual (a API herda o limite de meses anteriores). A regra 50/30/20 só é enviada quando os três percentuais somam 100.

---

**Compra, venda e extrato** (`opForm`/`dtMap` no script, `Extrato` em `Stocks.tsx`, `syncOps`/`adoptSaleTx` no `sync.ts`)
- Topo de **Ações**: botões **+ Compra** e **− Venda**. Os dois abrem o mesmo formulário (`opForm`, modal mais largo) com três modos: **Compra** (vira despesa `Investimentos`: desconta do saldo), **Venda** (vira receita) e **Registrar ação** (posição que o usuário já tinha: grava a compra, com data antiga, sem mexer no saldo). Também tem seletor da ação (na venda, só as da carteira; na compra, também "Outro ativo" para digitar), quantidade, preço, **data** (compras/vendas antigas) e, na venda, **Lançar nas transações?**.
- **Corrigir operação**: lápis ✎ no extrato → `opForm(tp, {edit: id})` (quantidade, preço, data e lançamento). Sai como `PUT /stock-operations/:id`; o servidor recalcula carteira, lucro e a receita.
- **Operação lançada**: o servidor cria a transação (`Investimentos`; venda = receita, compra = despesa; valor = qtd × preço) e devolve em `transaction`; `adoptSaleTx` adota os dados. A aba Transações mostra a venda com lucro/prejuízo e a marca ⚡ Day trade, e o card de Receitas informa quanto veio de vendas de ações. Marcas internas: `_via:'sell'` (receita ainda não enviada), `o._re` (só o lançamento mudou).
- **Day trade** = compra e venda do mesmo ativo no mesmo dia (`dtMap()` → `{id da operação: quantidade}`); calculado na tela, não é gravado.
- **Extrato** (seletor de mês ‹ mês › + "Tudo"; aba nova + card "Operações recentes" da aba Proventos): vendas em destaque (soma e resultado), compras, day trade, soma por dia (vendas antes das compras no mesmo dia), filtros de tipo e período.
- `syncOps` roda **antes** das transações: o servidor cria/atualiza/apaga a receita da venda uma única vez.

## 7. Mercado: de onde vêm os preços

Não existe mais simulação. Tudo vem da API (`market.ts`):

| Dado | Função | Rota | Quando |
|---|---|---|---|
| Cotação da carteira e dos alertas | `refreshQuotes` | `GET /stocks/quotes` | a cada 60 s e no botão "Atualizar" |
| Cotação de qualquer ativo na tela | `ensureQuotes` (cache 60 s) | `GET /stocks/quotes` | ao mostrar um ativo |
| Catálogo e busca (preço, setor, DY, P/L, ROE, beta) | `catalogSearch` (cache 5 min) | `GET /stocks/catalog?q=` | aba **Explorar** e busca do topo |
| Histórico de 2 anos | `loadHistory` | `GET /stocks/:ticker/history?range=2y` | análise do ativo, cards, miniaturas |

Onde fica guardado (estruturas do script): `QT` (cotação), `OQ` (fechamento anterior), `CAT[t]` = `[nome, setor, preço, dy, p/l, roe, beta]`, `SEC` (setor), `LH[t]` = série diária `{d, p}`. `KIND[t]` (ação/FII/ETF) fica em `market.ts`.

Quem consome:
- `hist(t)`: últimos 30 fechamentos reais (miniaturas e evolução da carteira).
- `an(t)`: médias móveis, RSI, volatilidade, retornos, suporte/resistência — calculados sobre o histórico real; devolve `null` enquanto o histórico não chegou (as telas mostram "Carregando…").
- Setores do Yahoo são traduzidos (`Energy` → `Energia`…); FIIs e ETFs têm rótulo próprio.

No console do navegador (F12): `CX.QT.PETR4`, `CX.CAT.PETR4`, `CX.LH.PETR4.length`, `CX.S.stocks`.

---

## 8. Como uma tela é desenhada

`render(anim)` (no `caixa.js`): desenha sidebar e breadcrumb; se `S.view` é `home` ou `stk`, esconde `#main`, mostra `#rxm` e chama `window.__rx` (o React lê `S`); senão preenche `#main` com `VIEWS[S.view]()`. No fim chama `save()` (que dispara a sincronização). `anim` verdadeiro remonta a tela React (reanima barras e gráficos).

Telas ainda no script (`VIEWS`): Transações (`tx`), Contas (`bills`), Orçamento (`bud`), Metas (`goal`), Relatórios (`rep`), Assistente (`ai`). Modais: `FM(título, campos, callback)`; formulários: `txForm`, `billForm`, `pay`, `goalForm`, `depForm`, `buyForm`, `sellForm`, `divForm`, `watchForm`, `catForm`, `delCat`.

---

## 9. Depuração

- Toast "⚠️ N alteração(ões) não salva(s): …" = a API recusou; a tela já voltou ao estado do servidor.
- Aba Rede (F12): filtre por `/api/`. Depois de carregar, sem mexer em nada, não deve haver `POST/PUT/DELETE`.
- Marcas internas: `b._pay` (pagamento pendente), `_via:'pay'` (item criado pelo pagamento), `sid` (já existe no servidor), `h[i].cid` (aporte já enviado), `o.sid` (operação já enviada).
- ↺ na barra lateral recarrega tudo da API.

---

## 10. Receitas

**Novo campo que a API passou a guardar** (ex.: observação da transação): inclua no `*Body` e no `*FromApi` do `mappers.ts`; o resto (comparação, `PUT`) é automático.

**Migrar mais uma tela para React**: converta a função de `VIEWS` em `pages/Nome.tsx` (mesmas classes CSS), leia `S` via `cx()`, inclua o `view` em `ReactViews.tsx` e na condição do `render()` do `caixa.js`.

**Trocar a URL da API**: `VITE_PROXY_TARGET` (desenvolvimento) ou `VITE_API_URL` (build; exige CORS na API).

---

## 11. Limitações conhecidas

- **Desfazer pagamento**: a API não limpa `paidAt`/`paidAmount` ao reabrir a conta (o front ignora esses campos em contas abertas).
- **Orçamento**: o front tem um limite por categoria; a API guarda por mês. O front lê o mês atual (com herança) e grava no mês atual.
- **Categorias de receita** (`Salário`, `Extras`) existem na API, mas a tela de orçamento só lista despesas.
- **Remover ativo**: some da API só depois de 4,5 s (prazo do "Desfazer"); fechar a aba nesse intervalo faz o ativo voltar.
- `fresh()` (gerador de dados de demonstração do original) ainda existe, mas só serve de base para o estado vazio; seus dados são descartados.

## Layout responsivo (celular e tablet)

Tudo está em `src/index.css` (final do arquivo) e em `render()`/`moreSheet()` no `caixa.js`. No desktop (> 820 px) nada muda.

| Largura | O que acontece |
|---|---|
| ≤ 1100 px | menos espaçamento lateral |
| ≤ 900 px | Painel e blocos de 2 colunas empilham; cartões de resumo em 2 colunas |
| ≤ 820 px (tablet vertical e celular) | menu lateral vira **barra de abas** fixa embaixo (Painel, Transações, Ações, Metas, **Mais**); botão **+** flutuante (Painel e Transações); formulários viram *bottom sheet*; notificações ocupam a largura; campos com 16 px (evita zoom do iOS); respeita `safe-area` (notch/barra inicial) |
| ≤ 560 px (celular) | carteira de ações vira lista de cartões; tabelas largas rolam na horizontal; colunas secundárias somem |
| altura ≤ 560 px e largura > 820 px (celular deitado) | menu lateral rola em vez de cortar |

- **Mais** (`moreSheet()`): Contas, Orçamento, Relatórios e Assistente + alternar tema, recarregar dados e sair. Quais telas ficam em "Mais" = constante `MORE` em `render()`.
- Cada botão do menu tem `data-v="<tela>"`; a ordem na barra mobile é definida por CSS (`order`).
- Gráficos: usam *pointer events* (mouse, toque e caneta; arrastar com o dedo mostra o valor) e `touch-action: pan-y` (rolar na vertical continua funcionando). Os do script legado redesenham ao girar/redimensionar a tela (listener `resize` no fim do `caixa.js`); os React usam `ResizeObserver`.
- Evite `grid-template-columns` inline: media queries não conseguem sobrescrever (use classes como `.gx`).

### Ajustes de celular (≤ 560 px) — convenções

- **Escala de fontes**: apoio 12 px (`small`, `.tag`, cabeçalho de tabela) · texto 14 px · valores em listas 15–16 px · destaque `.big` 26 px. Números dos cartões `.g4`/`.g3` se ajustam à largura do cartão (`clamp(11px, 12cqw, 22px)` com `container-type:inline-size`); em navegadores sem *container queries* cai para 18 px.
- **Tabelas viram cartões** (cabeçalho oculto, cada linha em grade): `table.perf` (Painel: desempenho por categoria), `table.rp` (Relatórios: detalhamento mensal) e `table.cart` (Ações: carteira). Tabela nova no celular = criar uma classe e as regras `nth-child` no mesmo bloco do CSS.
- **Classes de linha** (`.row`): sem classe a linha **não quebra**; `.bw` permite quebrar em 2 linhas (contas, alertas, simulador de metas); `.ex` esconde o ícone (extrato). Em `.row.cl` (transações) o ícone some para sobrar espaço ao texto.
- Não use `min-width`/`width` fixos em px dentro de cartões (ex.: o simulador de metas tinha `150px`/`250px`); use `flex` ou classes.
- **Zoom/fonte grande no Android** equivale a uma tela mais estreita; o layout foi verificado até 288 px de largura.
