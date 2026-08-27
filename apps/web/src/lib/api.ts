'use client';

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';
const BASE = API_BASE;

/** URL absoluta de un endpoint, para links directos (PDF, descargas, etc.). */
export const apiUrl = (path: string) => `${API_BASE}${path}`;

/* --------------------------------------------------------------- sesión */

/**
 * El refresh token **rota**: cada `/auth/refresh` revoca el anterior. Si una
 * pantalla dispara cinco consultas a la vez y el access token venció, las cinco
 * intentarían refrescar y sólo la primera lo lograría —las otras presentarían
 * un token ya revocado y quedarían en 401—. Por eso hay un solo refresh en
 * vuelo: el primero que llega lo hace y los demás esperan ese mismo resultado.
 * Era exactamente lo que dejaba pantallas en blanco hasta apretar F5.
 */
let refrescando: Promise<boolean> | null = null;

/** Rutas que no pueden refrescar, porque son las que manejan la sesión. */
const SIN_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout'];

function refrescarSesion(): Promise<boolean> {
  if (!refrescando) {
    refrescando = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        // se libera en el próximo tick para que las llamadas que entraron
        // mientras tanto reciban este mismo resultado
        setTimeout(() => { refrescando = null; }, 0);
      });
  }
  return refrescando;
}

type Oyente = () => void;
const oyentesSesion = new Set<Oyente>();

/** Avisa cuando la sesión se perdió de verdad (el refresh tampoco sirvió). */
export function onSessionLost(fn: Oyente): () => void {
  oyentesSesion.add(fn);
  return () => oyentesSesion.delete(fn);
}

function sesionPerdida() {
  for (const fn of oyentesSesion) fn();
}

/** Refresca por las nuestras, antes de que venza. Lo usa el proveedor de auth. */
export const keepSessionAlive = () => refrescarSesion();

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  // Access token vencido → un único refresh compartido y se reintenta
  if (res.status === 401 && retry && !SIN_REFRESH.includes(path.split('?')[0]!)) {
    if (await refrescarSesion()) return request<T>(path, init, false);
    sesionPerdida();
  }

  if (!res.ok) {
    let payload: { message?: string; error?: string; details?: unknown } = {};
    try {
      payload = await res.json();
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    const err = new Error(payload.message ?? `Error ${res.status}`) as ApiError;
    err.status = res.status;
    err.code = payload.error;
    err.details = payload.details;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Igual que request pero devuelve el binario: usado para abrir/descargar PDFs. */
async function requestBlob(path: string, retry = true): Promise<Blob> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (res.status === 401 && retry) {
    if (await refrescarSesion()) return requestBlob(path, false);
    sesionPerdida();
  }
  if (!res.ok) {
    const err = new Error(`Error ${res.status}`) as ApiError;
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  blob: (path: string) => requestBlob(path),
  post: <T,>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T,>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
