-- Percentuais da regra 50/30/20 por usuário
ALTER TABLE "user_configs" ADD COLUMN     "ruleFuture" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "ruleNecessity" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "ruleWants" INTEGER NOT NULL DEFAULT 30;

-- Padroniza o tipo das categorias para 'in' / 'out' (o mesmo das transações)
UPDATE "categories" SET "type" = 'out' WHERE LOWER("type") IN ('expense', 'out');
UPDATE "categories" SET "type" = 'in'  WHERE LOWER("type") IN ('income', 'in');
