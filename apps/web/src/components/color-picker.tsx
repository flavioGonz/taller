'use client';

import { Check, Palette } from 'lucide-react';
import { VEHICLE_COLORS } from '@taller/shared';
import { cn } from '@/lib/utils';

/** Color del vehículo como muestrario: se elige mirando, no escribiendo. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-full">
      <label className="ts-label flex items-center gap-1.5">
        <Palette className="size-3.5 text-[var(--subtle)]" aria-hidden /> Color
      </label>
      <div className="flex flex-wrap gap-1.5">
        {VEHICLE_COLORS.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => onChange(c.label)}
            aria-label={c.label}
            aria-pressed={value === c.label}
            data-tooltip-id="ts-tip"
            data-tooltip-content={c.label}
            className={cn(
              'focus-ring grid size-8 place-items-center rounded-full border-2 transition-transform hover:scale-110',
              value === c.label ? 'border-[var(--brand-500)]' : 'border-[var(--border-strong)]',
            )}
            style={{ background: c.hex }}
          >
            {value === c.label && (
              <Check className="size-4" style={{ color: ['#f8fafc', '#d1d5db', '#e7d8b1', '#facc15'].includes(c.hex) ? '#111827' : '#fff' }} aria-hidden />
            )}
          </button>
        ))}
      </div>
      {value && <p className="mt-1.5 text-[12px] text-[var(--muted)]">Seleccionado: {value}</p>}
    </div>
  );
}
