'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const WIDTHS = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' } as const;

/**
 * Diálogo modal accesible: cierra con Escape o clic afuera, atrapa el foco
 * mientras está abierto y devuelve el foco al elemento que lo disparó.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: keyof typeof WIDTHS;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

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
    const timer = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
          <motion.div
            className="fixed inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={cn('relative my-6 w-full rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--sh-pop)]', WIDTHS[width])}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
                {description && <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{description}</p>}
              </div>
              <button onClick={onClose} className="focus-ring rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]" aria-label="Cerrar">
                <X className="size-4" aria-hidden />
              </button>
            </header>

            <div className="px-5 py-4">{children}</div>

            {footer && <footer className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-3">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirmación breve para acciones destructivas. */
export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmLabel = 'Eliminar', loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string; loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <button className="ts-btn ghost focus-ring px-[15px] py-[9px] text-[14px]" onClick={onClose}>Cancelar</button>
          <button className="ts-btn danger focus-ring px-[15px] py-[9px] text-[14px]" onClick={onConfirm} disabled={loading}>
            {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[13.5px] text-[var(--muted)]">{message}</p>
    </Modal>
  );
}
