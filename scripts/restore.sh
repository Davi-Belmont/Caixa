#!/usr/bin/env bash
# Restaura um backup:  ./scripts/restore.sh backups/caixa-20261019-120000.sql.gz
# ATENÇÃO: substitui os dados atuais do banco.
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 1 ] && [ -f "$1" ] || { echo "uso: $0 arquivo.sql.gz"; exit 1; }
read -r -p "Isto SUBSTITUI os dados atuais. Continuar? (digite sim) " r
[ "$r" = "sim" ] || { echo "cancelado"; exit 1; }
gunzip -c "$1" | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'
echo "Restaurado. Reinicie a API:  docker compose restart api"
