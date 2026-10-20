/** Grupos da regra 50/30/20 guardados na API. */
export const CATEGORY_GROUPS = ['NECESSITY', 'WANTS', 'FUTURE'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

const GROUP_ALIASES: Record<string, CategoryGroup> = {
  nec: 'NECESSITY', necessity: 'NECESSITY', necessidade: 'NECESSITY',
  des: 'WANTS', wants: 'WANTS', desejo: 'WANTS',
  fut: 'FUTURE', future: 'FUTURE', futuro: 'FUTURE',
};

/**
 * Aceita o grupo no formato da API (NECESSITY/WANTS/FUTURE) ou no do front (nec/des/fut).
 * Retorna: o grupo normalizado, `null` (sem grupo) ou `undefined` (valor inválido).
 */
export function normalizeGroup(raw: unknown): CategoryGroup | null | undefined {
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  return GROUP_ALIASES[raw.trim().toLowerCase()];
}

/** Normaliza o tipo da categoria para o padrão das transações: 'in' | 'out'. */
export function normalizeCategoryType(raw: unknown): 'in' | 'out' {
  const t = String(raw ?? '').toLowerCase();
  return t === 'income' || t === 'in' ? 'in' : 'out';
}

/** Mesmas categorias (nome, emoji, cor e grupo) que o front mostra na primeira execução. */
export const DEFAULT_CATEGORIES = [
  { name: 'Moradia', icon: '🏠', color: '#3a5bff', group: 'NECESSITY', type: 'out' },
  { name: 'Alimentação', icon: '🍽️', color: '#8b5cf6', group: 'NECESSITY', type: 'out' },
  { name: 'Transporte', icon: '🚌', color: '#ec4899', group: 'NECESSITY', type: 'out' },
  { name: 'Saúde', icon: '💊', color: '#3ddc97', group: 'NECESSITY', type: 'out' },
  { name: 'Lazer', icon: '🎬', color: '#f59e0b', group: 'WANTS', type: 'out' },
  { name: 'Educação', icon: '📚', color: '#22b8cf', group: 'FUTURE', type: 'out' },
  { name: 'Salário', icon: '💼', color: '#9aa0a6', group: null, type: 'in' },
  { name: 'Extras', icon: '✨', color: '#9aa0a6', group: null, type: 'in' },
] as const;

/** Cria as categorias padrão de um usuário (use dentro da mesma transação do cadastro). */
export async function createDefaultCategoriesForUser(userId: string, tx: any) {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
  });
}
