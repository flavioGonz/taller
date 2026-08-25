import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env.js';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};

/**
 * Convierte una URL servida por la API (/api/files/…) en un data URL, para
 * embeber la imagen en el PDF sin depender de que el proceso se alcance a sí mismo.
 */
export async function fileToDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  const prefix = '/api/files/';
  if (!url.startsWith(prefix)) return null;

  const rel = url.slice(prefix.length);
  // Nunca salir del directorio de uploads
  const full = path.resolve(env.UPLOAD_DIR, rel);
  if (!full.startsWith(path.resolve(env.UPLOAD_DIR))) return null;

  try {
    const buf = await readFile(full);
    const mime = MIME[path.extname(full).toLowerCase()] ?? 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
