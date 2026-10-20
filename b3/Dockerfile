# ===== API (Express + Prisma + PostgreSQL) =====
FROM node:22-slim AS build
WORKDIR /app
# openssl: exigido pelo Prisma; ca-certificates: downloads do npm/Prisma
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# o gerador do Prisma não conecta ao banco; a URL abaixo só satisfaz o prisma.config.ts
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
    && npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# node_modules inteiro (inclui a CLI do Prisma, necessária para "migrate deploy" ao iniciar)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts /app/package.json ./
COPY docker-entrypoint.sh ./
EXPOSE 3000
USER node
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
