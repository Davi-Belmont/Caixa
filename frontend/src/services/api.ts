import axios from 'axios';

/**
 * Em desenvolvimento o Vite faz proxy de /api -> API (veja vite.config.ts), então não há problema de CORS.
 * Em produção, defina VITE_API_URL (ex.: https://minha-api.com) e habilite CORS na API.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('caixa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token vencido/inválido: volta para a tela de login.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url: string = error?.config?.url || '';
    if (error?.response?.status === 401 && !url.startsWith('/auth/')) window.__logout?.();
    return Promise.reject(error);
  },
);
