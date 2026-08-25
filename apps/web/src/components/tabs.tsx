'use client';

import { useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface TabDef<K extends string = string> {
  key: K;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Contador a la derecha del rótulo. */
  count?: number;
  tip?: string;
}

/**
 * Pestañas con la marca activa deslizándose de una a otra (`layoutId`), en vez
 * del salto seco de un fondo que aparece y desaparece.
 */
export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  className,
  label = 'Secciones',
}: {
  tabs: TabDef<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  label?: string;
}) {
  const ink = useId();
  return (
    <div role="tablist" aria-label={label} className={cn('ts-tabs', className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className="ts-tab focus-ring"
            data-tooltip-id={t.tip ? 'ts-tip' : undefined}
            data-tooltip-content={t.tip}
          >
            {active && (
              <motion.span
                layoutId={`tab-ink-${ink}`}
                className="ts-tab-ink"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                aria-hidden
              />
            )}
            {Icon && <Icon className="size-[15px]" aria-hidden />}
            <span>{t.label}</span>
            {t.count !== undefined && t.count > 0 && (
              <span className="ts-nav-count !ml-0.5">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Contenido de la pestaña: entra y sale con un desplazamiento corto, así se
 * nota el cambio sin marear.
 */
export function TabPanel({ tabKey, children }: { tabKey: string; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tabKey}
        role="tabpanel"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
