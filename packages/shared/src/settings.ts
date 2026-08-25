// =============================================================================
//  AJUSTES DEL TALLER — lo que vive en `Tenant.settings`
//  Un solo lugar donde se define qué se puede configurar y con qué valor
//  arranca, para que la API y la pantalla de Configuración no se desincronicen.
// =============================================================================

export interface OperationSettings {
  /** Días de la semana que abre el taller (0 = domingo). */
  workDays: number[];
  opensAt: string;   // "08:00"
  closesAt: string;  // "18:00"
  lunchFrom: string | null;
  lunchTo: string | null;
  /** Duración por defecto de un turno de agenda, en minutos. */
  slotMinutes: number;
  /** Cuántos vehículos se pueden recibir por día sin saturar el taller. */
  dailyCapacity: number;
  /** Días hábiles de entrega que se ofrecen por defecto. */
  defaultLeadDays: number;
}

export interface QuoteSettings {
  validityDays: number;
  defaultWarrantyDays: number;
  defaultEstimatedDays: number;
  /** Valor de la hora de mano de obra del taller. */
  laborRate: number;
  /** Texto de condiciones que sale impreso en el PDF. */
  terms: string;
  /** Exigir que el presupuesto tenga descripción de la rotura antes de enviarlo. */
  requireSummary: boolean;
}

export interface BillingSettings {
  taxPct: number;
  paymentTermDays: number;
  invoicePrefix: string;
  /** Redondeo del total al cerrar el documento. */
  roundTotals: boolean;
}

export interface NotificationSettings {
  quoteByEmail: boolean;
  quoteByWhatsapp: boolean;
  notifyOnReady: boolean;
  /** A los cuántos días de la entrega se llama al cliente. */
  satisfactionAfterDays: number;
  /** Cada cuántos meses se recuerda el próximo service. */
  serviceReminderMonths: number;
  warrantyReminderDays: number;
}

export interface WorkshopSettings {
  operation: OperationSettings;
  quotes: QuoteSettings;
  billing: BillingSettings;
  notifications: NotificationSettings;
}

export const SETTINGS_DEFAULTS: WorkshopSettings = {
  operation: {
    workDays: [1, 2, 3, 4, 5, 6],
    opensAt: '08:00',
    closesAt: '18:00',
    lunchFrom: '12:30',
    lunchTo: '13:30',
    slotMinutes: 60,
    dailyCapacity: 8,
    defaultLeadDays: 3,
  },
  quotes: {
    validityDays: 15,
    defaultWarrantyDays: 90,
    defaultEstimatedDays: 3,
    laborRate: 1200,
    terms:
      'Precios en pesos uruguayos, IVA incluido. Los repuestos se piden una vez aprobado el presupuesto. ' +
      'Los trabajos no detallados en este documento se presupuestan aparte.',
    requireSummary: true,
  },
  billing: {
    taxPct: 22,
    paymentTermDays: 0,
    invoicePrefix: 'A',
    roundTotals: true,
  },
  notifications: {
    quoteByEmail: true,
    quoteByWhatsapp: true,
    notifyOnReady: true,
    satisfactionAfterDays: 2,
    serviceReminderMonths: 6,
    warrantyReminderDays: 15,
  },
};

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Lunes', short: 'Lu' },
  { value: 2, label: 'Martes', short: 'Ma' },
  { value: 3, label: 'Miércoles', short: 'Mi' },
  { value: 4, label: 'Jueves', short: 'Ju' },
  { value: 5, label: 'Viernes', short: 'Vi' },
  { value: 6, label: 'Sábado', short: 'Sá' },
  { value: 0, label: 'Domingo', short: 'Do' },
];

/** Mezcla lo guardado con los valores por defecto, sección por sección. */
export function withSettingsDefaults(raw: unknown): WorkshopSettings {
  const s = (raw ?? {}) as Partial<WorkshopSettings>;
  return {
    operation: { ...SETTINGS_DEFAULTS.operation, ...(s.operation ?? {}) },
    quotes: { ...SETTINGS_DEFAULTS.quotes, ...(s.quotes ?? {}) },
    billing: { ...SETTINGS_DEFAULTS.billing, ...(s.billing ?? {}) },
    notifications: { ...SETTINGS_DEFAULTS.notifications, ...(s.notifications ?? {}) },
  };
}

export const TIMEZONES = [
  'America/Montevideo', 'America/Argentina/Buenos_Aires', 'America/Sao_Paulo',
  'America/Santiago', 'America/Asuncion', 'UTC',
];

export const CURRENCIES = [
  { code: 'UYU', label: 'Peso uruguayo ($)' },
  { code: 'USD', label: 'Dólar (US$)' },
  { code: 'ARS', label: 'Peso argentino' },
  { code: 'BRL', label: 'Real' },
];
