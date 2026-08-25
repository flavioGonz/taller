'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadPhoto } from '@/lib/upload';
import { cn } from '@/lib/utils';

/**
 * Miniatura con subida: muestra la foto actual y deja reemplazarla de un clic.
 * La imagen se redimensiona en el navegador antes de subirse.
 */
export function ImagePicker({
  value,
  onChange,
  size = 44,
  label = 'Foto',
  fallback,
  disabled,
  className,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  size?: number;
  label?: string;
  fallback?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = { width: size, height: size };

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const up = await uploadPhoto(file);
      onChange(up.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        aria-label={value ? `Cambiar ${label.toLowerCase()}` : `Agregar ${label.toLowerCase()}`}
        data-tooltip-id="ts-tip"
        data-tooltip-content={error ?? (value ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`)}
        className={cn(
          'focus-ring group grid shrink-0 place-items-center overflow-hidden rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--subtle)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]',
          error && 'border-[var(--falla-bd)] text-[var(--falla)]',
          disabled && 'pointer-events-none opacity-60',
        )}
        style={box}
      >
        {busy ? (
          <Loader2 className="size-1/3 animate-spin" aria-hidden />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          fallback ?? <ImagePlus className="size-1/2" aria-hidden />
        )}
      </button>

      {value && !disabled && !busy && (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Quitar ${label.toLowerCase()}`}
          data-tooltip-id="ts-tip"
          data-tooltip-content="Quitar la foto"
          className="focus-ring absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] shadow-[var(--sh-xs)] hover:text-[var(--falla)]"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={`Subir ${label.toLowerCase()}`}
        tabIndex={-1}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </span>
  );
}
