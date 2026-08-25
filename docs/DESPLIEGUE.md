# Despliegue real — Taller Silver (on-premise)

Estado al 24/08/2026: **en producción** dentro de la infraestructura Proxmox de Infratec.

## Lo que quedó instalado

| Elemento | Valor |
|---|---|
| Hipervisor | **pve02** (192.168.99.3) — pve01 tiene `local-lvm` al 98,7 % |
| Contenedor | **CT 120 · `taller-silver`** · Debian 12 · unprivileged · nesting |
| Recursos | 4 vCPU · 4 GB RAM · 20 GB (local-lvm) · onboot, startup order 5 |
| IP | **192.168.99.25** (DHCP) · MAC `bc:24:11:3a:04:43` |
| Runtime | Node.js 22.23.2 · npm 10.9.8 |
| Base de datos | **PostgreSQL 15.19 local**, sólo en `127.0.0.1:5432`, base `taller_silver`, usuario `taller` |
| API | `taller-api.service` → `127.0.0.1:3001` (no expuesta a la LAN) |
| Web | `taller-web.service` → `127.0.0.1:3100` (Next.js standalone) |
| Frente interno | **nginx → `0.0.0.0:80` y `0.0.0.0:3000`** — lo único que sale del contenedor |
| Código | `/opt/taller-silver/src` (monorepo compilado en el propio contenedor) |
| Entorno | `/etc/taller-silver/taller.env` (root:taller, 640) |
| Logs | `/var/log/taller-silver/*.log` con logrotate diario, tope 20 MB, 7 copias |

El nginx interno enruta `/api/` y `/socket.io/` a la API y todo lo demás al dashboard:
un único origen, sin CORS y con las cookies de sesión *same-site*. Escucha en **80 y
3000** a propósito, para que el proxy host funcione apuntando a cualquiera de los dos
(el 3000 quedó del despliegue inicial). Ni la API ni Next escuchan en la LAN.

> **Por qué nginx y no los rewrites de Next:** el proxy de rewrites de Next redirige
> `/socket.io/` con un 308 y no hace *upgrade* a WebSocket, así que Socket.io caía a
> *long-polling* y se perdía la telemetría en vivo. Con nginx el upgrade responde
> `101 Switching Protocols`. Los rewrites siguen en `next.config.ts` sólo para el
> entorno de desarrollo.

## Detalles de la red que conviene recordar

El router (MikroTik, 192.168.99.1) **sólo enruta hacia Internet las direcciones que
él mismo entregó por DHCP**. Con IP estática manual (`192.168.99.60`) el contenedor
veía la LAN pero no alcanzaba el gateway; con DHCP tomó `192.168.99.25` y salió a
Internet sin tocar nada más.

> **Pendiente recomendado:** dejar una reserva DHCP en el MikroTik para la MAC
> `bc:24:11:3a:04:43` → `192.168.99.25`, así el destino del proxy nunca cambia.

## Publicación en NGX Proxy Manager (CT110 · http://192.168.99.75:81)

DNS ya listo: `taller.infratec.com.uy` → `167.61.164.109` (la misma IP pública que
`preventis` y `omniaccess`).

**Details**

| Campo | Valor |
|---|---|
| Domain Names | `taller.infratec.com.uy` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.99.25` |
| Forward Port | `80` (o `3000`: nginx atiende ambos) |
| Cache Assets | **off** (Next ya versiona sus assets) |
| Block Common Exploits | **on** |
| **Websockets Support** | **ON** ← imprescindible: sin esto Socket.io cae a *polling* y se pierde la telemetría en vivo |
| Access List | Publicly Accessible |

**Advanced** (pegar tal cual):

```nginx
client_max_body_size 25m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

**SSL**

1. Request a new SSL Certificate (Let's Encrypt) con el correo de administración.
2. Force SSL: **on** · HTTP/2 Support: **on** · HSTS: **on** (activarlo recién cuando
   el certificado esté emitido y verificado).
3. Aceptar los términos de Let's Encrypt.

Después de emitir el certificado, verificar:

```bash
curl -I https://taller.infratec.com.uy/login          # 200
curl -s https://taller.infratec.com.uy/api/health     # {"status":"ok","db":"up",...}

# el upgrade a WebSocket tiene que responder 101 (si responde 200, falta el toggle)
curl -s -i -m 5 -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "https://taller.infratec.com.uy/socket.io/?EIO=4&transport=websocket" | head -1
```

Verificado el 24/08/2026: `301 → https`, HSTS activo, `/login` 200, `/api/health` ok,
login por HTTPS con cookies `ts_at`/`ts_rt`, y `101 Switching Protocols` en `/socket.io`.

## Operación diaria

```bash
# entrar al contenedor
ssh root@192.168.99.3            # pve02
pct exec 120 -- bash

systemctl status taller-api taller-web
journalctl -u taller-api -n 50 --no-pager
tail -f /var/log/taller-silver/api.log

# reiniciar
systemctl restart taller-api taller-web

# backup de la base
su postgres -c "pg_dump taller_silver" | gzip > /root/taller_$(date +%F).sql.gz

# snapshot del contenedor entero (desde pve02)
vzdump 120 --storage backup-cluster --compress zstd --mode snapshot
```

## Actualizar la aplicación

```bash
# 1 · subir el código nuevo al contenedor (zip del repo)
scp taller-silver-src.zip root@192.168.99.3:/tmp/
ssh root@192.168.99.3 'pct push 120 /tmp/taller-silver-src.zip /tmp/taller-silver-src.zip'

# 2 · dentro del CT
pct exec 120 -- bash -c '
  cd /opt/taller-silver/src
  unzip -q -o /tmp/taller-silver-src.zip
  npm install --no-audit --no-fund
  set -a; . /etc/taller-silver/taller.env; set +a
  npm run build
  cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
  cd apps/api && npx prisma migrate deploy
  chown -R taller:taller /opt/taller-silver
  systemctl restart taller-api taller-web'
```

## Credenciales sembradas

| Usuario | Rol |
|---|---|
| `admin@tallersilver.uy` | ADMIN_TALLER |
| `recepcion@tallersilver.uy` | RECEPCIONISTA |
| `tecnico@tallersilver.uy` | TECNICO |
| `super@infratec.com.uy` | SUPER_ADMIN (global) |

La contraseña inicial se entregó por separado — **cambiala en el primer ingreso**
(Configuración → usuarios, o `POST /api/auth/change-password`).
