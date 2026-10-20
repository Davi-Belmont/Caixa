import { useEffect, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PageHead({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="top">
      <div>
        <h1>{title}</h1>
        <p className="sub">{sub}</p>
      </div>
      {children}
    </div>
  );
}

/** Número que "sobe" até o valor final em 600 ms, como no original. */
export function CountUp({ value }: { value: number }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const f = (now: number) => {
      const k = Math.min(1, (now - t0) / 600);
      setT(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{brl(t)}</>;
}

export function Spk({ H, w, h, fill }: { H: number[]; w: number; h: number; fill?: boolean }) {
  const mn = Math.min(...H),
    mx = Math.max(...H),
    pts = H.map((v, i) => (i / (H.length - 1) * w).toFixed(1) + ',' + (h - 3 - (v - mn) / (mx - mn || 1) * (h - 6)).toFixed(1)).join(' '),
    c = H[H.length - 1] >= H[0] ? 'var(--in)' : 'var(--out)';
  const props = fill
    ? { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', style: { width: '100%', height: h } }
    : { width: w, height: h };
  return (
    <svg {...props}>
      {fill && <polygon points={`0,${h} ${pts} ${w},${h}`} fill={c} opacity=".1" />}
      <polyline points={pts} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" vectorEffect={fill ? 'non-scaling-stroke' : undefined} />
    </svg>
  );
}

/** Linha de conta a pagar (usada no Painel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function BillRow({ b }: { b: any }) {
  const { dd, fd, unpay, billForm, delBill, copyCb } = cx();
  const n = Math.round((+new Date(b.due) - +new Date(dd(0))) / 864e5),
    late = !b.paid && n < 0,
    soon = !b.paid && n >= 0 && n <= 7,
    tx = b.paid
      ? `Paga em ${fd(b.paidAt || b.due)}`
      : late
        ? `Atrasada há ${-n} dia${n < -1 ? 's' : ''}`
        : n === 0
          ? 'Vence hoje'
          : n === 1
            ? 'Vence amanhã'
            : `Vence em ${n} dias (${fd(b.due)})`;
  return (
    <div className="row bw">
      <div className="ico">{b.paid ? '✅' : late ? '🔴' : soon ? '🟡' : '🧾'}</div>
      <div className="t">
        <b>
          {b.n}
          {b.rec === 'm' ? ' 🔁' : ''}
          {b.rec === 'p' && <span className="tag">{b.pk || 1}/{b.np}</span>}
        </b>
        <small>
          {b.c || 'Moradia'} · {tx}
          {b.rec === 'p' ? ` · restam ${(b.np || 1) - (b.pk || 1)} parcelas` : ''}
        </small>
      </div>
      <span className="val">{brl(b.paid && b.pv != null ? b.pv : b.v)}</span>
      {b.paid ? (
        <button className="btn ghost" onClick={() => unpay(b.id)}>Desfazer</button>
      ) : (
        <>
          <span className={`tag ${late ? 'late' : ''}`}>{late ? 'Atrasada' : soon ? 'Em breve' : 'Aberta'}</span>
          <button className="btn ghost" onClick={() => cx().pay(b.id)}>Pagar</button>
        </>
      )}
      {b.cb && <button className="x" title="Copiar código de barras / PIX" onClick={() => copyCb(b.id)}>📋</button>}
      <button className="x" title="Editar" onClick={() => billForm(b.id)}>✎</button>
      <button className="x" aria-label="Excluir" onClick={() => delBill(b.id)}>×</button>
    </div>
  );
}
