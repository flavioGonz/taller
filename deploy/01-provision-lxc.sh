#!/usr/bin/env bash
# =============================================================================
#  TALLER SILVER — Provisión del contenedor LXC (on-premise, todo autocontenido)
#  Ejecutar EN EL HOST PROXMOX. Crea el CT con Node 22 + PostgreSQL local.
#  Uso:  bash 01-provision-lxc.sh [CTID]
#
#  NOTA DE RED: el router de la 192.168.99.0/24 sólo enruta hacia Internet las
#  direcciones que entregó por DHCP. Por eso el contenedor se crea con DHCP y,
#  una vez conocida su IP, conviene dejarle una reserva por MAC en el router.
#  Tampoco se usa `firewall=1` en net0: con el firewall de Proxmox deshabilitado
#  a nivel datacenter, esa bandera deja al contenedor sin salida.
# =============================================================================
set -euo pipefail

CTID="${1:-120}"
HOSTNAME_CT="${HOSTNAME_CT:-taller-silver}"
STORAGE="${STORAGE:-local-lvm}"
DISK_GB="${DISK_GB:-20}"
CORES="${CORES:-4}"
RAM_MB="${RAM_MB:-4096}"
SWAP_MB="${SWAP_MB:-512}"
ROOT_PW="${ROOT_PW:-flavio20}"
TEMPLATE="${TEMPLATE:-local:vztmpl/debian-12-standard_12.12-1_amd64.tar.zst}"

if pct status "$CTID" &>/dev/null; then
  echo "✖ El CTID $CTID ya existe." >&2
  exit 1
fi

echo "▶ Creando CT $CTID ($HOSTNAME_CT)…"
pct create "$CTID" "$TEMPLATE" \
  --hostname "$HOSTNAME_CT" \
  --cores "$CORES" --memory "$RAM_MB" --swap "$SWAP_MB" \
  --rootfs "$STORAGE:$DISK_GB" \
  --net0 "name=eth0,bridge=vmbr0,ip=dhcp" \
  --nameserver "8.8.8.8 1.1.1.1" \
  --onboot 1 --startup "order=5" \
  --unprivileged 1 --features nesting=1 \
  --password "$ROOT_PW" \
  --description "Taller Silver Core Engine — API :3001 + Web :3000 + PostgreSQL local"

pct start "$CTID"
sleep 12

IP=$(pct exec "$CTID" -- bash -lc "ip -4 -o addr show eth0 | awk '{print \$4}' | cut -d/ -f1")
MAC=$(grep -o 'hwaddr=[^,]*' "/etc/pve/lxc/$CTID.conf" | cut -d= -f2)
pct set "$CTID" --tags "${IP##*.}" >/dev/null

pct exec "$CTID" -- bash -lc 'ping -c1 -W3 deb.debian.org >/dev/null 2>&1' \
  || { echo "✖ El contenedor no tiene salida a Internet (revisá el router)." >&2; exit 1; }

echo "▶ Instalando base del sistema (Node 22 + PostgreSQL + utilidades)…"
pct exec "$CTID" -- bash -lc '
  set -e
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq --no-install-recommends \
    ca-certificates curl gnupg git unzip logrotate openssh-server tzdata \
    postgresql postgresql-contrib
  ln -sf /usr/share/zoneinfo/America/Montevideo /etc/localtime
  echo America/Montevideo > /etc/timezone
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs
  id -u taller >/dev/null 2>&1 || useradd --system --create-home \
    --home-dir /opt/taller-silver --shell /usr/sbin/nologin taller
  mkdir -p /opt/taller-silver /etc/taller-silver /var/log/taller-silver /var/lib/taller-silver/uploads
  chown -R taller:taller /opt/taller-silver /var/log/taller-silver /var/lib/taller-silver
  systemctl enable --now ssh postgresql >/dev/null 2>&1 || true
  apt-get clean && rm -rf /var/lib/apt/lists/*
'

echo
echo "✅ CT $CTID listo"
echo "   IP    : $IP   (DHCP — dejá una reserva en el router para $MAC)"
echo "   Node  : $(pct exec "$CTID" -- node -v)"
echo "   Postgres: $(pct exec "$CTID" -- psql --version)"
echo
echo "   Siguiente: 02-init-db-local.sh y luego 03-deploy.sh"
