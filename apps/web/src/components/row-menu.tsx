'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/** Menú de acciones por fila (editar, eliminar, …) con teclado y clic afuera. */
export function RowMenu({ actions, label = 'Acciones' }: { actions: RowAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = actions.filter((a) => !a.hidden);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="focus-ring rounded-lg p-1.5 text-[var(--subtle)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        <MoreVertical className="size-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 min-w-[180px] overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--sh-lg)]"
        >
          {visible.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); a.onClick(); }}
              className={cn(
                'focus-ring flex w-full items-center gap-2.5 rounded-[var(--r-sm)] px-3 py-2 text-left text-[13.5px]',
                a.danger ? 'text-[var(--falla)] hover:bg-[var(--falla-bg)]' : 'hover:bg-[var(--surface-2)]',
              )}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
