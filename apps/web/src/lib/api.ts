'use client';

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  // Access token vencido → intenta refrescar una sola vez
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) return request<T>(path, init, false);
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

export const api = {
  get: <T,>(path: string) => request<T>(path),
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
