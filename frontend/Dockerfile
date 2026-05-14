###########################################################
# Scholar Agent frontend — Vite + React + TypeScript
# Multi-stage: Node build → nginx static serve.
# Rev: 3 (build-time envsubst, no runtime entrypoint)
#
# Strategy:
# - BACKEND_URL is a build-arg. envsubst resolves it during build,
#   so the final nginx.conf is already complete. This sidesteps PaaS
#   platforms (Railway, etc.) that override the container's CMD and
#   would prevent any runtime entrypoint from running.
# - Port substitution still happens at runtime via envsubst in
#   /etc/nginx/templates/ (a stock feature of nginx:alpine), so the
#   image still adapts to whatever $PORT the host assigns.
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

# Substitute BACKEND_URL at build time so the resulting image's nginx
# config is self-contained and doesn't depend on a runtime entrypoint.
# The default points to the production Railway backend; docker-compose
# overrides it to `http://backend:8000` for local development.
ARG BACKEND_URL=https://backend-production-15b0.up.railway.app
ENV BACKEND_URL=${BACKEND_URL}

COPY nginx.conf.template /tmp/default.conf.template

# Resolve ${BACKEND_URL} now, leave ${NGINX_PORT} as a literal so
# nginx:alpine's stock envsubst entrypoint can fill it in at startup
# using whatever $PORT/NGINX_PORT the host provides.
RUN apk add --no-cache gettext \
    && mkdir -p /etc/nginx/templates \
    && envsubst '$BACKEND_URL' < /tmp/default.conf.template \
        > /etc/nginx/templates/default.conf.template \
    && rm /tmp/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

# Default port if the host doesn't set one.
ENV NGINX_PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-${NGINX_PORT:-80}}/" >/dev/null || exit 1

# Use the stock nginx:alpine entrypoint, which:
#   1. Runs envsubst over /etc/nginx/templates/* (filling NGINX_PORT).
#   2. Runs nginx -g 'daemon off;'.
# This survives a platform overriding CMD because the entrypoint script
# is still nginx:alpine's default ("/docker-entrypoint.sh").
CMD ["nginx", "-g", "daemon off;"]
