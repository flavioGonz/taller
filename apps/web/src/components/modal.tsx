'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const WIDTHS = {
  xs: 'max-w-sm',
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[min(1400px,calc(100vw-32px))]',
} as const;

export type DialogTone = 'brand' | 'ok' | 'warn' | 'danger';

/** Cuántos diálogos hay abiertos: el scroll del fondo se libera con el último. */
let openCount = 0;

function useDialogChrome(open: boolean, onClose: () => void, panelRef: React.RefObject<HTMLDivElement | null>) {
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement;

    openCount += 1;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    if (openCount === 1) {
      // compensar el ancho de la barra de scroll para que la página no salte
      const gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    // el foco entra al primer campo útil, no al botón de cerrar
    const t = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]),textarea:not([disabled]),select:not([disabled]),[data-autofocus]',
      ) ?? panelRef.current;
      target?.focus?.();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      window.clearTimeout(t);
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPad;
      }
      restoreTo.current?.focus?.();
    };
  }, [open, onClose, panelRef]);
}

/** Marca si el cuerpo está tocando el borde de arriba y de abajo, para las sombras. */
function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: true, bottom: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      top: el.scrollTop <= 1,
      bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return { ref, edges, measure };
}

const TONE_ICON: Record<DialogTone, React.ComponentType<{ className?: string }>> = {
  brand: Info,
  ok: CheckCircle2,
  warn: AlertTriangle,
  danger: ShieldAlert,
};

/**
 * Diálogo modal: encabezado y pie fijos, cuerpo con scroll propio y sombras que
 * avisan que hay más contenido. Cierra con Escape o clic afuera, atrapa el foco
 * mientras está abierto y lo devuelve al salir. En el celular sube desde abajo.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  tone = 'brand',
  children,
  footer,
  width = 'md',
  /** Oculta el botón de cerrar cuando la acción tiene que ser explícita. */
  hideClose = false,
  /** Impide cerrar tocando afuera (formularios con datos a medio cargar). */
  persistent = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: DialogTone;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: keyof typeof WIDTHS;
  hideClose?: boolean;
  persistent?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { ref: bodyRef, edges, measure } = useScrollEdges();
  useDialogChrome(open, onClose, panelRef);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const ToneIcon = TONE_ICON[tone];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="ts-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={persistent ? undefined : onClose}
            aria-hidden
          />
          <div className="pointer-events-none fixed inset-0 z-[61] flex items-end justify-center p-0 sm:items-center sm:p-6">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className={cn('ts-dialog sheet pointer-events-auto w-full outline-none', WIDTHS[width])}
            >
              <header className="ts-dialog-head">
                <span className={cn('ts-dialog-ic', tone !== 'brand' && tone)} aria-hidden>
                  {icon ?? <ToneIcon className="size-[19px]" />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="ts-dialog-title">{title}</h2>
                  {description && <p className="ts-dialog-desc">{description}</p>}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="ts-dialog-close focus-ring"
                    aria-label="Cerrar"
                    data-tooltip-id="ts-tip"
                    data-tooltip-content="Cerrar (Esc)"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </header>

              <div
                ref={bodyRef}
                onScroll={measure}
                className="ts-dialog-body"
                data-top={edges.top}
                data-bottom={edges.bottom}
              >
                {children}
              </div>

              {footer && <footer className="ts-dialog-foot">{footer}</footer>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Hoja lateral: entra desde el costado y ocupa todo el alto. Va bien para
 * detalles largos que no ameritan cambiar de página.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  icon,
  tone = 'brand',
  children,
  footer,
  width = 'md',
  side = 'right',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: DialogTone;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: keyof typeof WIDTHS;
  side?: 'right' | 'left';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { ref: bodyRef, edges, measure } = useScrollEdges();
  useDialogChrome(open, onClose, panelRef);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const ToneIcon = TONE_ICON[tone];
  const dir = side === 'right' ? 1 : -1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="ts-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <div className={cn('pointer-events-none fixed inset-y-0 z-[61] flex', side === 'right' ? 'right-0' : 'left-0')}>
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              initial={{ x: 40 * dir, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 30 * dir, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'ts-dialog ts-drawer pointer-events-auto w-[min(100vw,var(--dw))] outline-none',
                side === 'left' && '!rounded-l-none !rounded-r-[var(--r-xl)]',
              )}
              style={{ ['--dw' as string]: width === 'sm' ? '420px' : width === 'lg' ? '760px' : width === 'xl' ? '980px' : '560px' }}
            >
              <header className="ts-dialog-head">
                <span className={cn('ts-dialog-ic', tone !== 'brand' && tone)} aria-hidden>
                  {icon ?? <ToneIcon className="size-[19px]" />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="ts-dialog-title">{title}</h2>
                  {description && <p className="ts-dialog-desc">{description}</p>}
                </div>
                <button type="button" onClick={onClose} className="ts-dialog-close focus-ring" aria-label="Cerrar">
                  <X className="size-4" aria-hidden />
                </button>
              </header>

              <div ref={bodyRef} onScroll={measure} className="ts-dialog-body" data-top={edges.top} data-bottom={edges.bottom}>
                {children}
              </div>

              {footer && <footer className="ts-dialog-foot">{footer}</footer>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Confirmación. El tono cambia el ícono y el color del botón, y `confirmWord`
 * obliga a escribir una palabra cuando lo que se va a hacer no tiene vuelta.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  detail,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading,
  confirmWord,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Contexto extra: qué se conserva, qué se pierde. */
  detail?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
  loading?: boolean;
  confirmWord?: string;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open]);

  const blocked = !!confirmWord && typed.trim().toUpperCase() !== confirmWord.toUpperCase();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      tone={tone}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            disabled={loading || blocked}
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed">{message}</p>
      {detail && <div className="mt-3 rounded-[var(--r)] bg-[var(--surface-2)] p-3 text-[12.5px] text-[var(--muted)]">{detail}</div>}
      {confirmWord && (
        <label className="mt-4 block">
          <span className="ts-label">
            Escribí <strong className="text-[var(--text)]">{confirmWord}</strong> para confirmar
          </span>
          <input
            className="ts-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmWord}
            autoComplete="off"
          />
        </label>
      )}
    </Modal>
  );
}
