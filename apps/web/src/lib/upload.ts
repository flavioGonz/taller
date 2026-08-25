'use client';

/**
 * Redimensiona en el navegador antes de subir: el contenedor no necesita
 * libvips ni ImageMagick y las fotos de recepción quedan livianas.
 */
export async function resizeImage(file: File | Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  return blob ?? file;
}

export interface UploadResult {
  url: string;
  mimeType: string;
  filename?: string;
  width?: number;
  height?: number;
}

export async function uploadFile(blob: Blob, filename: string): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', blob, filename);

  const res = await fetch('/api/upload', { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      message = (await res.json()).message ?? message;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new Error(message);
  }
  return res.json();
}

/** Sube una foto ya redimensionada y devuelve además sus dimensiones reales. */
export async function uploadPhoto(file: File): Promise<UploadResult> {
  const blob = await resizeImage(file);
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
  const up = await uploadFile(blob, file.name.replace(/\.[^.]+$/, '') + '.jpg');
  return { ...up, ...dims };
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(head ?? '')?.[1] ?? 'image/png';
  const bin = atob(body ?? '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
