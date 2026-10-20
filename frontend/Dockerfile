# ===== Frontend (Vite/React) servido pelo Nginx =====
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Sem VITE_API_URL o app chama "/api/..." no mesmo endereço; o Nginx repassa para a API (sem CORS).
# "vite build" gera os arquivos; para checar tipos use "npm run build" (tsc -b && vite build) no seu computador.
RUN npx vite build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
