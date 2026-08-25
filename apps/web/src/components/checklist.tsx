'use client';

import { Check, X, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistItem } from '@taller/shared';

export type ChecklistValue = Record<string, boolean | string | null>;

/**
 * Inventario de recepción / control de calidad. Tres estados por ítem para no
 * mentir: sí, no, y "no aplica" (que es distinto de no haberlo mirado).
 */
export function Checklist({
  items,
  value,
  onChange,
  readOnly = false,
}: {
  items: readonly ChecklistItem[];
  value: ChecklistValue;
  onChange: (next: ChecklistValue) => void;
  readOnly?: boolean;
}) {
  const groups = [...new Set(items.map((i) => i.group))];
  const set = (code: string, v: boolean | string | null) => onChange({ ...value, [code]: v });

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group}>
          <p className="ts-nav-section !px-0 !pt-0">{group}</p>
          <div className="space-y-1.5">
            {items.filter((i) => i.group === group).map((item) => (
              <div key={item.code} className="flex items-center gap-3 rounded-[var(--r)] px-2 py-1.5 hover:bg-[var(--surface-2)]">
                <span className="flex-1 text-[13.5px]">{item.label}</span>

                {item.kind === 'bool' && (
                  <div className="flex gap-1" role="group" aria-label={item.label}>
                    {([
                      { v: true, icon: Check, cls: 'data-[on=true]:bg-[var(--ok-bg)] data-[on=true]:text-[var(--ok)]', label: 'Sí' },
                      { v: false, icon: X, cls: 'data-[on=true]:bg-[var(--falla-bg)] data-[on=true]:text-[var(--falla)]', label: 'No' },
                      { v: null, icon: Minus, cls: 'data-[on=true]:bg-[var(--surface-2)] data-[on=true]:text-[var(--muted)]', label: 'No aplica' },
                    ] as const).map(({ v, icon: Icon, cls, label }) => (
                      <button
                        key={String(v)}
                        type="button"
                        disabled={readOnly}
                        data-on={value[item.code] === v || (v === null && value[item.code] === undefined)}
                        onClick={() => set(item.code, v)}
                        aria-label={`${item.label}: ${label}`}
                        aria-pressed={value[item.code] === v}
                        className={cn('focus-ring grid size-7 place-items-center rounded-lg border border-[var(--border)] text-[var(--subtle)] transition-colors disabled:opacity-60', cls)}
                      >
                        <Icon className="size-3.5" aria-hidden />
                      </button>
                    ))}
                  </div>
                )}

                {item.kind === 'state' && (
                  <div className="flex gap-1" role="group" aria-label={item.label}>
                    {(['BUENO', 'REGULAR', 'MALO'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={readOnly}
                        onClick={() => set(item.code, s)}
                        aria-pressed={value[item.code] === s}
                        className={cn(
                          'ts-chip !px-2.5 !py-1 !text-[12px]',
                          value[item.code] === s && s === 'BUENO' && '!border-[var(--ok-bd)] !bg-[var(--ok-bg)] !text-[var(--ok)]',
                          value[item.code] === s && s === 'REGULAR' && '!border-[var(--warn-bd)] !bg-[var(--warn-bg)] !text-[var(--warn)]',
                          value[item.code] === s && s === 'MALO' && '!border-[var(--falla-bd)] !bg-[var(--falla-bg)] !text-[var(--falla)]',
                        )}
                      >
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                )}

                {item.kind === 'text' && (
                  <input
                    className="ts-input !w-56 !py-1.5 !text-[13px]"
                    disabled={readOnly}
                    value={typeof value[item.code] === 'string' ? (value[item.code] as string) : ''}
                    onChange={(e) => set(item.code, e.target.value)}
                    aria-label={item.label}
                    placeholder="—"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
