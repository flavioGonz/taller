#!/bin/bash
# =============================================================================
#  Backups automáticos de Taller Silver — se corre DENTRO del CT 120.
#  Deja un pg_dump comprimido por día, los uploads y el archivo de entorno.
#  Retención: 14 diarios + 8 semanales (domingos). Verifica que el dump abra.
# =============================================================================
set -euo pipefail

DEST=/var/backups/taller-silver
BIN=/usr/local/bin/taller-backup.sh
ENVF=/etc/taller-silver/taller.env

install -d -m 750 "$DEST/diarios" "$DEST/semanales"

cat > "$BIN" <<'SCRIPT'
#!/bin/bash
# Copia diaria de Taller Silver. Lo llama systemd (taller-backup.timer).
set -euo pipefail

DEST=/var/backups/taller-silver
ENVF=/etc/taller-silver/taller.env
UPLOADS=/var/lib/taller-silver/uploads
HOY=$(date +%F)
DOW=$(date +%u)          # 7 = domingo
LOG=/var/log/taller-silver/backup.log
mkdir -p "$(dirname "$LOG")"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

set -a; . "$ENVF"; set +a

# La URL de Prisma trae parámetros propios (schema, connection_limit) que pg_dump
# no entiende: se recorta todo lo que va después del "?"
DBURI="${DATABASE_URL%%\?*}"
DUMP="$DEST/diarios/db-$HOY.sql.gz"
pg_dump --dbname="$DBURI" --schema=public --no-owner --no-privileges | gzip -9 > "$DUMP"

# Verificación: un dump que no se puede leer no es un backup
if ! gzip -t "$DUMP"; then
  log "ERROR: el dump $DUMP está corrupto"
  exit 1
fi
TAM=$(stat -c%s "$DUMP")
if [ "$TAM" -lt 10240 ]; then
  log "ERROR: el dump $DUMP quedó en $TAM bytes, sospechosamente chico"
  exit 1
fi

# Fotos, firmas y adjuntos: sin esto la base queda con enlaces rotos
if [ -d "$UPLOADS" ]; then
  tar -czf "$DEST/diarios/uploads-$HOY.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
fi

# El entorno guarda claves: copia con permisos cerrados
install -m 600 "$ENVF" "$DEST/diarios/taller.env-$HOY"

# Los domingos se guarda una copia aparte que vive más tiempo
if [ "$DOW" = "7" ]; then
  cp -f "$DUMP" "$DEST/semanales/db-$HOY.sql.gz"
fi

# Retención
find "$DEST/diarios"   -type f -mtime +14 -delete
find "$DEST/semanales" -type f -mtime +56 -delete

log "OK db=$(numfmt --to=iec "$TAM") diarios=$(ls -1 "$DEST/diarios" | wc -l)"
SCRIPT

chmod 750 "$BIN"

cat > /etc/systemd/system/taller-backup.service <<'UNIT'
[Unit]
Description=Copia de seguridad de Taller Silver
After=postgresql.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/taller-backup.sh
Nice=10
IOSchedulingClass=idle
UNIT

cat > /etc/systemd/system/taller-backup.timer <<'UNIT'
[Unit]
Description=Copia diaria de Taller Silver (03:20)

[Timer]
OnCalendar=*-*-* 03:20:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now taller-backup.timer

echo "=== corrida de prueba ==="
systemctl start taller-backup.service
sleep 2
ls -lh "$DEST/diarios" | tail -5
echo "=== próximo disparo ==="
systemctl list-timers taller-backup.timer --no-pager | head -3
tail -3 /var/log/taller-silver/backup.log 2>/dev/null || true
