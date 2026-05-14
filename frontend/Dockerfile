###########################################################
# Scholar Agent frontend — Vite + React + TypeScript
# Multi-stage: Node build → nginx static serve.
###########################################################

# ── Stage 1: build ───────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# VITE_API_BASE is baked at build-time. Override with build arg if needed.
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=${VITE_API_BASE}

RUN npm run build


# ── Stage 2: serve ───────────────────────────────────────
FROM nginx:1.27-alpine AS serve

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Sensible defaults that work for docker-compose. Railway / Render etc.
# override these via environment. `PORT` is the de-facto PaaS convention;
# we honour it transparently so the same image works everywhere.
ENV NGINX_PORT=80 \
    BACKEND_URL=http://backend:8000

# Wrapper script: if the platform set $PORT (Railway, Render, Fly, …)
# use it; otherwise fall back to $NGINX_PORT (or 80). `envsubst` then
# materialises the final nginx config and we hand off to nginx.
RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -eu' \
    'export NGINX_PORT="${PORT:-${NGINX_PORT:-80}}"' \
    'export BACKEND_URL="${BACKEND_URL:-http://backend:8000}"' \
    'echo "[entrypoint] NGINX_PORT=$NGINX_PORT BACKEND_URL=$BACKEND_URL"' \
    'envsubst "\$NGINX_PORT \$BACKEND_URL" \\' \
    '  < /etc/nginx/templates/default.conf.template \\' \
    '  > /etc/nginx/conf.d/default.conf' \
    'echo "[entrypoint] generated config:"' \
    'head -3 /etc/nginx/conf.d/default.conf' \
    'exec nginx -g "daemon off;"' \
    > /docker-entrypoint-custom.sh \
    && chmod +x /docker-entrypoint-custom.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-${NGINX_PORT:-80}}/" >/dev/null || exit 1

CMD ["/docker-entrypoint-custom.sh"]
