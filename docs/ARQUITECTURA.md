# Arquitectura — Taller Silver Core Engine

## Topología de despliegue

```
Internet
   │  443
   ▼
NGX Proxy Manager  (CT110 pve01 · 192.168.99.75)
   │  taller.infratec.com.uy → CT:3000   [WebSocket upgrade ON]
   ▼
LXC taller-silver  (pve02 · 2 vCPU / 1.5 GB)
   ├── taller-web  :3000   Next.js standalone   → reescribe /api y /socket.io
   └── taller-api  :3001   Fastify + Socket.io  (escucha en 127.0.0.1)
                     │
                     ▼  5432
        PostgreSQL  (CT103 pve01 · 192.168.99.111)  base taller_silver
```

Un solo origen público (`https://taller.infratec.com.uy`): el navegador nunca habla
directo con la API, y las cookies HttpOnly quedan *same-site*. La API no se expone
fuera del contenedor (`API_HOST=127.0.0.1`), salvo que se quiera consumirla desde el
futuro cliente de escritorio — en ese caso se publica un segundo proxy host
`api.taller.infratec.com.uy` → CT:3001 y se agrega su origen a `CORS_ORIGIN`.

## Sesiones

1. `POST /api/auth/login` valida con bcrypt y emite dos cookies HttpOnly:
   `ts_at` (JWT, 15 min) y `ts_rt` (refresh opaco de 48 bytes, 30 días, path `/api/auth`).
2. El refresh se guarda **hasheado** (SHA-256) en `sessions` con IP y user-agent.
3. `POST /api/auth/refresh` rota la sesión: revoca la anterior y emite una nueva.
4. El cliente HTTP reintenta una vez ante un 401 llamando a `/auth/refresh`.
5. Socket.io reutiliza la misma cookie `ts_at` en el handshake y une al socket a las
   rooms `tenant:<id>` y `user:<id>`.

## Modelo de datos (resumen)

- **Tenancy**: `Tenant` → `User` (rol), `Counter` (numeradores), `Session`.
- **Comercial**: `Customer` → `Vehicle` → `WorkOrder` → `WorkOrderItem`.
- **Trazabilidad**: `WorkOrderStatusHistory`, `WorkOrderTimeLog`, `Attachment`, `AuditLog`.
- **Inventario**: `Part` → `PartStock` (por `Warehouse`) ← `StockMovement`; `Supplier`.
- **Facturación**: `Document` (presupuesto/factura/remito/recibo) → `DocumentLine`, `Payment`.
- **Auto-mejora**: `SystemInsight` (único por `agent+code+target`, con `occurrences`).

Índices pensados para las consultas reales del panel: `(tenantId, status)` y
`(tenantId, receivedAt)` en OT, `(technicianId, status)` para la vista del técnico,
`(tenantId, plate)` único para matrículas y `(partId, warehouseId)` único para stock.

## Ciclo de vida de una OT

```
RECEPCION → DIAGNOSTICO → PRESUPUESTADO → APROBADO → EN_PROCESO → CONTROL_CALIDAD
                    ↘ EN_PROCESO            ↘ ESPERA_REPUESTO ↗        ↓
                                                                  FINALIZADO → ENTREGADO
(cualquier estado no terminal puede ir a CANCELADO)
```

Al entrar en `EN_PROCESO` se descuenta el stock de los ítems de tipo `REPUESTO`
(idempotente: no repite el movimiento si ya existe una salida para esa OT y repuesto).
Cada transición emite `workorder:status_changed` a la room del taller y a la de la OT.

## Rendimiento en recursos limitados

- Build `standalone` de Next: el contenedor no necesita el `node_modules` de desarrollo.
- `MemoryMax` por servicio (512 MB API / 384 MB web) para que un pico no tumbe el LXC.
- Pool de conexiones acotado con `connection_limit=10` en la URL de Prisma
  (compatible con PgBouncer en modo *transaction* si se agrega más adelante).
- Logs a archivo con rotación diaria y tope de 20 MB (`logrotate`).
- El buffer de insights agrupa en memoria y persiste cada 10 s: la observabilidad
  no agrega una escritura por request.
