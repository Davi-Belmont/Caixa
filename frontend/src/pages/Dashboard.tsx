import { cx, useMounted } from '../lib/cx';
import { BalanceChart } from '../components/BalanceChart';
import { BillRow, CountUp, PageHead, brl } from '../components/ui';

function Delta({ c }: { c: string }) {
  const { S, tot } = cx();
  const a = tot('out', S.per, 0, c),
    p = tot('out', S.per, S.per, c);
  if (!p) return <span className="up">novo</span>;
  const x = (a - p) / p * 100;
  return <span className={x > 0 ? 'dn' : 'up'}>{x > 0 ? '↑' : '↓'} {Math.abs(x).toFixed(1)}%</span>;
}

/** Cores das categorias que não fazem parte do orçamento. */
const EXTRA_COL: Record<string, string> = { Investimentos: '#f5a524' };

/** Painel inicial — equivalente à tela "home" do financas8.html. */
export function Dashboard() {
  const { S, tot, lim, pct, filt, render, goNew, COL, CATS } = cx();
  const m = useMounted();
  const n: number = S.per;
  const i = tot('in', n),
    o = tot('out', n),
    net = i - o,
    pn = tot('in', n, n) - tot('out', n, n),
    ch = pn ? (net - pn) / Math.abs(pn) * 100 : 0,
    cs: string[] = Object.keys(COL),
    // despesas em categorias fora do orçamento (ex.: "Investimentos", das compras de ações) também entram na divisão
    extra: string[] = [...new Set<string>(S.tx.filter((x: any) => x.tp === 'out' && !(x.c in COL)).map((x: any) => x.c))],
    top = [...cs, ...extra].map((c) => [c, tot('out', n, 0, c)] as [string, number]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4),
    rest = o - top.reduce((a, x) => a + x[1], 0),
    colorOf = (c: string) => COL[c] || EXTRA_COL[c] || '#8b8fa3',
    open = S.bills.filter((b: { paid: boolean }) => !b.paid);

  return (
    <>
      <PageHead title={`Olá, ${(window.__user?.name || '').split(' ')[0]}`} sub={`Resumo dos últimos ${n === 180 ? '6 meses' : n + ' dias'}`}>
        <div className="tools">
          <div className="rng">
            {[[30, '30D'], [90, '90D'], [180, '6M']].map(([v, l]) => (
              <button key={v} className={S.per === v ? 'on' : ''} onClick={() => { S.per = v; render(1); }}>{l}</button>
            ))}
          </div>
          <button className="btn dup" onClick={() => goNew()}>+ Nova transação</button>
        </div>
      </PageHead>

      <div className="chips">
        {cs.map((c) => (
          <button key={c} className="chip" onClick={() => filt(c)}>
            {CATS[c]} {c} {brl(tot('out', n, 0, c))} <Delta c={c} />
          </button>
        ))}
      </div>

      <div className="grid g12">
        <div className="card">
          <h3>Saldo do período</h3>
          <div className="big"><CountUp value={net} /></div>
          <span className={`badge ${ch < 0 ? 'dn' : 'up'}`}>{ch < 0 ? '↓' : '↑'} {Math.abs(ch).toFixed(1)}%</span>{' '}
          <small>vs. período anterior</small>
          <h3 style={{ marginTop: 20 }}>Para onde vai seu dinheiro</h3>
          <div className="stack">
            {top.map(([c, v]) => (
              <i key={c} title={c} onClick={() => filt(c)} style={{ width: m ? `${v / (o || 1) * 100}%` : 0, background: colorOf(c) }} />
            ))}
            {rest > o * 0.005 && <i title="Outros" style={{ width: m ? `${rest / (o || 1) * 100}%` : 0, background: '#3a3f55', cursor: 'default' }} />}
          </div>
          {top.map(([c, v]) => (
            <div key={c} className="lg" onClick={() => filt(c)}>
              <b style={{ background: colorOf(c) }} />
              <span>{c} <span className="tag">{Math.round(v / (o || 1) * 100)}%</span></span>
              <span className="val">{brl(v)}</span>
            </div>
          ))}
          {rest > o * 0.005 && (
            <div className="lg" style={{ cursor: 'default' }}>
              <b style={{ background: '#3a3f55' }} />
              <span>Outros <span className="tag">{Math.round(rest / (o || 1) * 100)}%</span></span>
              <span className="val">{brl(rest)}</span>
            </div>
          )}
        </div>
        <div className="card">
          <h3>Saldo ao longo do tempo · {window.matchMedia?.('(hover: none)').matches ? 'toque no gráfico' : 'passe o mouse'}</h3>
          <BalanceChart />
        </div>
      </div>

      <div className="grid g21" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>Desempenho por categoria · clique para detalhar</h3>
          <table className="perf">
            <tbody>
              <tr><th>Categoria</th><th>Orçamento usado</th><th>Gasto</th><th>Restante</th></tr>
              {cs.map((c) => {
                const s = tot('out', n, 0, c), l = lim(c);
                return (
                  <tr key={c} className="cl" onClick={() => filt(c)}>
                    <td>{CATS[c]} {c}</td>
                    <td>
                      <span className="mini"><i style={{ width: m ? `${pct(s, l)}%` : 0 }} /></span>
                      {Math.round(s / l * 100)}%
                    </td>
                    <td>{brl(s)}</td>
                    <td className={s > l ? 'dn' : ''}>{brl(l - s)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Contas em aberto</h3>
          {open.length ? open.map((b: { id: number }) => <BillRow key={b.id} b={b} />) : <small>Tudo pago.</small>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Comparação com o período anterior</h3>
        <div className="grid g3">
          {cs.map((c) => (
            <button key={c} className="cmp" onClick={() => filt(c)}>
              <div><span>{CATS[c]} {c}</span><Delta c={c} /></div>
              <span className="big" style={{ fontSize: 20 }}>{brl(tot('out', n, 0, c))}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
