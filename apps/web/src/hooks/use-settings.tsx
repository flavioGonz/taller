'use client';

/**
 * Los ajustes del taller, una sola vez para toda la app.
 * Si cada pantalla los pidiera por su cuenta tendríamos una consulta por
 * navegación; acá se cargan al entrar y se comparten por contexto. Mientras
 * no llegan, se usan los valores por defecto, así nada queda esperando.
 */
import { createContext, useCallback, useContext, useMemo } from 'react';
import { useApi } from '@/hooks/use-api';
import { SETTINGS_DEFAULTS, withSettingsDefaults, type WorkshopSettings } from '@taller/shared';

interface Tenant {
  id: string;
  name: string;
  currency?: string | null;
  timezone?: string | null;
  logoUrl?: string | null;
  settings?: unknown;
}

interface Valor {
  settings: WorkshopSettings;
  tenant: Tenant | null;
  listo: boolean;
  refetch: () => void;
}

const Ctx = createContext<Valor>({
  settings: SETTINGS_DEFAULTS,
  tenant: null,
  listo: false,
  refetch: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, refetch } = useApi<Tenant>('/tenants/current');

  const value = useMemo<Valor>(
    () => ({
      settings: withSettingsDefaults(data?.settings),
      tenant: data,
      listo: !loading && !!data,
      refetch,
    }),
    [data, loading, refetch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  return useContext(Ctx);
}

/** Atajo para lo más pedido: el IVA por defecto de un ítem nuevo. */
export function useDefaultTax() {
  const { settings } = useSettings();
  return settings.billing.taxPct;
}

/** Atajo para el valor hora de mano de obra. */
export function useLaborRate() {
  const { settings } = useSettings();
  return settings.quotes.laborRate;
}

/** Devuelve la moneda del taller para formatear importes. */
export function useCurrency() {
  const { tenant } = useSettings();
  return tenant?.currency ?? 'UYU';
}

/** Suma días hábiles según los días que abre el taller. */
export function useBusinessDays() {
  const { settings } = useSettings();
  const dias = settings.operation.workDays;
  return useCallback(
    (desde: Date, cantidad: number) => {
      const d = new Date(desde);
      let faltan = cantidad;
      let guarda = 0;
      while (faltan > 0 && guarda < 400) {
        d.setDate(d.getDate() + 1);
        guarda += 1;
        if (dias.length === 0 || dias.includes(d.getDay())) faltan -= 1;
      }
      return d;
    },
    [dias],
  );
}
