#!/bin/sh
# La imagen oficial de nginx ejecuta los scripts de /docker-entrypoint.d/ antes de arrancar.
# Este escribe config.js con las variables de entorno de la Web App, así la MISMA imagen
# sirve para dev y prod.
set -eu

AMBIENTE="${APP_ENV:-${SENTRY_ENVIRONMENT:-local}}"

cat > /usr/share/nginx/html/config.js <<EOF
window.APP_CONFIG = {
  API_URL: "${API_URL:-http://localhost:8000}",
  AMBIENTE: "${AMBIENTE}",
  SENTRY_DSN: "${SENTRY_DSN:-}",
};
EOF

echo "config.js generado: API_URL=${API_URL:-http://localhost:8000} AMBIENTE=${AMBIENTE}"
