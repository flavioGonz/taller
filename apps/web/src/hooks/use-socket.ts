'use client';

import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let refCount = 0;

/**
 * Socket compartido por toda la app (una sola conexión por pestaña).
 * El State & Mutation Observer del backend alerta si el conteo de clientes
 * se dispara — por eso acá se usa refcount y cleanup estricto.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
  }
  return socket;
}

export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const s = getSocket();
    refCount += 1;
    const listener = (payload: T) => ref.current(payload);
    s.on(event, listener);
    return () => {
      s.off(event, listener);
      refCount -= 1;
      if (refCount <= 0) {
        s.disconnect();
        socket = null;
        refCount = 0;
      }
    };
  }, [event, enabled]);
}

export function useWorkOrderRoom(id: string | null) {
  useEffect(() => {
    if (!id) return;
    const s = getSocket();
    s.emit('workorder:subscribe', id);
    return () => {
      s.emit('workorder:unsubscribe', id);
    };
  }, [id]);
}
