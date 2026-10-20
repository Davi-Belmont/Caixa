#!/usr/bin/env bash
# Backup do banco em backups/caixa-AAAAMMDD-HHMMSS.sql.gz (mantém os 14 mais recentes).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
arq="backups/caixa-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB"' | gzip > "$arq"
ls -1t backups/caixa-*.sql.gz | tail -n +15 | xargs -r rm --
echo "Backup salvo em $arq ($(du -h "$arq" | cut -f1))"
