'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastTone = 'brand' | 'ok' | 'warn' | 'danger';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milisegundos en pantalla. 0 = no se va solo. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  tone: ToastTone;
}

const ICONS: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  brand: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  danger: XCircle,
};

interface ToastApi {
  toast: (o: ToastOptions) => number;
  ok: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  warn: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
}

const Ctx = createContext<ToastApi | null>(null);

/**
 * Avisos flotantes. Reemplazan a los carteles que quedaban colgados en la
 * pantalla: aparecen abajo a la derecha, se van solos y no tapan el trabajo.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback((o: ToastOptions) => {
    seq.current += 1;
    const id = seq.current;
    const item: ToastItem = { ...o, id, tone: o.tone ?? 'brand' };
    setItems((prev) => [...prev.slice(-3), item]);
    const duration = o.duration ?? (item.tone === 'danger' ? 7000 : 4200);
    if (duration > 0) {
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    }
    return id;
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    toast,
    ok: (title, description) => toast({ title, description, tone: 'ok' }),
    error: (title, description) => toast({ title, description, tone: 'danger' }),
    warn: (title, description) => toast({ title, description, tone: 'warn' }),
    dismiss,
  }), [toast, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2"
          role="region"
          aria-label="Avisos"
        >
          <AnimatePresence initial={false}>
            {items.map((t) => {
              const Icon = ICONS[t.tone];
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: 40, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 30, scale: 0.96, transition: { duration: 0.16 } }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className={cn('ts-toast pointer-events-auto', t.tone !== 'brand' && t.tone)}
                  role="status"
                  aria-live={t.tone === 'danger' ? 'assertive' : 'polite'}
                >
                  <Icon className="ts-toast-ic size-[18px]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="ts-toast-title">{t.title}</p>
                    {t.description && <p className="ts-toast-desc">{t.description}</p>}
                    {t.action && (
                      <button
                        type="button"
                        onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                        className="focus-ring mt-1.5 rounded text-[12px] font-semibold text-[var(--brand)] hover:underline"
                      >
                        {t.action.label}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Cerrar aviso"
                    className="focus-ring -mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-lg text-[var(--subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

/** Avisos flotantes. Si no hay proveedor, no rompe: no muestra nada. */
export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  return ctx ?? {
    toast: () => 0,
    ok: () => 0,
    error: () => 0,
    warn: () => 0,
    dismiss: () => undefined,
  };
}
