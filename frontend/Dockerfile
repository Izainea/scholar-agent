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

# `envsubst` lives in busybox in alpine.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Sensible defaults that work for docker-compose. Railway/other PaaS
# override these via environment.
ENV NGINX_PORT=80 \
    BACKEND_URL=http://backend:8000

# The nginx:alpine image already runs `envsubst` on /etc/nginx/templates/*
# at startup and writes the result into /etc/nginx/conf.d/. So our env
# vars (NGINX_PORT, BACKEND_URL) get interpolated before nginx boots.

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${NGINX_PORT}/" >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
