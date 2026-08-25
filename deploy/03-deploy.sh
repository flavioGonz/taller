#!/usr/bin/env bash
# =============================================================================
#  TALLER SILVER — Despliegue dentro del contenedor
#  Ejecutar EN EL HOST PROXMOX, desde la raíz del repo (o pasando ZIP=…).
#  Compila en el propio contenedor: sin dependencias cruzadas de arquitectura
#  ni engines de Prisma que no coincidan.
#
#  Uso:  CT_ID=120 bash deploy/03-deploy.sh
# =============================================================================
set -euo pipefail

CT_ID="${CT_ID:-120}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="${ZIP:-/tmp/taller-silver-src.zip}"
SEED="${SEED:-false}"

if [ ! -f "$ZIP" ]; then
  echo "▶ Empaquetando el repo…"
  (cd "$ROOT_DIR" && zip -rq "$ZIP" . \
     -x "node_modules/*" "*/node_modules/*" "**/node_modules/*" \
        "*/.next/*" "**/.next/*" "*/dist/*" "**/dist/*" "*.tsbuildinfo" "apps/api/.env")
fi

echo "▶ Subiendo el código al CT $CT_ID…"
pct push "$CT_ID" "$ZIP" /tmp/taller-silver-src.zip

cat > /tmp/ts-deploy.sh <<'REMOTE'
#!/bin/bash
set -euo pipefail
APP=/opt/taller-silver/src
mkdir -p "$APP"

echo "=== descomprimiendo ==="
unzip -q -o /tmp/taller-silver-src.zip -d "$APP"

echo "=== npm install ==="
cd "$APP"
npm install --no-audit --no-fund --loglevel=error

echo "=== build ==="
set -a; . /etc/taller-silver/taller.env; set +a
npm run build 2>&1 | tail -20

echo "=== salida standalone del web ==="
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
mkdir -p apps/web/.next/standalone/apps/web/public
[ -d apps/web/public ] && cp -r apps/web/public/. apps/web/.next/standalone/apps/web/public/ || true

echo "=== migración ==="
cd "$APP/apps/api"
npx prisma migrate deploy
if [ "${SEED:-false}" = "true" ]; then npx tsx prisma/seed.ts; fi

chown -R taller:taller /opt/taller-silver
systemctl restart taller-api
sleep 4
systemctl restart taller-web nginx
sleep 4

echo "=== estado ==="
systemctl is-active taller-api taller-web nginx postgresql
curl -fsS http://127.0.0.1/api/health; echo
curl -s -o /dev/null -w "GET /login -> %{http_code}\n" http://127.0.0.1/login
curl -s "http://127.0.0.1/socket.io/?EIO=4&transport=polling" | head -c 80; echo
REMOTE

pct push "$CT_ID" /tmp/ts-deploy.sh /tmp/ts-deploy.sh --perms 755
pct exec "$CT_ID" -- env SEED="$SEED" bash /tmp/ts-deploy.sh
rm -f /tmp/ts-deploy.sh

IP=$(pct exec "$CT_ID" -- bash -lc "ip -4 -o addr show eth0 | awk '{print \$4}' | cut -d/ -f1")
echo
echo "✅ Desplegado → http://$IP"
