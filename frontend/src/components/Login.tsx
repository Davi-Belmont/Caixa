import { useState, type FormEvent } from 'react';
import { apiError, login, register, type Session } from '../services/auth';

/** Mesma tela de login do financas8.html (classes .login), agora autenticando na API. */
export function Login({ onDone }: { onDone: (s: Session) => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      onDone(mode === 'up' ? await register(name, email, password) : await login(email, password));
    } catch (ex) {
      setErr(apiError(ex));
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>∞ Caixa</h1>
        <p className="sub">{mode === 'in' ? 'Entre para ver suas finanças.' : 'Crie sua conta para começar.'}</p>
        {mode === 'up' && <input type="text" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />}
        <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'up' ? 6 : 1} />
        {err && <small className="dn">{err}</small>}
        <button className="btn" disabled={busy}>{busy ? '...' : mode === 'in' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="btn ghost" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
          {mode === 'in' ? 'Criar conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  );
}
