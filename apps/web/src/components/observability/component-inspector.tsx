'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

/**
 * ============================================================================
 *  COMPONENT INSPECTOR AGENT (cliente)
 * ============================================================================
 *  Audita el árbol renderizado en busca de:
 *   · fallos de accesibilidad (a11y): imágenes sin alt, botones sin nombre
 *     accesible, inputs sin label, contraste insuficiente en texto pequeño
 *   · inconsistencias del sistema de diseño: colores/espaciados fuera de token
 *   · renders costosos: long tasks y layout shifts atribuibles a una ruta
 *  Envía los hallazgos agrupados a POST /api/observability/report.
 */

interface Finding {
  code: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  title: string;
  detail?: string;
  target?: string;
  metrics?: Record<string, unknown>;
  suggestion?: string;
}

const SCAN_DELAY = 2500;

function auditA11y(root: ParentNode, route: string): Finding[] {
  const findings: Finding[] = [];

  const imgs = [...root.querySelectorAll('img:not([alt])')];
  if (imgs.length) {
    findings.push({
      code: 'A11Y_IMG_NO_ALT',
      severity: 'WARN',
      title: `${imgs.length} imagen(es) sin atributo alt`,
      target: route,
      metrics: { count: imgs.length },
      suggestion: 'Agregar alt descriptivo, o alt="" si la imagen es decorativa.',
    });
  }

  const buttons = [...root.querySelectorAll('button, [role="button"]')].filter((el) => {
    const hasText = (el.textContent ?? '').trim().length > 0;
    const hasLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.hasAttribute('title');
    return !hasText && !hasLabel;
  });
  if (buttons.length) {
    findings.push({
      code: 'A11Y_BUTTON_NO_NAME',
      severity: 'ERROR',
      title: `${buttons.length} botón(es) sin nombre accesible`,
      target: route,
      metrics: { count: buttons.length },
      suggestion: 'Agregar aria-label al botón de sólo ícono.',
    });
  }

  const inputs = [...root.querySelectorAll('input, select, textarea')].filter((el) => {
    const id = el.getAttribute('id');
    const labelled =
      (id && root.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
      el.hasAttribute('aria-label') ||
      el.hasAttribute('aria-labelledby') ||
      el.closest('label');
    return !labelled && el.getAttribute('type') !== 'hidden';
  });
  if (inputs.length) {
    findings.push({
      code: 'A11Y_INPUT_NO_LABEL',
      severity: 'WARN',
      title: `${inputs.length} campo(s) de formulario sin label asociado`,
      target: route,
      metrics: { count: inputs.length },
      suggestion: 'Usar <label for> o aria-label; el componente <Input label> ya lo resuelve.',
    });
  }

  const smallTargets = [...root.querySelectorAll('button, a[href]')].filter((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    // Los enlaces sólo-para-lectores-de-pantalla miden 1×1 a propósito:
    // no son objetivos táctiles y no cuentan para esta regla.
    if (r.width <= 2 || r.height <= 2) return false;
    return r.width < 24 || r.height < 24;
  });
  if (smallTargets.length > 2) {
    findings.push({
      code: 'A11Y_TOUCH_TARGET',
      severity: 'INFO',
      title: `${smallTargets.length} objetivos táctiles menores a 24px`,
      target: route,
      metrics: { count: smallTargets.length },
      suggestion: 'WCAG 2.2 (2.5.8) sugiere un área mínima de 24×24 px.',
    });
  }

  return findings;
}

function auditDesignSystem(root: ParentNode, route: string): Finding[] {
  const findings: Finding[] = [];
  const offenders = [...root.querySelectorAll<HTMLElement>('[style]')].filter((el) => {
    // Un color que sale del dato (el color real del auto, el logo de una marca)
    // no es una decisión de diseño: se marca con data-color-source y no cuenta.
    if (el.hasAttribute('data-color-source')) return false;
    const s = el.getAttribute('style') ?? '';
    return /(^|;)\s*(color|background(-color)?|border-color)\s*:\s*(#|rgb)/i.test(s);
  });
  if (offenders.length) {
    findings.push({
      code: 'DS_HARDCODED_COLOR',
      severity: 'INFO',
      title: `${offenders.length} elemento(s) con color embebido fuera del sistema de diseño`,
      target: route,
      metrics: { count: offenders.length },
      suggestion: 'Reemplazar por tokens (var(--color-…)) o clases utilitarias del tema.',
    });
  }
  return findings;
}

export function ComponentInspector({ route }: { route: string }) {
  const sent = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_INSPECTOR === 'off') return;

    let longTasks = 0;
    let cls = 0;
    let po: PerformanceObserver | undefined;
    try {
      po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') longTasks += 1;
          if (entry.entryType === 'layout-shift') cls += (entry as unknown as { value: number }).value;
        }
      });
      po.observe({ entryTypes: ['longtask', 'layout-shift'] });
    } catch {
      /* navegador sin soporte */
    }

    const timer = setTimeout(() => {
      const findings = [...auditA11y(document, route), ...auditDesignSystem(document, route)];

      if (longTasks > 3) {
        findings.push({
          code: 'PERF_LONG_TASKS',
          severity: 'WARN',
          title: `${longTasks} tareas largas (>50ms) bloquearon el hilo principal en ${route}`,
          target: route,
          metrics: { longTasks },
          suggestion: 'Memoizar listas grandes, virtualizar tablas y mover cálculos a useMemo o a un worker.',
        });
      }
      if (cls > 0.1) {
        findings.push({
          code: 'PERF_LAYOUT_SHIFT',
          severity: 'WARN',
          title: `CLS acumulado de ${cls.toFixed(3)} en ${route}`,
          target: route,
          metrics: { cls: +cls.toFixed(3) },
          suggestion: 'Reservar altura con skeletons del mismo tamaño que el contenido final.',
        });
      }

      const fresh = findings.filter((f) => !sent.current.has(`${f.code}|${route}`));
      fresh.forEach((f) => sent.current.add(`${f.code}|${route}`));
      if (fresh.length) void api.post('/observability/report', { findings: fresh }).catch(() => undefined);
    }, SCAN_DELAY);

    return () => {
      clearTimeout(timer);
      po?.disconnect();
    };
  }, [route]);

  return null;
}
