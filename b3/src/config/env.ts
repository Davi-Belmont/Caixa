let warned = false;

/**
 * Segredo do JWT. Em produção é obrigatório (a API não sobe sem ele);
 * em desenvolvimento usa um valor local e avisa uma vez.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET não definido. Defina a variável de ambiente antes de iniciar a API.');
  }
  if (!warned) {
    console.warn('⚠️  JWT_SECRET não definido: usando segredo de desenvolvimento. Defina-o no .env.');
    warned = true;
  }
  return 'dev-only-secret-change-me';
}
