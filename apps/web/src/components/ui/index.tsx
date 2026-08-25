'use client';

import { forwardRef, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Button */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: '',
  secondary: 'sec',
  outline: 'line',
  ghost: 'ghost',
  danger: 'danger',
  success: 'ok',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-[9px] text-[12px] gap-1 rounded-[8px]',
  sm: 'h-8 px-[11px] text-[13px] gap-[5px] rounded-[9px]',
  md: 'h-9 px-[15px] text-[14px]',
  lg: 'h-11 px-[20px] text-[15px]',
  icon: 'size-9 p-0',
  'icon-sm': 'size-8 p-0',
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; tip?: string }
>(function Button({ className, variant = 'primary', size = 'md', loading, tip, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn('ts-btn focus-ring', VARIANTS[variant], SIZES[size], loading && 'pointer-events-none', className)}
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
function FieldLabel({ htmlFor, label, icon, tip, required, aside }: {
  htmlFor?: string; label: string; icon?: React.ReactNode; tip?: string; required?: boolean; aside?: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="ts-label flex items-center gap-1.5">
      {icon && <span className="text-[var(--subtle)]">{icon}</span>}
      {label}
      {required && <span className="ts-field-required" aria-hidden>*</span>}
      {aside && <span className="ml-auto font-normal text-[var(--subtle)]">{aside}</span>}
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
  React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string; error?: string; hint?: string; icon?: React.ReactNode; tip?: string;
    /** Adorno a la derecha del campo: unidad, atajo (no recibe clics). */
    suffix?: React.ReactNode;
    /** Control a la derecha del campo: mostrar contraseña, limpiar, etc. */
    trailing?: React.ReactNode;
  }
>(function Input({ className, label, error, hint, icon, tip, suffix, trailing, id, ...props }, ref) {
  const auto = useId();
  const inputId = id ?? props.name ?? auto;
  return (
    <div className="w-full">
      {label && <FieldLabel htmlFor={inputId} label={label} icon={icon} tip={tip} required={props.required} />}
      <div className="relative">
        {icon && !label && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]">{icon}</span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn('ts-input', icon && !label && 'pl-9', (suffix || trailing) && 'pr-11', className)}
          {...props}
        />
        {suffix && !trailing && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--subtle)]">{suffix}</span>
        )}
        {trailing && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>
        )}
      </div>
      {hint && !error && <p id={`${inputId}-hint`} className="mt-1 text-[11.5px] text-[var(--subtle)]">{hint}</p>}
      {error && (
        <p id={`${inputId}-error`} className="mt-1 flex items-center gap-1 text-[12px] text-[var(--falla)]">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; icon?: React.ReactNode; tip?: string; error?: string; hint?: string }
>(function Select({ className, label, icon, tip, error, hint, id, children, ...props }, ref) {
  const auto = useId();
  const selectId = id ?? props.name ?? auto;
  return (
    <div className="w-full">
      {label && <FieldLabel htmlFor={selectId} label={label} icon={icon} tip={tip} required={props.required} />}
      <div className="relative">
        {icon && !label && (
          <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--subtle)]">{icon}</span>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn('ts-input', icon && !label && 'pl-9', className)}
          {...props}
        >
          {children}
        </select>
      </div>
      {hint && !error && <p className="mt-1 text-[11.5px] text-[var(--subtle)]">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[12px] text-[var(--falla)]">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; icon?: React.ReactNode; tip?: string; hint?: string; error?: string }
>(function Textarea({ className, label, icon, tip, hint, error, id, maxLength, value, defaultValue, onChange, ...props }, ref) {
  const auto = useId();
  const areaId = id ?? props.name ?? auto;
  const [len, setLen] = useState(String(value ?? defaultValue ?? '').length);

  return (
    <div className="w-full">
      {label && (
        <FieldLabel
          htmlFor={areaId}
          label={label}
          icon={icon}
          tip={tip}
          required={props.required}
          aside={maxLength ? `${value !== undefined ? String(value).length : len}/${maxLength}` : undefined}
        />
      )}
      <textarea
        ref={ref}
        id={areaId}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        onChange={(e) => { setLen(e.target.value.length); onChange?.(e); }}
        className={cn('ts-input', className)}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-[11.5px] text-[var(--subtle)]">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[12px] text-[var(--falla)]">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
});

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
  return <div className={cn('ts-skel', className)} aria-hidden />;
}

/* ------------------------------------------------------------- EmptyState */
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <motion.div
        className="ts-empty-art"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </motion.div>
      <p className="text-[15px] font-semibold">{title}</p>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- Kbd */
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ts-kbd">{children}</kbd>;
}

/* ------------------------------------------------------- Segmented control */
export function Segmented<T extends string>({
  options, value, onChange, label = 'Opciones', className,
}: {
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }>; tip?: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('ts-seg', className)}>
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="ts-seg-btn focus-ring"
            data-tooltip-id={o.tip ? 'ts-tip' : undefined}
            data-tooltip-content={o.tip}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="ts-seg-ink"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                aria-hidden
              />
            )}
            {Icon && <Icon className="size-4" aria-hidden />}
            <span>{o.label}</span>
          </button>
        );
      })}
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
export function Stat({ icon, label, value, hint, tone = 'brand', tip, onClick }: {
  icon?: React.ReactNode; label: string; value: React.ReactNode; hint?: string;
  tone?: 'brand' | 'ok' | 'warn' | 'danger';
  tip?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon && <div className={cn('ts-stat-ic', tone !== 'brand' && tone)}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--muted)]">{label}</p>
        <p className="mono mt-0.5 truncate text-[24px] font-extrabold leading-tight tracking-tight">{value}</p>
        {hint && <p className="truncate text-[11.5px] text-[var(--subtle)]">{hint}</p>}
      </div>
    </>
  );

  const common = {
    className: cn(
      'ts-stat flex items-start gap-3 transition',
      onClick && 'focus-ring cursor-pointer text-left hover:-translate-y-0.5 hover:border-[var(--brand-200)] hover:shadow-[var(--sh-md)]',
    ),
    'data-tooltip-id': tip ? 'ts-tip' : undefined,
    'data-tooltip-content': tip,
  };

  return onClick
    ? <button type="button" onClick={onClick} {...common}>{inner}</button>
    : <div {...common}>{inner}</div>;
}
