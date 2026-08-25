#!/usr/bin/env bash
# =============================================================================
#  TALLER SILVER — Creación de la base en el PostgreSQL existente
#  Ejecutar desde cualquier host con psql y acceso a la 192.168.99.x
#  (por defecto CT103 de pve01 → 192.168.99.111)
# =============================================================================
set -euo pipefail

PGHOST="${PGHOST:-192.168.99.111}"
PGPORT="${PGPORT:-5432}"
PGSUPER="${PGSUPER:-postgres}"
DB_NAME="${DB_NAME:-taller_silver}"
DB_USER="${DB_USER:-taller}"
DB_PASS="${DB_PASS:?Definí DB_PASS con la contraseña que va a usar la app}"

echo "▶ Creando base '$DB_NAME' y usuario '$DB_USER' en $PGHOST:$PGPORT"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGSUPER" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
  END IF;
END
\$\$;
SQL

if ! psql -h "$PGHOST" -p "$PGPORT" -U "$PGSUPER" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  createdb -h "$PGHOST" -p "$PGPORT" -U "$PGSUPER" -O "$DB_USER" "$DB_NAME"
  echo "✅ Base creada"
else
  echo "ℹ️  La base ya existía"
fi

psql -h "$PGHOST" -p "$PGPORT" -U "$PGSUPER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER SCHEMA public OWNER TO $DB_USER;
SQL

echo "✅ DATABASE_URL=postgresql://$DB_USER:***@$PGHOST:$PGPORT/$DB_NAME?schema=public&connection_limit=10"
