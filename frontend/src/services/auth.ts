import { api } from './api';

export interface User { id: string; name: string; email: string }
export interface Session { token: string; user: User }

const TOKEN = 'caixa_token';
const USER = 'caixa_user';

/** Extrai a mensagem de erro no formato da API ({ error: string | [{message}] }). */
export function apiError(e: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = (e as any)?.response;
  if (!r) {
    const err = e as { isAxiosError?: boolean; message?: string };
    return err?.isAxiosError ? 'Não foi possível falar com a API. Ela está rodando?' : String(err?.message || e);
  }
  if (typeof r.data === 'string' && /Cannot (GET|POST|PUT|DELETE)/.test(r.data)) {
    return `a API ainda não tem a rota ${r.data.match(/Cannot (\w+) ([^\s<]+)/)?.slice(1).join(' ')}`;
  }
  const er = r.data?.error;
  if (Array.isArray(er)) return er.map((x: { message: string }) => x.message).join(' · ');
  return er || `erro ${r.status}`;
}

export function getSession(): Session | null {
  try {
    const token = localStorage.getItem(TOKEN);
    const user = JSON.parse(localStorage.getItem(USER) || 'null');
    if (!token || !user) return null;
    const exp = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp;
    if (exp && exp * 1000 < Date.now()) return null;
    return { token, user };
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<Session> {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem(TOKEN, data.token);
  localStorage.setItem(USER, JSON.stringify(data.user));
  return { token: data.token, user: data.user };
}

export async function register(name: string, email: string, password: string): Promise<Session> {
  await api.post('/auth/register', { name, email, password });
  return login(email, password);
}

export function logout() {
  localStorage.removeItem(TOKEN);
  localStorage.removeItem(USER);
  location.reload();
}
