#!/usr/bin/env bash
# =============================================================================
#  TALLER SILVER — Unidades systemd + nginx interno (primera instalación)
#  Ejecutar EN EL HOST PROXMOX: bash 05-services-nginx.sh <CTID>
# =============================================================================
set -euo pipefail
CT_ID="${1:-120}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pct push "$CT_ID" "$HERE/taller-api.service"      /etc/systemd/system/taller-api.service
pct push "$CT_ID" "$HERE/taller-web.service"      /etc/systemd/system/taller-web.service
pct push "$CT_ID" "$HERE/taller-silver.logrotate" /etc/logrotate.d/taller-silver
pct push "$CT_ID" "$HERE/nginx-taller-silver.conf" /etc/nginx/sites-available/taller-silver

pct exec "$CT_ID" -- bash -lc '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  command -v nginx >/dev/null || { apt-get update -qq && apt-get install -y -qq --no-install-recommends nginx; }
  rm -f /etc/nginx/sites-enabled/default
  printf "map \$http_upgrade \$connection_upgrade {\n    default upgrade;\n    \x27\x27      close;\n}\n" > /etc/nginx/conf.d/upgrade-map.conf
  ln -sf /etc/nginx/sites-available/taller-silver /etc/nginx/sites-enabled/taller-silver
  nginx -t
  touch /var/log/taller-silver/api.log /var/log/taller-silver/api.err.log \
        /var/log/taller-silver/web.log /var/log/taller-silver/web.err.log
  chown -R taller:taller /var/log/taller-silver
  systemctl daemon-reload
  systemctl enable --now nginx taller-api taller-web
  sleep 5
  systemctl is-active nginx taller-api taller-web postgresql
'
echo "✅ Servicios instalados en el CT $CT_ID"
