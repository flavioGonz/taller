import { PrismaClient } from '@prisma/client';
import { env, isProd } from '../env.js';

/**
 * Cliente Prisma único (pooling delegado a PgBouncer o al pool interno vía
 * `connection_limit` en la DATABASE_URL). En dev se cachea en globalThis para
 * sobrevivir al hot-reload de tsx y evitar fugas de conexiones.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd
      ? [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });

if (!isProd) globalForPrisma.prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export const dbUrlRedacted = env.DATABASE_URL.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
