import { useEffect, useState } from 'react';
import { cx, useMounted } from '../lib/cx';
import { PageHead, Spk, brl } from '../components/ui';
import { StockChart } from '../components/StockChart';
import { catalogSearch, loadHistory, loadTicker, type CatItem } from '../services/market';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = { id: number; t: string; q: number; pm: number; p: number; H: number[]; cost: number; mv: number; d: number; day: number; dv: number };

const Pct = ({ v }: { v: number }) => <span className={v < 0 ? 'dn' : 'up'}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>;

function Tabs({ T }: { T: string }) {
  const { S, render } = cx();
  const set = (k: string) => { S.st = k; render(1); };
  return (
    <div className="rng tabs" style={{ margin: '0 0 14px', flexWrap: 'wrap', width: 'fit-content' }}>
      {[['carteira', '📊 Minha carteira'], ['explorar', '🔎 Explorar ações'], ['extrato', '🧾 Extrato de operações'], ['prov', '💰 Proventos e alertas']].map(([k, l]) => (
        <button key={k} className={T === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>
      ))}
      {S.sq && <button className={T === 'ativo' ? 'on' : ''} onClick={() => set('ativo')}>📈 {S.sq}</button>}
    </div>
  );
}

/** Simulador de cenário (stress test) da carteira. */
function Stress({ mv }: { mv: number }) {
  const { S } = cx();
  const [v, setV] = useState<number>(S.sc || 0);
  const set = (x: number) => { S.sc = x; setV(x); };
  const nv = mv * (1 + v / 100), d = nv - mv;
  return (
    <div className="card">
      <h3>Simulador de cenário (stress test)</h3>
      <small>Se toda a carteira variar:</small>
      <div className="lim">
        <input type="number" step="1" value={v} onChange={(e) => set(+e.target.value || 0)} aria-label="Variação em %" />
        <span>%</span>
      </div>
      <div className="tools" style={{ margin: '8px 0', flexWrap: 'wrap' }}>
        {[-20, -10, -5, 5, 10, 20].map((x) => (
          <button key={x} className="btn ghost" onClick={() => set(x)}>{x > 0 ? '+' : ''}{x}%</button>
        ))}
      </div>
      <div>
        Patrimônio simulado: <b>{brl(nv)}</b><br />
        <span className={d < 0 ? 'dn' : 'up'}>{d < 0 ? '−' : '+'}{brl(Math.abs(d))}</span> <small>sobre {brl(mv)} atuais</small>
      </div>
    </div>
  );
}

function Carteira() {
  const { S, px, hist, OQ, SEC, PAL, pickS, buyForm, sellForm, delStk, render, dd } = cx();
  const m = useMounted();
  const P: Row[] = S.stocks.map((x: any) => {
    const p = px(x), H = hist(x.t), o = OQ[x.t] || p;
    return { ...x, p, H, cost: x.q * x.pm, mv: x.q * p, d: (p - o) / o * 100, day: x.q * (p - o), dv: S.divs.filter((v: any) => v.t === x.t).reduce((a: number, v: any) => a + v.v, 0) };
  });
  const sk: string = S.ss || 'mv', sd: number = S.sd || -1;
  const K: Record<string, (x: Row) => any> = { t: (x) => x.t, mv: (x) => x.mv, res: (x) => x.mv - x.cost, d: (x) => x.d, dv: (x) => x.dv };
  P.sort((a, b) => (K[sk](a) > K[sk](b) ? 1 : -1) * sd);
  const mv = P.reduce((a, x) => a + x.mv, 0), cost = P.reduce((a, x) => a + x.cost, 0), pnl = mv - cost,
    dv = S.divs.reduce((a: number, x: any) => a + x.v, 0),
    dv12 = S.divs.filter((x: any) => x.dt >= dd(-364)).reduce((a: number, x: any) => a + x.v, 0),
    ret = cost ? (pnl + dv) / cost * 100 : 0, dayv = P.reduce((a, x) => a + x.day, 0), yoc = cost ? dv12 / cost * 100 : 0,
    ga: string = S.ga || 'ativo',
    gk: Record<string, (x: Row) => string> = { ativo: (x) => x.t, setor: (x) => SEC[x.t] || 'Outros', tipo: (x) => (/11$/.test(x.t) ? 'FIIs' : 'Ações') },
    G: Record<string, number> = {};
  P.forEach((x) => { const k = gk[ga](x); G[k] = (G[k] || 0) + x.mv; });
  const GA = Object.entries(G).sort((a, b) => b[1] - a[1]),
    PH = Array.from({ length: 30 }, (_, i) => P.reduce((a, x) => a + x.q * x.H[i], 0)), hv = PH[29] - PH[0];
  const th = (k: string, l: string) => (
    <th style={{ cursor: 'pointer' }} onClick={() => { S.ss = k; S.sd = sk === k && sd === -1 ? 1 : -1; render(); }}>
      {l}{sk === k ? (sd < 0 ? ' ↓' : ' ↑') : ''}
    </th>
  );
  return (
    <>
      <div className="grid g4">
        <div className="card"><h3>Patrimônio em ações</h3><div className="big" style={{ fontSize: 24 }}>{brl(mv)}</div><small className={dayv < 0 ? 'dn' : 'up'}>{dayv < 0 ? '↓' : '↑'} {brl(Math.abs(dayv))} hoje</small></div>
        <div className="card"><h3>Resultado das ações</h3><div className={`big ${pnl < 0 ? 'dn' : 'up'}`} style={{ fontSize: 24 }}>{pnl < 0 ? '−' : '+'}{brl(Math.abs(pnl))}</div><small>{cost ? (pnl / cost * 100).toFixed(2) : 0}% · realizado: {brl(S.real)}</small></div>
        <div className="card"><h3>Proventos recebidos</h3><div className="big up" style={{ fontSize: 24 }}>{brl(dv)}</div><small>yield on cost 12m: {yoc.toFixed(2)}%</small></div>
        <div className="card"><h3>Rentabilidade real</h3><div className={`big ${ret < 0 ? 'dn' : 'up'}`} style={{ fontSize: 24 }}>{ret.toFixed(2)}%</div><small>valorização + proventos</small></div>
      </div>
      <div className="grid g21" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>Carteira · clique nos títulos para ordenar</h3>
          {P.length ? (
            <table className="stk cart">
              <tbody>
                <tr>{th('t', 'Ativo')}<th>30 dias</th><th>Qtd</th><th>Preço médio</th>{th('d', 'Cotação')}{th('mv', 'Valor')}{th('res', 'Resultado')}{th('dv', 'Proventos')}<th /></tr>
                {P.map((x) => {
                  const r = x.mv - x.cost;
                  return (
                    <tr key={x.id}>
                      <td>
                        <b style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} title="Ver detalhes e histórico" onClick={() => pickS(x.t)}>{x.t}</b><br />
                        <small>{SEC[x.t] || 'Outros'}</small>
                      </td>
                      <td><Spk H={x.H} w={70} h={24} /></td>
                      <td>{x.q}</td>
                      <td>{brl(x.pm)}</td>
                      <td>{brl(x.p)} <small className={x.d < 0 ? 'dn' : 'up'}>{x.d < 0 ? '↓' : '↑'}{Math.abs(x.d).toFixed(2)}%</small></td>
                      <td>{brl(x.mv)}</td>
                      <td className={r < 0 ? 'dn' : 'up'}>{r < 0 ? '−' : '+'}{brl(Math.abs(r))} <small>({(r / x.cost * 100).toFixed(1)}%)</small></td>
                      <td>{brl(x.dv)}</td>
                      <td><div className="acts"><button title="Comprar mais" onClick={() => buyForm(x.id)}>+</button><button title="Vender" onClick={() => sellForm(x.id)}>−</button><button title="Remover" onClick={() => delStk(x.id)}>×</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <small>Sua carteira está vazia. Registre a primeira compra.</small>}
        </div>
        <div className="card">
          <div className="top">
            <h3 style={{ margin: 0 }}>Alocação</h3>
            <div className="rng">
              {[['ativo', 'Ativo'], ['setor', 'Setor'], ['tipo', 'Tipo']].map(([k, l]) => (
                <button key={k} className={ga === k ? 'on' : ''} onClick={() => { S.ga = k; render(1); }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="stack">
            {GA.map(([k, v], i) => <i key={k} title={k} style={{ width: m ? `${v / mv * 100}%` : 0, background: PAL[i % 6] }} />)}
          </div>
          {GA.map(([k, v], i) => (
            <div key={k} className="lg"><b style={{ background: PAL[i % 6] }} /><span>{k} <span className="tag">{Math.round(v / mv * 100)}%</span></span><span className="val">{brl(v)}</span></div>
          ))}
        </div>
      </div>
      <div className="grid g21" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="top">
            <h3 style={{ margin: 0 }}>Evolução da carteira · 30 pontos</h3>
            <span className={hv < 0 ? 'dn' : 'up'}>{hv < 0 ? '↓' : '↑'} {brl(Math.abs(hv))} ({(PH[0] ? hv / PH[0] * 100 : 0).toFixed(2)}%)</span>
          </div>
          <Spk H={PH} w={600} h={150} fill />
        </div>
        <Stress mv={mv} />
      </div>
    </>
  );
}

/**
 * Extrato de operações: vendas em destaque (valor total e resultado), soma por período e por dia,
 * marca de day trade (compra e venda do mesmo ativo no mesmo dia) e correção de lançamentos errados.
 */
function Extrato({ compact }: { compact?: boolean }) {
  const { S, fd, mi, dtMap, opForm, render } = cx();
  // período: um mês (0 = este mês, -1 = mês passado…) ou 'all' (tudo); o resumo compacto usa sempre tudo
  const raw = String(S.xp ?? '0');
  const per: string = compact ? 'all' : raw === 'all' || (Number.isInteger(+raw) && +raw <= 0) ? raw : '0';
  const off = per === 'all' ? 0 : +per;
  const kind: string = compact ? 'all' : S.xf || 'all';
  const lim: number = S.xe || 30;
  const inP = (dt: string) => {
    if (per === 'all') return true;
    const I = mi(off);
    return dt >= I.a && dt <= I.b;
  };
  const dm: Record<number, number> = dtMap();
  const sum = (l: any[]) => l.reduce((a, o) => a + o.q * o.p, 0);
  const res = (l: any[]) => l.reduce((a, o) => a + (o.rp ?? 0), 0);
  const all: any[] = S.ops.filter((o: any) => inP(o.dt));
  const sells = all.filter((o) => o.tp === 'Venda'), buys = all.filter((o) => o.tp === 'Compra');
  const sold = sum(sells), bought = sum(buys), profit = res(sells);
  const dtSells = sells.filter((o) => dm[o.id]);
  const dtRes = dtSells.reduce((a, o) => a + (o.rp ?? 0) * (dm[o.id] / o.q), 0);
  // mais recentes primeiro; no mesmo dia, as vendas vêm antes das compras
  const list = all
    .filter((o) => kind === 'all' || o.tp === kind)
    .sort((a, b) => b.dt.localeCompare(a.dt) || (a.tp === 'Venda' ? 0 : 1) - (b.tp === 'Venda' ? 0 : 1) || b.id - a.id);
  const vis = compact ? list.slice(0, 6) : list.slice(0, lim);
  const days: [string, any[]][] = [];
  vis.forEach((o) => {
    const last = days[days.length - 1];
    if (last && last[0] === o.dt) last[1].push(o); else days.push([o.dt, [o]]);
  });
  const set = (patch: Record<string, any>) => { Object.assign(S, patch); render(); };
  const mm = mi(0), mSells = S.ops.filter((o: any) => o.tp === 'Venda' && o.dt >= mm.a && o.dt <= mm.b);

  const rows = days.map(([d, os]) => {
    const day = list.filter((x) => x.dt === d), ds = day.filter((x) => x.tp === 'Venda'), db = day.filter((x) => x.tp === 'Compra');
    return (
      <div key={d}>
        <div className="top" style={{ margin: '14px 0 2px' }}>
          <small>{fd(d)}</small>
          <small>
            {ds.length > 0 && <>vendido <b className="up">{brl(sum(ds))}</b></>}
            {ds.length > 0 && db.length > 0 && ' · '}
            {db.length > 0 && <>comprado <b>{brl(sum(db))}</b></>}
          </small>
        </div>
        {os.map((o) => {
          const sale = o.tp === 'Venda', q = dm[o.id], linked = S.tx.some((t: any) => t.id === o.tid);
          return (
            <div key={o.id} className="row ex">
              <div className="ico">{sale ? '🔴' : '🟢'}</div>
              <div className="t">
                <b>
                  {o.tp} · {o.t}
                  {q ? <span className="tag" style={{ marginLeft: 6 }} title="Compra e venda do mesmo ativo no mesmo dia">⚡ Day trade{q !== o.q ? ` · ${q}` : ''}</span> : null}
                  {linked ? <span className="tag ok" style={{ marginLeft: 6 }} title={sale ? 'Valor da venda lançado como receita' : 'Valor da compra descontado do saldo (despesa)'}>{sale ? 'nas transações' : 'descontada do saldo'}</span> : null}
                </b>
                <small>
                  {o.q} × {brl(o.p)}
                  {sale && o.rp != null && <> · {o.rp < 0 ? 'prejuízo' : 'lucro'} <span className={o.rp < 0 ? 'dn' : 'up'}>{brl(Math.abs(o.rp))}</span></>}
                </small>
              </div>
              <span className={`val ${sale ? 'up' : ''}`} style={sale ? { fontSize: 16, fontWeight: 700 } : undefined}>{sale ? '+' : ''}{brl(o.q * o.p)}</span>
              <button className="x" title="Corrigir quantidade, preço ou data" aria-label="Corrigir operação" onClick={() => opForm(o.tp, { edit: o.id })}>✎</button>
            </div>
          );
        })}
      </div>
    );
  });

  if (compact) {
    return (
      <div className="card">
        <div className="top">
          <h3 style={{ margin: 0 }}>Operações recentes</h3>
          <button className="btn ghost" onClick={() => { S.st = 'extrato'; render(1); }}>Ver extrato completo</button>
        </div>
        {mSells.length > 0 && (
          <small>Este mês: vendido <b className="up">{brl(sum(mSells))}</b> · resultado <b className={res(mSells) < 0 ? 'dn' : 'up'}>{res(mSells) < 0 ? '−' : '+'}{brl(Math.abs(res(mSells)))}</b></small>
        )}
        {rows}
        {!S.ops.length && <small>Nenhuma operação.</small>}
      </div>
    );
  }

  return (
    <>
      <div className="grid g4">
        <div className="card"><h3>Vendido (soma)</h3><div className="big up" style={{ fontSize: 28 }}>{brl(sold)}</div><small>{sells.length} venda(s) {per === 'all' ? 'no total' : 'no mês'}</small></div>
        <div className="card"><h3>Resultado das vendas</h3><div className={`big ${profit < 0 ? 'dn' : 'up'}`} style={{ fontSize: 24 }}>{profit < 0 ? '−' : '+'}{brl(Math.abs(profit))}</div><small>lucro / prejuízo realizado</small></div>
        <div className="card"><h3>Comprado (soma)</h3><div className="big" style={{ fontSize: 24 }}>{brl(bought)}</div><small>{buys.length} compra(s) {per === 'all' ? 'no total' : 'no mês'}</small></div>
        <div className="card"><h3>⚡ Day trade</h3><div className="big" style={{ fontSize: 24 }}>{dtSells.length} venda(s)</div><small>resultado <span className={dtRes < 0 ? 'dn' : 'up'}>{dtRes < 0 ? '−' : '+'}{brl(Math.abs(dtRes))}</span></small></div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="filters">
          <div className="rng">
            {[['all', 'Todas'], ['Venda', '🔴 Vendas'], ['Compra', '🟢 Compras']].map(([k, l]) => (
              <button key={k} className={kind === k ? 'on' : ''} onClick={() => set({ xf: k, xe: 30 })}>{l}</button>
            ))}
          </div>
          <div className="rng">
            <button aria-label="Mês anterior" onClick={() => set({ xp: String(off - 1), xe: 30 })}>‹</button>
            <button className={per !== 'all' ? 'on' : ''} style={{ minWidth: 150, textTransform: 'capitalize' }} title="Voltar para este mês" onClick={() => set({ xp: '0', xe: 30 })}>{per === 'all' ? 'Escolher mês' : mi(off).lab}</button>
            <button aria-label="Próximo mês" disabled={per === 'all' || off >= 0} onClick={() => set({ xp: String(Math.min(0, off + 1)), xe: 30 })}>›</button>
            <button className={per === 'all' ? 'on' : ''} onClick={() => set({ xp: 'all', xe: 30 })}>Tudo</button>
          </div>
        </div>
        {rows}
        {!list.length && <p className="sub" style={{ marginTop: 14 }}>Nenhuma operação {per === 'all' ? 'neste filtro' : 'neste mês'}.</p>}
        {list.length > lim && <div style={{ textAlign: 'center', marginTop: 12 }}><button className="btn ghost" onClick={() => set({ xe: lim + 30 })}>Mostrar mais ({list.length - lim})</button></div>}
      </div>
    </>
  );
}

function Prov() {
  const { S, mi, QT, fd, rearm, delWatch, delDiv } = cx();
  const m = useMounted();
  const M: [number, string][] = [5, 4, 3, 2, 1, 0].map((k) => {
    const I = mi(-k);
    return [S.divs.filter((x: any) => x.dt >= I.a && x.dt <= I.b).reduce((a: number, x: any) => a + x.v, 0), I.s];
  });
  const mxd = Math.max(...M.map((x) => x[0]), 1);
  return (
    <>
      <div className="grid g2">
        <div className="card">
          <h3>Proventos por mês</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 130 }}>
            {M.map(([v, l]) => (
              <div key={l} style={{ flex: 1, textAlign: 'center' }} title={brl(v)}>
                <div style={{ height: 100, display: 'flex', alignItems: 'flex-end' }}>
                  <i className="rb" style={{ width: '100%', borderRadius: '4px 4px 0 0', background: 'var(--in)', height: m ? `${v / mxd * 100}%` : 0, transition: 'height .7s cubic-bezier(.2,.8,.2,1)' }} />
                </div>
                <small>{l}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Alertas de preço</h3>
          {S.watch.length ? S.watch.map((w: any) => {
            const c = QT[w.t] || w.alvo, dist = (w.alvo - c) / c * 100;
            return (
              <div key={w.id} className="row bw">
                <div className="ico">🔔</div>
                <div className="t"><b>{w.t} <small>{brl(c)}</small></b><small>{w.dir === 'up' ? 'Avisar ao subir até' : 'Avisar ao cair até'} {brl(w.alvo)} · falta {Math.abs(dist).toFixed(1)}%</small></div>
                {w.hit ? (<><span className="tag ok">Atingido</span><button className="btn ghost" onClick={() => rearm(w.id)}>Rearmar</button></>) : <span className="tag">Monitorando</span>}
                <button className="x" aria-label="Excluir" onClick={() => delWatch(w.id)}>×</button>
              </div>
            );
          }) : <small>Nenhum alerta. Crie um com "+ Alerta".</small>}
        </div>
      </div>
      <div className="grid g2" style={{ marginTop: 12 }}>
        <Extrato compact />
        <div className="card">
          <h3>Histórico de proventos</h3>
          {[...S.divs].sort((a: any, b: any) => b.dt.localeCompare(a.dt)).slice(0, 8).map((x: any) => (
            <div key={x.id} className="row">
              <div className="ico">💰</div>
              <div className="t"><b>{x.t}</b><small>{fd(x.dt)}</small></div>
              <span className="tag">{x.tp}</span>
              <span className="val up">+{brl(x.v)}</span>
              <button className="x" aria-label="Excluir" onClick={() => delDiv(x.id)}>×</button>
            </div>
          ))}
          {!S.divs.length && <small>Nenhum provento registrado.</small>}
        </div>
      </div>
    </>
  );
}

function Explore() {
  const { S, QT, LH, an, render, pickS, buyForm, favT } = cx();
  const q: string = (S.xq || '').trim(), ty: string = S.xt || 'all', se: string = S.xs || 'all', od: string = S.xo || 'dy', lim: number = S.xl || 9;
  const [items, setItems] = useState<CatItem[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  const [, bump] = useState(0);

  // busca no catálogo da B3 (com atraso enquanto digita); sem texto = lista inicial de ativos populares
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    const id = setTimeout(() => {
      catalogSearch(q).then((r) => { if (alive) { setItems(r); setStatus('ok'); } }).catch(() => { if (alive) setStatus('error'); });
    }, q ? 350 : 0);
    return () => { alive = false; clearTimeout(id); };
  }, [q, retry]);

  const secs = [...new Set((items || []).map((i) => i.sector))].sort() as string[];
  const L = (items || []).filter((i) => (ty === 'all' || i.kind === ty) && (se === 'all' || i.sector === se))
    .map((i) => ({ i, A: LH[i.t] ? an(i.t) : null }));
  const K: Record<string, (x: any) => number> = {
    dy: (x) => x.i.dy, r12: (x) => (x.A ? x.A.r12 : -Infinity), vol: (x) => (x.A ? -x.A.vol : -Infinity), preco: (x) => -(QT[x.i.t] || x.i.price),
  };
  L.sort((a, b) => (od === 'nome' ? a.i.t.localeCompare(b.i.t) : K[od](b) - K[od](a)));

  // histórico real dos cards (para retorno 12m, volatilidade, RSI e a miniatura); ordenar por retorno/volatilidade precisa de todos
  const need = (od === 'r12' || od === 'vol' ? L : L.slice(0, lim)).map((x) => x.i.t).filter((t) => !LH[t]);
  const needKey = need.join(',');
  useEffect(() => {
    if (!needKey) return;
    let alive = true;
    (async () => {
      const list = needKey.split(',');
      for (let k = 0; k < list.length; k += 3) {
        await Promise.all(list.slice(k, k + 3).map((t) => loadHistory(t)));
        if (alive) bump((n) => n + 1);
      }
    })();
    return () => { alive = false; };
  }, [needKey]);

  const set = (patch: Record<string, any>, anim?: boolean) => { Object.assign(S, patch); render(anim ? 1 : undefined); };
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="top"><h3 style={{ margin: 0 }}>Encontrar novos ativos</h3><small>Ações, FIIs e ETFs da B3 · dados do Yahoo Finance</small></div>
        <div className="filters" style={{ marginTop: 12 }}>
          <input placeholder="Buscar por ticker ou nome (ex: PETR4, Itaú, Vale)" value={S.xq || ''} autoComplete="off" onChange={(e) => set({ xq: e.target.value, xl: 9 })} />
          <div className="rng">
            {[['all', 'Todos'], ['acao', 'Ações'], ['fii', 'FIIs'], ['etf', 'ETFs']].map(([k, l]) => (
              <button key={k} className={ty === k ? 'on' : ''} onClick={() => set({ xt: k, xl: 9 })}>{l}</button>
            ))}
          </div>
          <select value={se} onChange={(e) => set({ xs: e.target.value, xl: 9 })} aria-label="Setor">
            <option value="all">Todos os setores</option>
            {secs.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select value={od} onChange={(e) => set({ xo: e.target.value })} aria-label="Ordenar">
            {[['dy', 'Maior dividend yield'], ['r12', 'Maior valorização 12m'], ['vol', 'Menor volatilidade'], ['preco', 'Menor preço'], ['nome', 'Ticker A–Z']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {(S.fav || []).length > 0 && (
          <div className="tools" style={{ marginTop: 10, flexWrap: 'wrap' }}><small>⭐ Seguindo:</small>{S.fav.map((t: string) => <button key={t} className="chip" onClick={() => pickS(t)}>{t}</button>)}</div>
        )}
        {(S.sh || []).length > 0 && (
          <div className="tools" style={{ marginTop: 8, flexWrap: 'wrap' }}><small>Recentes:</small>{S.sh.map((t: string) => <button key={t} className="chip" onClick={() => pickS(t)}>{t}</button>)}</div>
        )}
      </div>
      {status === 'error' && !items ? (
        <div className="card">
          <p className="sub" style={{ margin: '0 0 10px' }}>Não foi possível consultar o catálogo agora.</p>
          <button className="btn" onClick={() => setRetry(retry + 1)}>Tentar de novo</button>
        </div>
      ) : !items ? (
        <div className="card"><p className="sub" style={{ margin: 0 }}>Buscando ativos…</p></div>
      ) : L.length ? (
        <div style={{ opacity: status === 'loading' ? 0.55 : 1, transition: 'opacity .15s' }}>
          <div className="grid g3">
            {L.slice(0, lim).map(({ i, A }) => {
              const own = S.stocks.some((o: any) => o.t === i.t), fav = (S.fav || []).includes(i.t);
              return (
                <div key={i.t} className="card">
                  <div className="top">
                    <div><b style={{ fontSize: 16, cursor: 'pointer' }} onClick={() => pickS(i.t)}>{i.t}</b> {own && <span className="tag ok">Na carteira</span>}<br /><small>{i.name} · {i.sector}</small></div>
                    <button className="x" title={fav ? 'Deixar de seguir' : 'Seguir'} onClick={() => favT(i.t)}>{fav ? '⭐' : '☆'}</button>
                  </div>
                  <div className="top" style={{ margin: '10px 0' }}>
                    <span className="big" style={{ fontSize: 20 }}>{brl(QT[i.t] || i.price)}</span>
                    {A ? <Spk H={A.s.slice(-60)} w={110} h={32} /> : <small>…</small>}
                  </div>
                  <div className="top"><small>Retorno 12m</small>{A ? <Pct v={A.r12} /> : <small>…</small>}</div>
                  <div className="top"><small>Dividend yield</small><b>{i.dy.toFixed(1)}%</b></div>
                  <div className="top"><small>Volatilidade</small>{A ? <b>{A.vol.toFixed(0)}%</b> : <small>…</small>}</div>
                  <div className="top"><small>RSI (14)</small>{A ? <b className={A.rsi > 70 ? 'dn' : A.rsi < 30 ? 'up' : ''}>{A.rsi.toFixed(0)}</b> : <small>…</small>}</div>
                  <div className="tools" style={{ marginTop: 12 }}><button className="btn ghost" onClick={() => pickS(i.t)}>Ver detalhes</button><button className="btn" onClick={() => buyForm(0, i.t)}>+ Comprar</button></div>
                </div>
              );
            })}
          </div>
          {L.length > lim && <div style={{ textAlign: 'center', marginTop: 12 }}><button className="btn ghost" onClick={() => set({ xl: lim + 9 })}>Mostrar mais ({L.length - lim})</button></div>}
        </div>
      ) : (
        <div className="card">
          <p className="sub" style={{ margin: '0 0 10px' }}>Nenhum ativo da B3 encontrado para essa busca.</p>
          {/^[a-z]{4}\d{1,2}$/i.test(q) && <button className="btn" onClick={() => pickS(q.toUpperCase())}>Tentar abrir {q.toUpperCase()} mesmo assim</button>}
        </div>
      )}
    </>
  );
}

function SimBuy({ t, price }: { t: string; price: number }) {
  const { S, px } = cx();
  const [q, setQ] = useState<number>(S.sbq || 100);
  const own = S.stocks.find((x: any) => x.t === t), mv = S.stocks.reduce((a: number, x: any) => a + x.q * px(x), 0), cost = q * price, nq = (own ? own.q : 0) + q, npm = own ? (own.q * own.pm + cost) / nq : price;
  return (
    <>
      <div className="lim" style={{ margin: '0 0 8px' }}>
        <input type="number" min="1" step="1" value={q} onChange={(e) => { S.sbq = +e.target.value || 0; setQ(+e.target.value || 0); }} aria-label="Quantidade" />
        <span>ações</span>
      </div>
      <div>
        Custo: <b>{brl(cost)}</b> · peso na carteira de ações: <b>{Math.trunc((cost + (own ? own.q * price : 0)) / (mv + cost || 1) * 100)}%</b>
        {own && <><br />Novo preço médio: <b>{brl(npm)}</b> <small>(hoje {brl(own.pm)})</small></>}
      </div>
      {own && <p className="sub" style={{ margin: '10px 0 0' }}>Sua posição: {own.q} ações · PM {brl(own.pm)} · resultado <Pct v={(price / own.pm - 1) * 100} /> ({brl(own.q * (price - own.pm))})</p>}
    </>
  );
}

/** Carrega cotação, fundamentos e histórico real do ativo e só então mostra a análise. */
function Analise() {
  const { S, QT, LH, an, stkClose } = cx();
  const t: string = S.sq;
  const [done, setDone] = useState(false);
  useEffect(() => {
    let alive = true;
    setDone(false);
    loadTicker(t).then(() => { if (alive) setDone(true); });
    return () => { alive = false; };
  }, [t]);
  if (!QT[t] || !LH[t] || !an(t)) {
    return (
      <div className="card">
        <div className="top">
          <h3 style={{ margin: 0 }}>{t}</h3>
          <button className="btn ghost" onClick={() => stkClose()}>← Voltar</button>
        </div>
        <p className="sub" style={{ margin: '10px 0 0' }}>
          {done ? `Não foi possível carregar os dados de ${t}. Confira o ticker ou tente de novo em instantes.` : `Carregando cotação e histórico de ${t}…`}
        </p>
      </div>
    );
  }
  return <AnaliseBody />;
}

function AnaliseBody() {
  const { S, CAT, QT, OQ, an, px, render, buyForm, watchForm, favT, stkClose } = cx();
  const t: string = S.sq, c = CAT[t] || [t, 'Outros', QT[t], 0, 0, 0, 1], A = an(t), price: number = QT[t],
    own = S.stocks.find((x: any) => x.t === t), o = OQ[t] || price, dch = (price - o) / o * 100,
    mv = S.stocks.reduce((a: number, x: any) => a + x.q * px(x), 0), pro: string[] = [], att: string[] = [];
  if (price > A.sma50) pro.push('Preço acima da média de 50 dias: tendência de curto prazo positiva.'); else att.push('Preço abaixo da média de 50 dias: tendência de curto prazo fraca.');
  if (A.sma50 > A.sma200) pro.push('Média de 50 dias acima da de 200: tendência de médio prazo positiva.'); else att.push('Média de 50 dias abaixo da de 200: tendência de médio prazo negativa.');
  if (A.rsi < 30) pro.push(`RSI em ${A.rsi.toFixed(0)}: zona de sobrevenda, possível repique.`);
  if (A.rsi > 70) att.push(`RSI em ${A.rsi.toFixed(0)}: zona de sobrecompra, risco de correção.`);
  if (A.r6 > 0) pro.push(`Valorização de ${A.r6.toFixed(1)}% em 6 meses.`); else att.push(`Queda de ${Math.abs(A.r6).toFixed(1)}% em 6 meses.`);
  if (c[3] >= 6) pro.push(`Dividend yield de ${Number(c[3]).toFixed(1)}% ao ano.`);
  if (A.vol > 35) att.push(`Volatilidade anual de ${A.vol.toFixed(0)}%: oscila bastante.`);
  if (A.md < -25) att.push(`Queda máxima de ${Math.abs(A.md).toFixed(0)}% no último ano.`);
  if (A.pos > 90) att.push('Preço perto da máxima de 52 semanas.');
  if (A.pos < 15) pro.push('Preço perto da mínima de 52 semanas (entenda o motivo da queda).');
  if (own && own.q * price / (mv || 1) > 0.25) att.push(`Já representa ${(own.q * price / mv * 100).toFixed(0)}% da sua carteira de ações.`);
  const tr = price > A.sma50 && A.sma50 > A.sma200 ? ['Alta', 'up'] : price < A.sma50 && A.sma50 < A.sma200 ? ['Baixa', 'dn'] : ['Lateral', ''],
    rk = A.vol < 22 ? 'Baixo' : A.vol < 38 ? 'Moderado' : 'Alto',
    mx = Math.max(...A.mo.map((x: any) => Math.abs(x.r)), 1), R: string = S.sr || '3M', following = (S.fav || []).includes(t);
  const toggle = (k: 'm20' | 'm50') => { S[k] = S[k] === false; render(); };
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="top">
          <div><span className="big" style={{ fontSize: 26 }}>{t}</span> <span className="tag">{c[1]}</span><br /><small>{c[0]}</small></div>
          <div style={{ textAlign: 'right' }}><div className="big" style={{ fontSize: 26 }}>{brl(price)}</div><small className={dch < 0 ? 'dn' : 'up'}>{dch < 0 ? '↓' : '↑'} {Math.abs(dch).toFixed(2)}% hoje</small></div>
          <div className="tools">
            <button className="btn" onClick={() => buyForm(0, t)}>+ Comprar</button>
            <button className="btn ghost" onClick={() => watchForm(t)}>🔔 Criar alerta</button>
            <button className="btn ghost" onClick={() => favT(t)}>{following ? '⭐ Seguindo' : '☆ Seguir'}</button>
            <button className="btn ghost" onClick={() => stkClose()}>← Voltar</button>
          </div>
        </div>
        <div className="top" style={{ marginTop: 14 }}>
          <div className="rng">{['1M', '3M', '6M', '1A'].map((r) => <button key={r} className={R === r ? 'on' : ''} onClick={() => { S.sr = r; render(); }}>{r}</button>)}</div>
          <div className="tools">
            <label className="tag" style={{ cursor: 'pointer' }}><input type="checkbox" className="ck" style={{ verticalAlign: 'middle' }} checked={S.m20 !== false} onChange={() => toggle('m20')} /> <span style={{ color: '#f59e0b' }}>━</span> MM20</label>
            <label className="tag" style={{ cursor: 'pointer' }}><input type="checkbox" className="ck" style={{ verticalAlign: 'middle' }} checked={S.m50 !== false} onChange={() => toggle('m50')} /> <span style={{ color: '#ec4899' }}>━</span> MM50</label>
            {own && <span className="tag">┅ seu preço médio</span>}
          </div>
        </div>
        <StockChart key={`${t}-${R}`} ticker={t} />
        <p className="sub" style={{ margin: '6px 0 0' }}>Dados históricos do Yahoo Finance (B3). Não são recomendação de investimento.</p>
      </div>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <div className="card"><h3>Retorno</h3>{[['1 mês', A.r1], ['3 meses', A.r3], ['6 meses', A.r6], ['12 meses', A.r12]].map(([l, v]) => <div key={l as string} className="lg"><span>{l}</span><Pct v={v as number} /></div>)}</div>
        <div className="card">
          <h3>Faixa de 52 semanas</h3>
          <div className="lg"><span>Máxima</span><b>{brl(A.hi)}</b></div>
          <div className="lg"><span>Mínima</span><b>{brl(A.lo)}</b></div>
          <div className="pb mk"><i style={{ width: `${A.pos}%`, background: 'var(--b)' }} /></div>
          <small>{A.pos.toFixed(0)}% do intervalo · {((price / A.hi - 1) * 100).toFixed(1)}% da máxima</small>
        </div>
        <div className="card">
          <h3>Indicadores técnicos</h3>
          <div className="lg"><span>Tendência</span><b className={tr[1]}>{tr[0]}</b></div>
          <div className="lg"><span>RSI (14)</span><b className={A.rsi > 70 ? 'dn' : A.rsi < 30 ? 'up' : ''}>{A.rsi.toFixed(0)}</b></div>
          <div className="lg"><span>MM20 / MM50 / MM200</span><small>{A.sma20.toFixed(2)} · {A.sma50.toFixed(2)} · {A.sma200.toFixed(2)}</small></div>
          <div className="lg"><span>Suporte / resistência 60d</span><small>{brl(A.sup)} · {brl(A.res)}</small></div>
        </div>
        <div className="card">
          <h3>Risco e fundamentos</h3>
          <div className="lg"><span>Volatilidade anual</span><b>{A.vol.toFixed(0)}% <small>({rk})</small></b></div>
          <div className="lg"><span>Queda máx. 12m</span><b className="dn">{A.md.toFixed(1)}%</b></div>
          <div className="lg"><span>Dividend yield</span><b>{Number(c[3]).toFixed(1)}%</b></div>
          <div className="lg"><span>P/L · ROE · Beta</span><small>{c[4] ? Number(c[4]).toFixed(1) : '—'} · {c[5] ? Number(c[5]).toFixed(1) + '%' : '—'} · {c[6] ? Number(c[6]).toFixed(2) : '—'}</small></div>
        </div>
      </div>
      <div className="grid g21" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>Retorno por mês (últimos 12)</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {A.mo.map((x: any, i: number) => (
              <div key={i} style={{ flex: 1, textAlign: 'center' }} title={`${x.r.toFixed(1)}%`}>
                <div style={{ position: 'relative', height: 90 }}>
                  <i style={{ position: 'absolute', left: '15%', right: '15%', [x.r >= 0 ? 'bottom' : 'top']: '50%', height: `${Math.abs(x.r) / mx * 50}%`, background: x.r >= 0 ? 'var(--in)' : 'var(--out)', borderRadius: 3 }} />
                </div>
                <small>{new Date(x.d + 'T12:00').toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card"><h3>Simulador de compra</h3><SimBuy key={t} t={t} price={price} /></div>
      </div>
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <div className="card"><h3>✅ Pontos a favor ({pro.length})</h3>{pro.map((x) => <div key={x} className="ins"><span>{x}</span></div>)}{!pro.length && <small>Nenhum ponto forte nos indicadores.</small>}</div>
        <div className="card"><h3>⚠️ Pontos de atenção ({att.length})</h3>{att.map((x) => <div key={x} className="ins"><span>{x}</span></div>)}{!att.length && <small>Nenhum alerta nos indicadores.</small>}</div>
      </div>
    </>
  );
}

/** Tela de Ações — equivalente à "stk" do financas8.html. */
export function Stocks() {
  const { S, ensureQ, toast, buyForm, sellForm, watchForm, divForm } = cx();
  ensureQ();
  const T: string = S.st === 'ativo' && !S.sq ? 'carteira' : S.st || 'carteira';
  return (
    <>
      <PageHead title="Ações" sub="Carteira B3 · cotações via Yahoo Finance">
        <div className="tools ts">
          <span className="tag"><span className="live" />cotações ao vivo</span>
          <button className="btn ghost" onClick={() => window.__refreshQuotes?.().then(() => toast('Cotações atualizadas'))}>↻ Atualizar</button>
          <button className="btn ghost" onClick={() => watchForm()}>+ Alerta</button>
          <button className="btn ghost" onClick={() => divForm()}>+ Provento</button>
          <button className="btn mp" onClick={() => buyForm()}>+ Compra</button>
          <button className="btn mp" style={{ background: 'var(--out)', color: '#fff' }} onClick={() => sellForm()}>− Venda</button>
        </div>
      </PageHead>
      <Tabs T={T} />
      {T === 'carteira' && <Carteira />}
      {T === 'extrato' && <Extrato />}
      {T === 'prov' && <Prov />}
      {T === 'explorar' && <Explore />}
      {T === 'ativo' && S.sq && <Analise />}
    </>
  );
}
