import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { mkdir } from 'node:fs/promises';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { env, isProd, corsOrigins } from './env.js';
import { AppError } from './lib/errors.js';
import { prisma, dbUrlRedacted } from './lib/prisma.js';

import authPlugin from './plugins/auth.js';
import tenantPlugin from './plugins/tenant.js';
import socketPlugin from './plugins/socket.js';
import observabilityPlugin from './plugins/observability.js';

import authRoutes from './modules/auth.routes.js';
import tenantRoutes from './modules/tenants.routes.js';
import userRoutes from './modules/users.routes.js';
import customerRoutes from './modules/customers.routes.js';
import vehicleRoutes from './modules/vehicles.routes.js';
import workOrderRoutes from './modules/workorders.routes.js';
import inventoryRoutes from './modules/inventory.routes.js';
import serviceRoutes from './modules/services.routes.js';
import billingRoutes from './modules/billing.routes.js';
import dashboardRoutes from './modules/dashboard.routes.js';
import observabilityRoutes from './modules/observability.routes.js';
import fileRoutes from './modules/files.routes.js';
import searchRoutes from './modules/search.routes.js';
import catalogRoutes from './modules/catalog.routes.js';
import appointmentRoutes from './modules/appointments.routes.js';
import inspectionRoutes from './modules/inspections.routes.js';
import quoteRoutes from './modules/quotes.routes.js';
import partsOrderRoutes from './modules/parts-orders.routes.js';
import flowRoutes from './modules/flow.routes.js';
import followUpRoutes from './modules/followups.routes.js';
import insurerRoutes, { insuranceCaseRoutes } from './modules/insurers.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(isProd
        ? {}
        : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
      redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password'],
    },
    trustProxy: true,
    bodyLimit: 8 * 1024 * 1024,
    disableRequestLogging: isProd,
  });

  // ------------------------------------------------------------ seguridad
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    allowList: (req) => req.url.startsWith('/api/health') || req.url.startsWith('/api/files/'),
  });

  // ---------------------------------------------------- fotos y adjuntos
  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } });
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: env.UPLOAD_DIR,
    prefix: '/api/files/',
    decorateReply: false,
    cacheControl: true,
    maxAge: '30d',
    index: false,
    list: false,
  });

  // -------------------------------------------------------------- plugins
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(observabilityPlugin);
  await app.register(socketPlugin);

  // ------------------------------------------------------ manejo de errores
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: error.flatten().fieldErrors,
      });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message, details: error.details });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const map: Record<string, [number, string]> = {
        P2002: [409, 'Ya existe un registro con esos datos únicos'],
        P2003: [409, 'Existen registros relacionados que impiden la operación'],
        P2025: [404, 'Registro no encontrado'],
      };
      const [code, message] = map[error.code] ?? [400, 'Error de base de datos'];
      return reply.code(code).send({ error: error.code, message });
    }
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.code(429).send({ error: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intentá en unos segundos' });
    }

    req.log.error({ err: error }, 'Error no controlado');
    return reply.code(500).send({ error: 'INTERNAL', message: isProd ? 'Error interno del servidor' : String((error as Error).message ?? error) });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'NOT_FOUND', message: `Ruta ${req.method} ${req.url} inexistente` });
  });

  // --------------------------------------------------------------- health
  app.get('/api/health', async () => {
    const started = Date.now();
    let db = 'down';
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      dbLatencyMs: Date.now() - started,
      uptimeSec: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '0.1.0',
      env: env.NODE_ENV,
    };
  });

  // --------------------------------------------------------------- rutas
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(tenantRoutes, { prefix: '/api/tenants' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(customerRoutes, { prefix: '/api/customers' });
  await app.register(vehicleRoutes, { prefix: '/api/vehicles' });
  await app.register(workOrderRoutes, { prefix: '/api/work-orders' });
  await app.register(inventoryRoutes, { prefix: '/api/inventory' });
  await app.register(serviceRoutes, { prefix: '/api/services' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(fileRoutes, { prefix: '/api' });
  await app.register(searchRoutes, { prefix: '/api/search' });
  await app.register(catalogRoutes, { prefix: '/api/catalog' });
  await app.register(appointmentRoutes, { prefix: '/api/appointments' });
  await app.register(inspectionRoutes, { prefix: '/api/inspections' });
  await app.register(quoteRoutes, { prefix: '/api/quotes' });
  await app.register(partsOrderRoutes, { prefix: '/api/parts-orders' });
  await app.register(flowRoutes, { prefix: '/api/work-orders' });
  await app.register(followUpRoutes, { prefix: '/api/follow-ups' });
  await app.register(insurerRoutes, { prefix: '/api/insurers' });
  await app.register(insuranceCaseRoutes, { prefix: '/api/work-orders' });
  await app.register(observabilityRoutes, { prefix: '/api/observability' });

  app.log.info(`🗄️  DB: ${dbUrlRedacted}`);
  return app;
}
