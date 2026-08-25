# Taller Silver — Core Engine

Plataforma modular multi-tenant para la gestión integral de talleres mecánicos.
Arquitectura API desacoplada (lista para un cliente Windows nativo con Tauri/Electron),
telemetría en vivo por Socket.io y una capa interna de observabilidad y auto-mejora.

```
taller-silver/
├── apps/
│   ├── api/              Fastify 5 · TypeScript · Prisma 6 · Socket.io   → :3001
│   │   ├── prisma/       schema.prisma (multi-tenant) + migraciones + seed
│   │   └── src/
│   │       ├── plugins/      auth (JWT+cookies) · tenant · socket · observability
│   │       ├── modules/      auth · tenants · users · customers · vehicles
│   │       │                 work-orders · inventory · services · billing
│   │       │                 dashboard · observability
│   │       └── lib/          prisma · errors · pagination · counters · insights
│   └── web/              Next.js 15 (App Router) · React 19 · Tailwind v4  → :3000
│       └── src/
│           ├── app/(app)/    dashboard · ordenes · clientes · vehiculos
│           │                 inventario · servicios · facturacion · sistema
│           ├── components/   ui · layout (sidebar colapsable) · observability
│           └── hooks/        use-auth · use-api · use-socket
├── packages/shared/      Tipos, DTOs zod, RBAC, máquina de estados y cálculo de totales
├── deploy/               Provisión LXC, base, despliegue, systemd, nginx, NGX Proxy Manager
└── docs/                 ARQUITECTURA.md · DESPLIEGUE.md (estado real de producción)
```

## Puesta en marcha local

```bash
npm install
cp .env.example apps/api/.env          # ajustá DATABASE_URL y JWT_SECRET
npm run db:migrate -w @taller/api      # crea el esquema
npm run db:seed                        # taller demo + usuarios + catálogo
npm run dev                            # API :3001 + Web :3000
```

Usuarios sembrados (contraseña `Silver2026!`, cambiable con `SEED_PASSWORD`):

| Usuario | Rol |
|---|---|
| `admin@tallersilver.uy` | ADMIN_TALLER |
| `recepcion@tallersilver.uy` | RECEPCIONISTA |
| `tecnico@tallersilver.uy` | TECNICO |
| `super@infratec.com.uy` | SUPER_ADMIN (global, sin tenant) |

## Despliegue en Proxmox

```bash
# 1 · en el host Proxmox: crea el CT con Node 22 + PostgreSQL local (DHCP)
bash deploy/01-provision-lxc.sh 120

# 2 · base, usuario y /etc/taller-silver/taller.env (genera las claves)
bash deploy/02-init-db-local.sh 120

# 3 · build dentro del contenedor + migración + seed + systemd + nginx
CT_ID=120 bash deploy/03-deploy.sh

# 4 · publicación con TLS en NGX Proxy Manager (o a mano por la UI)
NPM_EMAIL=... NPM_PASS=... CT_IP=<ip> CT_PORT=80 bash deploy/04-npm-proxy.sh
```

**El detalle de lo que quedó instalado en producción está en
[`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md)** — incluye la receta exacta del proxy host,
los comandos de operación diaria y el procedimiento de actualización.

## Multi-tenancy

Cada tabla de negocio lleva `tenantId`. El plugin `tenant.ts` expone `req.scope()`,
que resuelve el taller efectivo desde la sesión — y permite al `SUPER_ADMIN` operar
sobre cualquier taller con la cabecera `x-tenant-id`. **Ninguna consulta de un módulo
de negocio debe omitir `req.scope()`.**

Alta de un taller nuevo: `POST /api/tenants` (sólo SUPER_ADMIN) crea el tenant,
su usuario administrador y el depósito por defecto en una sola transacción.

## RBAC

`packages/shared/roles.ts` es la única fuente de verdad: define permisos atómicos
(`workorder:status`, `billing:write`, …) y el mapa rol → permisos, que consumen
tanto la API (`app.authorize(...)`) como la UI (`can(...)` para ocultar acciones).

## Capa de auto-mejora

| Sub-agente | Dónde corre | Qué vigila |
|---|---|---|
| **Component Inspector** | navegador | a11y (alt, labels, nombres accesibles, tamaño de objetivos), colores fuera del sistema de diseño, long tasks y CLS |
| **State & Mutation Observer** | API | consultas Prisma lentas, errores de transacción, latencia por endpoint, picos de conexiones Socket.io |
| **Refactor & Evolution Recommender** | API (cada 5 min) | agrega las métricas y emite sugerencias de refactor con su evidencia |

Los hallazgos se agrupan (`agent+code+target`), se persisten en `system_insights`,
se emiten por Socket.io y se ven en **Sistema → Salud & Insights**.

## Convenciones que conviene respetar

- **Totales**: se calculan con `computeLine`/`computeTotals` de `@taller/shared` y se
  persisten en la OT en cada mutación (nunca se recalculan en la UI para mostrar).
- **Numeradores**: `nextNumber()` usa un contador por tenant dentro de la transacción
  del negocio (sin condiciones de carrera ni números quemados).
- **Estados de OT**: la máquina de estados vive en `shared/constants.ts`; la API rechaza
  cualquier transición no declarada y la UI sólo ofrece las válidas.
- **Paginación**: `?page&limit` → `{rows,total,page,pages,limit}`. En clientes y servicios
  es opt-in: sin `page` devuelven un array plano para los desplegables.
- **Bajas**: lógicas (`deletedAt`), nunca `DELETE` físico en tablas de negocio.
