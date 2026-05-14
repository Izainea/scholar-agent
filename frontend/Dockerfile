###########################################################
# Scholar Agent frontend — Vite + React + TypeScript
# Multi-stage: Node build → nginx static serve.
#
# The frontend talks to the backend DIRECTLY via its public URL
# (VITE_API_BASE is baked into the bundle at build time). nginx only
# serves static files; the backend handles CORS for the frontend's
# origin. No reverse-proxy needed.
###########################################################

# ── Stage 1: build ───────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# The public URL of the backend service. Default points at the
# production Railway backend; docker-compose overrides it via build-arg.
ARG VITE_API_BASE=https://backend-production-15b0.up.railway.app
ENV VITE_API_BASE=${VITE_API_BASE}

RUN npm run build


# ── Stage 2: serve ───────────────────────────────────────
FROM nginx:1.27-alpine AS serve

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Default port if the host doesn't set $PORT.
ENV NGINX_PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-${NGINX_PORT:-80}}/" >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
