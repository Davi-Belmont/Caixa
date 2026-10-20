#!/bin/sh
# Aplica as migrations pendentes (idempotente) e sobe a API.
set -e
echo "▶ Aplicando migrations..."
npx prisma migrate deploy
echo "▶ Iniciando a API..."
exec node dist/server.js
