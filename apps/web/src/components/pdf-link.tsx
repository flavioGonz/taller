'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Abre un PDF del backend en una pestaña nueva pasando por el cliente de API,
 * así se renueva el token si venció en lugar de mostrar un 401 en blanco.
 * La pestaña se abre en el mismo clic para que no la bloquee el navegador.
 */
export function PdfLink({
  path,
  label = 'Ver PDF',
  className,
  tip,
}: {
  path: string;
  label?: string;
  className?: string;
  tip?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function open(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    const tab = window.open('', '_blank');
    setBusy(true);
    setError(false);
    try {
      const blob = await api.blob(path);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void open(e)}
      disabled={busy}
      data-tooltip-id="ts-tip"
      data-tooltip-content={error ? 'No se pudo generar el PDF, probá de nuevo' : (tip ?? 'Abre el PDF en una pestaña nueva')}
      className={cn(
        'focus-ring inline-flex h-8 items-center gap-1.5 rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] font-medium text-[var(--text)] transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60',
        error && 'border-[var(--falla-bd)] text-[var(--falla)]',
        className,
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
      {label}
    </button>
  );
}
