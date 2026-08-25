'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Button */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: '',
  secondary: 'sec',
  outline: 'sec',
  ghost: 'ghost',
  danger: 'danger',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-[11px] py-[6px] text-[13px] gap-[5px] rounded-[9px]',
  md: 'px-[15px] py-[9px] text-[14px]',
  lg: 'px-[20px] py-[12px] text-[15px]',
  icon: 'p-2',
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; tip?: string }
>(function Button({ className, variant = 'primary', size = 'md', loading, tip, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn('ts-btn focus-ring', VARIANTS[variant], SIZES[size], className)}
      {...(tip ? { 'data-tooltip-id': 'ts-tip', 'data-tooltip-content': tip } : {})}
      {...props}
    >
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});

/* -------------------------------------------------------------------- Card */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ts-card', className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ts-card-head', className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('ts-card-title', className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-[18px]', className)} {...props} />;
}

/* ------------------------------------------------------------------- Input */
/** Ícono a la izquierda del campo + tooltip explicativo en el label. */
function FieldLabel({ htmlFor, label, icon, tip }: { htmlFor?: string; label: string; icon?: React.ReactNode; tip?: string }) {
  return (
    <label htmlFor={htmlFor} className="ts-label flex items-center gap-1.5">
      {icon && <span className="text-[var(--subtle)]">{icon}</span>}
      {label}
      {tip && (
        <span data-tooltip-id="ts-tip" data-tooltip-content={tip} className="cursor-help text-[var(--subtle)]" aria-label={tip}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </label>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string; icon?: React.ReactNode; tip?: string }
>(function Input({ className, label, error, hint, icon, tip, id, ...props }, ref) {
  const inputId = id ?? props.name ?? undefined;
  return (
    <div className="w-full">
      {label && <FieldLabel htmlFor={inputId} label={label} icon={icon} tip={tip} />}
      <div className="relative">
        {icon && !label && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]">{icon}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn('ts-input', icon && !label && 'pl-9', className)}
          {...props}
        />
      </div>
      {hint && !error && <p className="mt-1 text-[11.5px] text-[var(--subtle)]">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="mt-1 text-[12px] text-[var(--falla)]">{error}</p>}
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; icon?: React.ReactNode; tip?: string }>(
  function Select({ className, label, icon, tip, id, children, ...props }, ref) {
    const selectId = id ?? props.name ?? undefined;
    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={selectId} label={label} icon={icon} tip={tip} />}
        <select ref={ref} id={selectId} className={cn('ts-input', className)} {...props}>
          {children}
        </select>
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; icon?: React.ReactNode; tip?: string }>(
  function Textarea({ className, label, icon, tip, id, ...props }, ref) {
    const areaId = id ?? props.name ?? undefined;
    return (
      <div className="w-full">
        {label && <FieldLabel htmlFor={areaId} label={label} icon={icon} tip={tip} />}
        <textarea ref={ref} id={areaId} className={cn('ts-input', className)} {...props} />
      </div>
    );
  },
);

/* ------------------------------------------------------------------- Badge */
export type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info' | 'accent';
const TONES: Record<BadgeTone, string> = {
  neutral: 'gris',
  success: 'ok',
  warn: 'warn',
  danger: 'falla',
  info: 'info',
  accent: 'brand',
};

export function Badge({ className, tone = 'neutral', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn('ts-badge', TONES[tone], className)} {...props} />;
}

/* --------------------------------------------------------------- Skeleton */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[var(--r)] bg-[var(--surface-2)]', className)} aria-hidden />;
}

/* ------------------------------------------------------------- EmptyState */
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-[var(--subtle)]">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-[var(--muted)]">{description}</p>}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Table */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('ts-table', className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={className} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={className} {...props} />;
}

/* -------------------------------------------------------------- PageHeader */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="ts-page-title">{title}</h1>
        {description && <p className="ts-page-desc">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- Stat */
export function Stat({ icon, label, value, hint, tone = 'brand' }: {
  icon?: React.ReactNode; label: string; value: React.ReactNode; hint?: string;
  tone?: 'brand' | 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className="ts-stat flex items-start gap-3">
      {icon && <div className={cn('ts-stat-ic', tone !== 'brand' && tone)}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--muted)]">{label}</p>
        <p className="mono mt-0.5 truncate text-[24px] font-extrabold tracking-tight">{value}</p>
        {hint && <p className="text-[11.5px] text-[var(--subtle)]">{hint}</p>}
      </div>
    </div>
  );
}
