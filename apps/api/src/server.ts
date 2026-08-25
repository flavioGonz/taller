import { buildApp } from './app.js';
import { env } from './env.js';
import { disconnectPrisma } from './lib/prisma.js';
import { flushInsights } from './lib/insights.js';

const app = await buildApp();

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  app.log.info(`🚗 Taller Silver Core Engine escuchando en ${env.API_HOST}:${env.API_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const shutdown = async (signal: string) => {
  app.log.info(`↩️  ${signal} recibido, cerrando…`);
  try {
    await flushInsights();
    await app.close();
    await disconnectPrisma();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => app.log.error({ reason }, 'unhandledRejection'));
