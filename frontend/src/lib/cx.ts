import { useEffect, useState, useSyncExternalStore } from 'react';

/** Ponte tipada para o estado e helpers do script legado (telas ainda não migradas). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cx = Record<string, any> & { S: any };

declare global {
  interface Window {
    CX: Cx;
    __rx: (view: string, anim?: boolean) => void;
    __user?: { id: string; name: string; email: string };
    __bootData?: unknown;
    __boot?: () => void;
    __sync?: () => void;
    __reload?: () => void;
    __logout?: () => void;
    __refreshQuotes?: () => Promise<void>;
    __loadTicker?: (t: string) => Promise<boolean>;
    __searchCatalog?: (q: string) => Promise<string[]>;
    __ensureQuotes?: (tickers: string[]) => Promise<boolean>;
  }
}

export const cx = (): Cx => window.CX;

type St = { view: string; anim: number; ver: number };
let st: St = { view: 'home', anim: 0, ver: 0 };
const subs = new Set<() => void>();

/** Chamado pelo render() do script legado sempre que o Painel/Ações precisam redesenhar. */
export const pushView = (view: string, anim?: boolean) => {
  st = { view, anim: anim ? st.anim + 1 : st.anim, ver: st.ver + 1 };
  subs.forEach((f) => f());
};

export const useRx = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => st,
  );

/** false no primeiro frame e true depois: faz barras e anéis "crescerem" via transição CSS. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setM(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}
