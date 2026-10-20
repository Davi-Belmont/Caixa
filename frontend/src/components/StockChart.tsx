import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { brl } from './ui';

const H = 260;
const RANGE: Record<string, number> = { '1M': 21, '3M': 63, '6M': 126, '1A': 252 };

/** Gráfico de preço do ativo com MM20/MM50 e linha do seu preço médio. */
export function StockChart({ ticker }: { ticker: string }) {
  const { S, an, fd } = cx();
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);
  const [W, setW] = useState(0);
  const [hv, setHv] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current!;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ready = W > 0;
  useEffect(() => {
    const ln = line.current;
    if (!ln) return;
    const L = ln.getTotalLength();
    ln.style.strokeDasharray = String(L);
    ln.style.strokeDashoffset = String(L);
    const id = requestAnimationFrame(() => {
      ln.style.transition = 'stroke-dashoffset .9s ease-out';
      ln.style.strokeDashoffset = '0';
    });
    return () => cancelAnimationFrame(id);
  }, [ready]);

  const A = an(ticker),
    n = Math.min(RANGE[S.sr || '3M'], A.N),
    i0 = A.N - n,
    P: number[] = A.s.slice(i0),
    own = S.stocks.find((x: { t: string }) => x.t === ticker),
    sm = (k: number) =>
      P.map((_, j) => {
        const i = i0 + j;
        return i >= k - 1 ? (A.s.slice(i - k + 1, i + 1) as number[]).reduce((a, b) => a + b, 0) / k : null;
      }),
    m20 = S.m20 !== false ? sm(20) : null,
    m50 = S.m50 !== false ? sm(50) : null,
    all = ([...P, ...(m20 || []), ...(m50 || [])].filter((v) => v != null) as number[]).concat(own ? [own.pm] : []),
    mn = Math.min(...all),
    mx = Math.max(...all),
    X = (j: number) => 50 + j / (n - 1) * (W - 58),
    Y = (v: number) => H - 26 - (v - mn) / (mx - mn || 1) * (H - 48),
    path = (a: (number | null)[]) => {
      let o = '',
        pen = false;
      a.forEach((v, j) => {
        if (v == null) {
          pen = false;
          return;
        }
        o += (pen ? 'L' : 'M') + X(j).toFixed(1) + ',' + Y(v).toFixed(1) + ' ';
        pen = true;
      });
      return o;
    },
    up = P[n - 1] >= P[0],
    col = up ? 'var(--in)' : 'var(--out)';

  const onMove = (e: React.MouseEvent) => {
    cx().setHov(true);
    const r = box.current!.getBoundingClientRect();
    setHv(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 50) / (W - 58) * (n - 1)))));
  };
  const leave = () => {
    cx().setHov(false);
    setHv(null);
  };
  useEffect(() => () => cx().setHov(false), []);
  const v = hv != null ? (P[hv] / P[0] - 1) * 100 : 0;

  return (
    <div className="chartw" style={{ height: 260 }} ref={box} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === 'mouse') leave(); }}>
      {ready && (
        <svg width={W} height={H}>
          {[0, 1 / 3, 2 / 3, 1].map((k) => {
            const y = mn + (mx - mn) * k;
            return (
              <g key={k}>
                <line x1="50" x2={W} y1={Y(y)} y2={Y(y)} stroke="var(--line)" />
                <text x="0" y={Y(y) + 4} fontSize="10" fill="var(--mut)">{y.toFixed(2)}</text>
              </g>
            );
          })}
          <path d={`${path(P)} L${X(n - 1)},${H - 26} L${X(0)},${H - 26}Z`} fill={col} opacity=".08" />
          {m50 && <path d={path(m50)} fill="none" stroke="#ec4899" strokeWidth="1.5" />}
          {m20 && <path d={path(m20)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />}
          {own && <line x1="50" x2={W} y1={Y(own.pm)} y2={Y(own.pm)} stroke="var(--ink)" strokeDasharray="5 4" opacity=".6" />}
          <path ref={line} d={path(P)} fill="none" stroke={col} strokeWidth="2.4" strokeLinejoin="round" />
          {hv != null && (
            <>
              <line x1={X(hv)} x2={X(hv)} y1="0" y2={H - 26} stroke="var(--mut)" strokeDasharray="3" />
              <circle cx={X(hv)} cy={Y(P[hv])} r="5" fill="var(--card)" stroke={col} strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      <div className="tip" style={hv != null ? { display: 'block', left: Math.min(X(hv) + 12, W - 190) } : undefined}>
        {hv != null && (
          <>
            {fd(A.S[i0 + hv].d)}/{A.S[i0 + hv].d.slice(0, 4)}
            <br />
            Fechamento: <b>{brl(P[hv])}</b>
            <br />
            No período: <span className={v < 0 ? 'dn' : 'up'}>{v >= 0 ? '+' : ''}{v.toFixed(1)}%</span>
            {m20 && m20[hv] != null && (<><br /><small>MM20 {(m20[hv] as number).toFixed(2)}</small></>)}
            {m50 && m50[hv] != null && <> <small>MM50 {(m50[hv] as number).toFixed(2)}</small></>}
          </>
        )}
      </div>
    </div>
  );
}
