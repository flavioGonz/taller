#!/usr/bin/env bash
# =============================================================================
#  TALLER SILVER — Publicación en NGX Proxy Manager (CT110 · 192.168.99.75:81)
#  Crea o actualiza el proxy host taller.infratec.com.uy → CT_IP:3000,
#  habilita WebSockets (necesario para Socket.io) y emite el certificado
#  Let's Encrypt, forzando HTTPS + HTTP/2 + HSTS.
#
#  Uso:
#    NPM_EMAIL=admin@ejemplo.com NPM_PASS=**** CT_IP=192.168.99.60 \
#    LE_EMAIL=desarrollo@favaro.com.uy bash deploy/04-npm-proxy.sh
# =============================================================================
set -euo pipefail

NPM_URL="${NPM_URL:-http://192.168.99.75:81}"
NPM_EMAIL="${NPM_EMAIL:?Definí NPM_EMAIL (usuario admin de NGX Proxy Manager)}"
NPM_PASS="${NPM_PASS:?Definí NPM_PASS}"
DOMAIN="${DOMAIN:-taller.infratec.com.uy}"
CT_IP="${CT_IP:?Definí CT_IP (IP del contenedor Taller Silver)}"
CT_PORT="${CT_PORT:-80}"
LE_EMAIL="${LE_EMAIL:-$NPM_EMAIL}"
ISSUE_CERT="${ISSUE_CERT:-true}"

api() { # api <METHOD> <PATH> [JSON]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$NPM_URL$path" -H "Authorization: Bearer $TOKEN" \
         -H 'Content-Type: application/json' -d "$body"
  else
    curl -fsS -X "$method" "$NPM_URL$path" -H "Authorization: Bearer $TOKEN"
  fi
}

echo "▶ Autenticando en $NPM_URL…"
TOKEN=$(curl -fsS -X POST "$NPM_URL/api/tokens" -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$NPM_EMAIL\",\"secret\":\"$NPM_PASS\"}" |
  python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
echo "  ✓ token obtenido"

echo "▶ Buscando el proxy host de $DOMAIN…"
HOSTS=$(api GET /api/nginx/proxy-hosts?expand=owner)
HOST_ID=$(printf '%s' "$HOSTS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(next((str(h['id']) for h in d if '$DOMAIN' in h.get('domain_names', [])), ''))
")

PAYLOAD=$(python3 -c "
import json
print(json.dumps({
  'domain_names': ['$DOMAIN'],
  'forward_scheme': 'http',
  'forward_host': '$CT_IP',
  'forward_port': int('$CT_PORT'),
  'access_list_id': 0,
  'certificate_id': 0,
  'ssl_forced': False,
  'http2_support': True,
  'hsts_enabled': False,
  'hsts_subdomains': False,
  'caching_enabled': False,
  'block_exploits': True,
  'allow_websocket_upgrade': True,
  'advanced_config': '''client_max_body_size 25m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;''',
  'meta': {'letsencrypt_agree': False, 'dns_challenge': False},
  'locations': [],
}))
")

if [ -n "$HOST_ID" ]; then
  echo "  ✓ existe (id $HOST_ID) → actualizando destino a $CT_IP:$CT_PORT"
  EXISTING_CERT=$(printf '%s' "$HOSTS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
h = next((h for h in d if str(h['id']) == '$HOST_ID'), {})
print(h.get('certificate_id') or 0)
")
  PAYLOAD=$(printf '%s' "$PAYLOAD" | python3 -c "
import sys, json
p = json.load(sys.stdin)
p['certificate_id'] = int('$EXISTING_CERT')
p['ssl_forced'] = bool(int('$EXISTING_CERT'))
p['hsts_enabled'] = bool(int('$EXISTING_CERT'))
print(json.dumps(p))
")
  api PUT "/api/nginx/proxy-hosts/$HOST_ID" "$PAYLOAD" >/dev/null
else
  echo "  · no existía → creando"
  HOST_ID=$(api POST /api/nginx/proxy-hosts "$PAYLOAD" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
  EXISTING_CERT=0
  echo "  ✓ creado (id $HOST_ID)"
fi

if [ "$ISSUE_CERT" = "true" ] && [ "${EXISTING_CERT:-0}" = "0" ]; then
  echo "▶ Solicitando certificado Let's Encrypt para $DOMAIN…"
  echo "  (requiere que $DOMAIN resuelva a la IP pública y que 80/443 lleguen a NPM)"
  CERT=$(api POST /api/nginx/certificates "$(python3 -c "
import json
print(json.dumps({
  'domain_names': ['$DOMAIN'],
  'meta': {'letsencrypt_email': '$LE_EMAIL', 'letsencrypt_agree': True, 'dns_challenge': False},
  'provider': 'letsencrypt',
}))
")" || echo '')
  if [ -z "$CERT" ]; then
    echo "  ✖ No se pudo emitir el certificado (revisá DNS público y el forward de 80/443)."
    echo "    El proxy host quedó funcionando por HTTP: http://$DOMAIN"
    exit 0
  fi
  CERT_ID=$(printf '%s' "$CERT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
  echo "  ✓ certificado emitido (id $CERT_ID)"

  echo "▶ Forzando HTTPS + HTTP/2 + HSTS…"
  FINAL=$(printf '%s' "$PAYLOAD" | python3 -c "
import sys, json
p = json.load(sys.stdin)
p.update(certificate_id=int('$CERT_ID'), ssl_forced=True, http2_support=True, hsts_enabled=True)
print(json.dumps(p))
")
  api PUT "/api/nginx/proxy-hosts/$HOST_ID" "$FINAL" >/dev/null
fi

echo
echo "✅ Publicado: https://$DOMAIN → $CT_IP:$CT_PORT (WebSockets habilitados)"
