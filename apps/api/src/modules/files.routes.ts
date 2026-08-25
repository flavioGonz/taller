import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { env } from '../env.js';
import { badRequest } from '../lib/errors.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const EXT: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf',
};

/**
 * Subida de fotos de inspección, firmas y adjuntos.
 * Las imágenes llegan ya redimensionadas desde el navegador (máx. 1600 px), así
 * el contenedor no necesita libvips ni ImageMagick: guarda el stream y listo.
 */
export default async function fileRoutes(app: FastifyInstance) {
  app.post('/upload', { preHandler: [app.authenticate, app.authorize('file:upload')] }, async (req, reply) => {
    const tenantId = req.scope();
    const file = await req.file({ limits: { fileSize: 12 * 1024 * 1024 } });
    if (!file) throw badRequest('No se recibió ningún archivo');
    if (!ALLOWED.has(file.mimetype)) throw badRequest(`Tipo no permitido: ${file.mimetype}`);

    const now = new Date();
    const folder = path.join(env.UPLOAD_DIR, tenantId, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    await mkdir(folder, { recursive: true });

    const name = `${randomUUID()}${EXT[file.mimetype] ?? ''}`;
    const full = path.join(folder, name);

    try {
      await pipeline(file.file, createWriteStream(full));
    } catch (err) {
      await unlink(full).catch(() => undefined);
      throw err;
    }
    if (file.file.truncated) {
      await unlink(full).catch(() => undefined);
      throw badRequest('El archivo supera los 12 MB');
    }

    const url = `/api/files/${tenantId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${name}`;
    reply.code(201);
    return { url, mimeType: file.mimetype, filename: file.filename };
  });
}
