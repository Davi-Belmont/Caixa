import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '../lib/cx';
import { brl } from './ui';

const H = 230;

/** Saldo ao longo do tempo, com guia e tooltip ao passar o mouse ou tocar/arrastar. */
export function BalanceChart() {
  const { S, OPEN, dd, fd } = cx();
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

  const n: number = S.per;
  type Tx = { dt: string; tp: string; v: number };
  let bal: number = OPEN + (S.tx as Tx[]).filter((x) => x.dt < dd(-(n - 1))).reduce((a, x) => a + (x.tp === 'in' ? x.v : -x.v), 0);
  const A: { D: string; bal: number; nt: number; c: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const D = dd(-i),
      T = (S.tx as Tx[]).filter((x) => x.dt === D),
      nt = T.reduce((a, x) => a + (x.tp === 'in' ? x.v : -x.v), 0);
    bal += nt;
    A.push({ D, bal, nt, c: T.length });
  }
  const mn = Math.min(...A.map((a) => a.bal)),
    mx = Math.max(...A.map((a) => a.bal)),
    X = (i: number) => 40 + i / (n - 1) * (W - 48),
    Y = (v: number) => H - 24 - (v - mn) / (mx - mn || 1) * (H - 50),
    P = A.map((a, i) => X(i) + ',' + Y(a.bal)).join(' L');

  // animação de "desenhar" a linha ao montar
  const ready = W > 0;
  useEffect(() => {
    const ln = line.current;
    if (!ln) return;
    const L = ln.getTotalLength();
    ln.style.strokeDasharray = String(L);
    ln.style.strokeDashoffset = String(L);
    const id = requestAnimationFrame(() => {
      ln.style.transition = 'stroke-dashoffset 1s ease-out';
      ln.style.strokeDashoffset = '0';
    });
    return () => cancelAnimationFrame(id);
  }, [ready]);

  const onMove = (e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    setHv(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 40) / (W - 48) * (n - 1)))));
  };
  const a = hv != null ? A[hv] : null;

  return (
    <div className="chartw" ref={box} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHv(null); }}>
      {ready && (
        <svg width={W} height={H}>
          {[0, 0.5, 1].map((k) => (
            <g key={k}>
              <line x1="40" x2={W} y1={Y(mn + (mx - mn) * k)} y2={Y(mn + (mx - mn) * k)} stroke="var(--line)" />
              <text x="0" y={Y(mn + (mx - mn) * k) + 4} fontSize="10" fill="var(--mut)">
                {Math.round((mn + (mx - mn) * k) / 100) / 10}k
              </text>
            </g>
          ))}
          <path d={`M${P} L${X(n - 1)},${H - 24} L40,${H - 24}Z`} fill="var(--b)" opacity=".1" />
          <path ref={line} d={`M${P}`} fill="none" stroke="var(--b)" strokeWidth="2.5" strokeLinejoin="round" />
          {a && hv != null && (
            <>
              <line x1={X(hv)} x2={X(hv)} y1="0" y2={H - 24} stroke="var(--mut)" strokeDasharray="3" />
              <circle cx={X(hv)} cy={Y(a.bal)} r="5" fill="var(--card)" stroke="var(--b)" strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      <div className="tip" style={a && hv != null ? { display: 'block', left: Math.min(X(hv) + 12, W - 190) } : undefined}>
        {a && (
          <>
            {fd(a.D)}
            <br />
            Saldo: <b>{brl(a.bal)}</b>
            <br />
            Movimento do dia: <span className={a.nt < 0 ? 'dn' : 'up'}>{brl(a.nt)}</span> ({a.c})
          </>
        )}
      </div>
    </div>
  );
}
