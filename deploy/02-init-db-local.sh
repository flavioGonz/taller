#!/usr/bin/env bash
# =============================================================================
#  TALLER SILVER — Base local + archivo de entorno (dentro del contenedor)
#  Ejecutar EN EL HOST PROXMOX: bash 02-init-db-local.sh <CTID>
#  Genera contraseña de base y JWT_SECRET aleatorios y los deja en
#  /etc/taller-silver/taller.env (root:taller, 640).
# =============================================================================
set -euo pipefail
CTID="${1:-120}"
DOMAIN="${DOMAIN:-taller.infratec.com.uy}"

DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
JWT="${JWT_SECRET:-$(openssl rand -hex 32)}"

cat > /tmp/ts-init.sh <<EOS
#!/bin/bash
set -euo pipefail
cat > /tmp/init.sql <<SQL
DO \\\$\\\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taller') THEN
    CREATE ROLE taller LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE taller WITH LOGIN PASSWORD '$DB_PASS';
  END IF;
END
\\\$\\\$;
SQL
chmod 644 /tmp/init.sql; cd /tmp
su postgres -c "psql -v ON_ERROR_STOP=1 -f /tmp/init.sql"
su postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='taller_silver'\"" | grep -q 1 \\
  || su postgres -c "createdb -O taller taller_silver"
su postgres -c "psql -d taller_silver -c 'GRANT ALL ON SCHEMA public TO taller; ALTER SCHEMA public OWNER TO taller;'"

# OJO: las URLs van entrecomilladas — el & sin comillas rompe cualquier \`source\`
cat > /etc/taller-silver/taller.env <<ENVEOF
NODE_ENV=production
DATABASE_URL="postgresql://taller:$DB_PASS@127.0.0.1:5432/taller_silver?schema=public&connection_limit=10&pool_timeout=20"
DIRECT_DATABASE_URL="postgresql://taller:$DB_PASS@127.0.0.1:5432/taller_silver?schema=public"
API_HOST=127.0.0.1
API_PORT=3001
JWT_SECRET=$JWT
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=2592000
COOKIE_DOMAIN=$DOMAIN
COOKIE_SECURE=true
CORS_ORIGIN=https://$DOMAIN
RATE_LIMIT_MAX=300
LOG_LEVEL=info
UPLOAD_DIR=/var/lib/taller-silver/uploads
OBSERVABILITY_ENABLED=true
SLOW_ENDPOINT_MS=400
SLOW_QUERY_MS=200
SOCKET_LEAK_THRESHOLD=500
PORT=3100
API_INTERNAL_URL=http://127.0.0.1:3001
ENVEOF
chown root:taller /etc/taller-silver/taller.env
chmod 640 /etc/taller-silver/taller.env
PGPASSWORD='$DB_PASS' psql -h 127.0.0.1 -U taller -d taller_silver -tAc "select 'conexion OK como ' || current_user"
EOS

pct push "$CTID" /tmp/ts-init.sh /tmp/ts-init.sh --perms 755
pct exec "$CTID" -- bash /tmp/ts-init.sh
rm -f /tmp/ts-init.sh

echo
echo "✅ Base y entorno listos en el CT $CTID"
echo "   Contraseña de la base: $DB_PASS   (guardala: queda sólo en taller.env)"
