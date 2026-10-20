# Caixa — deploy no homelab (Docker Compose)

Três containers: **db** (PostgreSQL 16) · **api** (Node/Express/Prisma) · **web** (Nginx: serve o app e repassa `/api` para a API).
Só a porta do **web** fica aberta; o banco e a API ficam na rede interna do Docker. Como o app e a API respondem no mesmo endereço, **não há CORS** para configurar.

```
caixa/
├── b3/                  # API (tem Dockerfile)
├── frontend/            # app web (tem Dockerfile + nginx.conf)
├── docker-compose.yml
├── .env.example         # copie para .env
└── scripts/             # backup.sh e restore.sh
```

## Pré-requisitos
- Linux com **Docker Engine + Docker Compose v2** (`docker compose version`).
- ~1 GB livre para as imagens. Funciona em x86-64 e ARM64 (Raspberry Pi 4/5).

## Instalação

```bash
cd caixa
cp .env.example .env
nano .env        # troque POSTGRES_PASSWORD e JWT_SECRET (gere com: openssl rand -hex 24 / -hex 48)
docker compose up -d --build
```

Na primeira vez a construção leva alguns minutos. Acompanhe com `docker compose logs -f api`: você verá
`Aplicando migrations...` e depois `API rodando na porta 3000`.

Abra **http://IP-DO-SERVIDOR:8080** (no celular também, na mesma rede Wi-Fi) e use **Criar conta** na tela de login.
Documentação da API: `http://IP-DO-SERVIDOR:8080/docs`.

> Porta 8080 já ocupada? Mude `WEB_PORT` no `.env`.

## Comandos do dia a dia

| O que | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Logs | `docker compose logs -f api` (ou `web`, `db`) |
| Parar / iniciar | `docker compose stop` / `docker compose start` |
| Reiniciar a API | `docker compose restart api` |
| Desligar (mantém os dados) | `docker compose down` |
| **Apagar tudo, inclusive o banco** | `docker compose down -v` ⚠️ |

Os containers têm `restart: unless-stopped`: sobem sozinhos quando o servidor reinicia.

## Atualizar para uma nova versão

Substitua as pastas `b3/` e/ou `frontend/` pelas novas (mantenha o `.env`) e rode:

```bash
docker compose up -d --build
```

As migrations do banco são aplicadas automaticamente ao iniciar a API (`prisma migrate deploy`); nenhum dado é apagado.

## Backup e restauração

```bash
./scripts/backup.sh                              # cria backups/caixa-AAAAMMDD-HHMMSS.sql.gz (guarda os 14 mais recentes)
./scripts/restore.sh backups/caixa-XXXX.sql.gz   # restaura (pede confirmação; substitui os dados atuais)
docker compose restart api
```

Backup diário às 03:00 (edite com `crontab -e`; ajuste o caminho):

```
0 3 * * * cd /srv/caixa && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Copie a pasta `backups/` também para fora do servidor (NAS, nuvem): backup no mesmo disco não protege contra falha do disco.

## Levar os dados do ambiente de desenvolvimento

Com o banco de desenvolvimento ainda de pé (container `caixa-postgres` do compose antigo):

```bash
docker exec caixa-postgres pg_dump -U postgres --no-owner --no-acl --clean --if-exists caixa_db | gzip > dev.sql.gz
docker compose up -d db                    # sobe só o banco novo
./scripts/restore.sh dev.sql.gz
docker compose up -d --build               # sobe API e web (aplica migrations que faltarem)
```

## HTTPS e acesso fora de casa (opcional)

Na rede local, HTTP funciona bem. Para acessar de fora, **não abra a porta 8080 direto na internet**: use HTTPS por um proxy reverso (Caddy, Traefik, Nginx Proxy Manager) ou uma VPN (WireGuard/Tailscale).
Se usar proxy reverso na mesma máquina, deixe o app acessível só localmente com `WEB_PORT=127.0.0.1:8080` no `.env` e aponte o proxy para `localhost:8080`. Exemplo de Caddyfile:

```
caixa.seudominio.com {
  reverse_proxy localhost:8080
}
```

## Segurança — vale saber

- O cadastro (`/auth/register`) é aberto: qualquer pessoa que alcance o app pode criar uma conta (os dados de cada conta são separados). Em rede doméstica isso costuma bastar; se for expor à internet, restrinja o cadastro antes.
- O `/docs` (Swagger) está publicado no Nginx por conveniência; remova o bloco `location /docs` de `frontend/nginx.conf` se expuser fora da rede local.
- Trocar o `JWT_SECRET` desconecta todos os usuários (precisam entrar de novo).
- Guarde o `.env` fora de repositórios (já está no `.gitignore`).

## Solução de problemas

| Sintoma | O que verificar |
|---|---|
| `web` não inicia / "host not found: api" | A API não ficou saudável: `docker compose logs api` |
| API reinicia em loop com erro de banco | Senha com caracteres especiais no `.env` (use só letras e números) ou `POSTGRES_*` alterados depois da 1ª subida (o banco já foi criado com os valores antigos; reverta, ou apague o volume com `down -v` se ainda não houver dados) |
| "JWT_SECRET não definido" | Preencha `JWT_SECRET` no `.env` e rode `docker compose up -d` |
| Cotações não aparecem | O servidor precisa de saída para a internet (Yahoo Finance). Teste: `docker compose exec api node -e "fetch('https://query1.finance.yahoo.com').then(r=>console.log(r.status))"` |
| Erro no build do frontend | `docker compose build web` mostra o erro; para checar tipos rode `npm run build` dentro de `frontend/` |
| Quero ver o banco | `docker compose exec db psql -U caixa caixa_db` |

> Este pacote foi montado e revisado sem poder executar o Docker no ambiente de criação: a primeira subida é o teste real. Se algo falhar, envie a saída de `docker compose logs`.
