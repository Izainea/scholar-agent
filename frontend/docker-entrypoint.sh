#!/bin/sh
# Entrypoint for the Scholar Agent frontend nginx image.
#
# Resolves the port (PaaS conventions: $PORT first, then $NGINX_PORT, else 80),
# substitutes ${NGINX_PORT} and ${BACKEND_URL} in the nginx config template,
# and hands off to nginx.
set -eu

export NGINX_PORT="${PORT:-${NGINX_PORT:-80}}"
export BACKEND_URL="${BACKEND_URL:-http://backend:8000}"

echo "[entrypoint] NGINX_PORT=$NGINX_PORT BACKEND_URL=$BACKEND_URL"

envsubst '$NGINX_PORT $BACKEND_URL' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

echo "[entrypoint] generated config head:"
head -3 /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
