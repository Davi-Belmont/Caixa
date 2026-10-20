import { useRx } from './lib/cx';
import { Dashboard } from './pages/Dashboard';
import { Stocks } from './pages/Stocks';

/** Renderiza as telas já migradas para React dentro do <main id="rxm">. */
export function ReactViews() {
  const { view, anim } = useRx();
  // key={anim}: remonta a tela quando o original chamaria render(1) (reanima barras e gráficos)
  if (view === 'home') return <Dashboard key={`h${anim}`} />;
  if (view === 'stk') return <Stocks key={`s${anim}`} />;
  return null;
}
