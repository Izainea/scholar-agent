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

# Sensible defaults that work for docker-compose. PaaS targets (Railway,
# Render, Fly) override these via environment.
ENV NGINX_PORT=80 \
    BACKEND_URL=http://backend:8000

# Custom entrypoint: resolves $PORT / $NGINX_PORT, runs envsubst, then
# exec nginx. Doing it in a real .sh file (rather than inline) keeps
# shell quoting sane and makes the script easy to debug.
COPY docker-entrypoint.sh /docker-entrypoint-custom.sh
RUN chmod +x /docker-entrypoint-custom.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-${NGINX_PORT:-80}}/" >/dev/null || exit 1

CMD ["/docker-entrypoint-custom.sh"]
