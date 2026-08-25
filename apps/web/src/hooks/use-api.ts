'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ApiError } from '@/lib/api';

interface State<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

/**
 * Fetch declarativo con cancelación y refetch manual.
 * El State & Mutation Observer del backend mide la latencia; acá evitamos
 * los renders extra guardando el resultado en un único setState.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []): State<T> & { refetch: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: !!path });
  const alive = useRef(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    alive.current = true;
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    api
      .get<T>(path)
      .then((data) => alive.current && setState({ data, error: null, loading: false }))
      .catch((error: ApiError) => alive.current && setState({ data: null, error, loading: false }));
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refetch };
}
