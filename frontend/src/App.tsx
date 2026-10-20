import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import shellHtml from './legacy/shell.html?raw';
import caixaCode from './legacy/caixa.js?raw';
import { Login } from './components/Login';
import { ReactViews } from './ReactViews';
import { pushView } from './lib/cx';
import { apiError, getSession, logout, type Session } from './services/auth';
import { boot, fetchAll, refreshQuotes, reload, scheduleSync } from './services/sync';
import { catalogSearch, ensureQuotes, loadTicker } from './services/market';
import './index.css';

window.__logout = logout;

// O script legado (telas ainda não migradas) só pode iniciar uma vez por carregamento da página.
let started = false;

function Shell() {
  useEffect(() => {
    if (started) return;
    started = true;
    // Painel e Ações são componentes React montados em #rxm; as demais telas ainda vêm do script
    // original, que chama window.__rx() a cada render().
    window.__rx = pushView;
    window.__boot = boot;
    window.__sync = scheduleSync;
    window.__reload = () => reload();
    window.__refreshQuotes = refreshQuotes;
    window.__loadTicker = loadTicker;
    window.__searchCatalog = (q) => catalogSearch(q).then((items) => items.map((i) => i.t));
    window.__ensureQuotes = (ts) => ensureQuotes(ts);
    createRoot(document.getElementById('rxm')!).render(<ReactViews />);
    // O script usa handlers inline (onclick="go('tx')"...), então roda como script clássico.
    const s = document.createElement('script');
    s.text = caixaCode;
    document.body.appendChild(s);
  }, []);
  return <div dangerouslySetInnerHTML={{ __html: shellHtml }} />;
}

/** Busca os dados na API antes de montar a interface (evita piscar tela vazia). */
function Boot({ session }: { session: Session }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (started) { setState('ready'); return; }
    let alive = true;
    window.__user = session.user;
    setState('loading');
    fetchAll()
      .then((d) => { if (!alive) return; window.__bootData = d; setState('ready'); })
      .catch((e) => { if (!alive) return; setErr(apiError(e)); setState('error'); });
    return () => { alive = false; };
  }, [session, attempt]);

  if (state === 'ready') return <Shell />;
  return (
    <div className="login">
      <form onSubmit={(e) => e.preventDefault()}>
        <h1>∞ Caixa</h1>
        {state === 'loading' ? (
          <p className="sub">Carregando suas finanças…</p>
        ) : (
          <>
            <p className="sub">Não foi possível carregar os dados.</p>
            <small className="dn">{err}</small>
            <button className="btn" onClick={() => setAttempt(attempt + 1)}>Tentar de novo</button>
            <button type="button" className="btn ghost" onClick={logout}>Sair</button>
          </>
        )}
      </form>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(getSession);
  if (!session) return <Login onDone={setSession} />;
  return <Boot session={session} />;
}

export default App;
