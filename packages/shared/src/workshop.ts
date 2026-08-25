// =============================================================================
//  Vocabulario operativo del taller: partes del vehículo, daños, checklists.
//  Es la fuente de verdad compartida por la API, el dashboard y los PDF.
// =============================================================================
import { WORKORDER_STATUSES } from './constants.js';

/* ------------------------------------------------------------------ Partes */

export interface VehiclePart {
  code: string;
  label: string;
  zone: PartZone;
}

export const PART_ZONES = ['FRENTE', 'TRASERA', 'LATERAL_IZQ', 'LATERAL_DER', 'SUPERIOR', 'VIDRIOS', 'RUEDAS', 'INTERIOR', 'MECANICA'] as const;
export type PartZone = (typeof PART_ZONES)[number];

export const ZONE_LABELS: Record<PartZone, string> = {
  FRENTE: 'Frente',
  TRASERA: 'Trasera',
  LATERAL_IZQ: 'Lateral izquierdo',
  LATERAL_DER: 'Lateral derecho',
  SUPERIOR: 'Superior',
  VIDRIOS: 'Vidrios',
  RUEDAS: 'Ruedas',
  INTERIOR: 'Interior',
  MECANICA: 'Mecánica',
};

export const VEHICLE_PARTS: readonly VehiclePart[] = [
  // Frente
  { code: 'paragolpes_del', label: 'Paragolpes delantero', zone: 'FRENTE' },
  { code: 'capo', label: 'Capó', zone: 'FRENTE' },
  { code: 'parrilla', label: 'Parrilla', zone: 'FRENTE' },
  { code: 'optica_del_izq', label: 'Óptica delantera izq.', zone: 'FRENTE' },
  { code: 'optica_del_der', label: 'Óptica delantera der.', zone: 'FRENTE' },
  { code: 'antiniebla_izq', label: 'Antiniebla izq.', zone: 'FRENTE' },
  { code: 'antiniebla_der', label: 'Antiniebla der.', zone: 'FRENTE' },
  { code: 'emblema_del', label: 'Emblema delantero', zone: 'FRENTE' },
  { code: 'matricula_del', label: 'Matrícula delantera', zone: 'FRENTE' },

  // Lateral izquierdo
  { code: 'guardabarro_di', label: 'Guardabarros del. izq.', zone: 'LATERAL_IZQ' },
  { code: 'puerta_di', label: 'Puerta delantera izq.', zone: 'LATERAL_IZQ' },
  { code: 'puerta_ti', label: 'Puerta trasera izq.', zone: 'LATERAL_IZQ' },
  { code: 'espejo_izq', label: 'Espejo izquierdo', zone: 'LATERAL_IZQ' },
  { code: 'zocalo_izq', label: 'Zócalo izquierdo', zone: 'LATERAL_IZQ' },
  { code: 'panel_trasero_izq', label: 'Panel trasero izq.', zone: 'LATERAL_IZQ' },
  { code: 'manija_izq', label: 'Manijas lado izq.', zone: 'LATERAL_IZQ' },

  // Lateral derecho
  { code: 'guardabarro_dd', label: 'Guardabarros del. der.', zone: 'LATERAL_DER' },
  { code: 'puerta_dd', label: 'Puerta delantera der.', zone: 'LATERAL_DER' },
  { code: 'puerta_td', label: 'Puerta trasera der.', zone: 'LATERAL_DER' },
  { code: 'espejo_der', label: 'Espejo derecho', zone: 'LATERAL_DER' },
  { code: 'zocalo_der', label: 'Zócalo derecho', zone: 'LATERAL_DER' },
  { code: 'panel_trasero_der', label: 'Panel trasero der.', zone: 'LATERAL_DER' },
  { code: 'manija_der', label: 'Manijas lado der.', zone: 'LATERAL_DER' },

  // Trasera
  { code: 'paragolpes_tras', label: 'Paragolpes trasero', zone: 'TRASERA' },
  { code: 'tapa_baul', label: 'Tapa de baúl / portón', zone: 'TRASERA' },
  { code: 'optica_tras_izq', label: 'Óptica trasera izq.', zone: 'TRASERA' },
  { code: 'optica_tras_der', label: 'Óptica trasera der.', zone: 'TRASERA' },
  { code: 'escape', label: 'Caño de escape', zone: 'TRASERA' },
  { code: 'matricula_tras', label: 'Matrícula trasera', zone: 'TRASERA' },

  // Superior
  { code: 'techo', label: 'Techo', zone: 'SUPERIOR' },
  { code: 'antena', label: 'Antena', zone: 'SUPERIOR' },
  { code: 'barras_techo', label: 'Barras de techo', zone: 'SUPERIOR' },

  // Vidrios
  { code: 'parabrisas', label: 'Parabrisas', zone: 'VIDRIOS' },
  { code: 'luneta', label: 'Luneta', zone: 'VIDRIOS' },
  { code: 'vidrio_di', label: 'Vidrio puerta del. izq.', zone: 'VIDRIOS' },
  { code: 'vidrio_dd', label: 'Vidrio puerta del. der.', zone: 'VIDRIOS' },
  { code: 'vidrio_ti', label: 'Vidrio puerta tras. izq.', zone: 'VIDRIOS' },
  { code: 'vidrio_td', label: 'Vidrio puerta tras. der.', zone: 'VIDRIOS' },

  // Ruedas
  { code: 'llanta_di', label: 'Llanta del. izq.', zone: 'RUEDAS' },
  { code: 'llanta_dd', label: 'Llanta del. der.', zone: 'RUEDAS' },
  { code: 'llanta_ti', label: 'Llanta tras. izq.', zone: 'RUEDAS' },
  { code: 'llanta_td', label: 'Llanta tras. der.', zone: 'RUEDAS' },
  { code: 'neumatico_di', label: 'Neumático del. izq.', zone: 'RUEDAS' },
  { code: 'neumatico_dd', label: 'Neumático del. der.', zone: 'RUEDAS' },
  { code: 'neumatico_ti', label: 'Neumático tras. izq.', zone: 'RUEDAS' },
  { code: 'neumatico_td', label: 'Neumático tras. der.', zone: 'RUEDAS' },

  // Interior
  { code: 'tablero', label: 'Tablero', zone: 'INTERIOR' },
  { code: 'volante', label: 'Volante', zone: 'INTERIOR' },
  { code: 'butaca_conductor', label: 'Butaca conductor', zone: 'INTERIOR' },
  { code: 'butaca_acompanante', label: 'Butaca acompañante', zone: 'INTERIOR' },
  { code: 'asiento_trasero', label: 'Asiento trasero', zone: 'INTERIOR' },
  { code: 'tapizado_techo', label: 'Tapizado de techo', zone: 'INTERIOR' },
  { code: 'alfombras', label: 'Alfombras', zone: 'INTERIOR' },
  { code: 'multimedia', label: 'Radio / multimedia', zone: 'INTERIOR' },
  { code: 'consola', label: 'Consola central', zone: 'INTERIOR' },
  { code: 'baul_interior', label: 'Interior del baúl', zone: 'INTERIOR' },

  // Mecánica
  { code: 'motor', label: 'Motor', zone: 'MECANICA' },
  { code: 'caja', label: 'Caja de cambios', zone: 'MECANICA' },
  { code: 'suspension_del', label: 'Suspensión delantera', zone: 'MECANICA' },
  { code: 'suspension_tras', label: 'Suspensión trasera', zone: 'MECANICA' },
  { code: 'frenos', label: 'Frenos', zone: 'MECANICA' },
  { code: 'bateria', label: 'Batería', zone: 'MECANICA' },
  { code: 'radiador', label: 'Radiador', zone: 'MECANICA' },
  { code: 'otro', label: 'Otro', zone: 'MECANICA' },
];

export const PART_BY_CODE = new Map(VEHICLE_PARTS.map((p) => [p.code, p]));
export const partLabel = (code: string) => PART_BY_CODE.get(code)?.label ?? code;
export const PART_CODES = VEHICLE_PARTS.map((p) => p.code);

export function partsByZone(): Record<PartZone, VehiclePart[]> {
  const out = Object.fromEntries(PART_ZONES.map((z) => [z, [] as VehiclePart[]])) as Record<PartZone, VehiclePart[]>;
  for (const p of VEHICLE_PARTS) out[p.zone].push(p);
  return out;
}

/* -------------------------------------------------------------- Daños */

export const DAMAGE_TYPES = [
  'RAYON', 'ABOLLADURA', 'ROTURA', 'FALTANTE', 'OXIDO', 'FISURA', 'DESGASTE', 'MANCHA', 'REPARACION_PREVIA', 'OTRO',
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  RAYON: 'Rayón',
  ABOLLADURA: 'Abolladura',
  ROTURA: 'Rotura',
  FALTANTE: 'Faltante',
  OXIDO: 'Óxido',
  FISURA: 'Fisura',
  DESGASTE: 'Desgaste',
  MANCHA: 'Mancha',
  REPARACION_PREVIA: 'Reparación previa',
  OTRO: 'Otro',
};

export const DAMAGE_SEVERITIES = ['LEVE', 'MODERADO', 'GRAVE'] as const;
export type DamageSeverity = (typeof DAMAGE_SEVERITIES)[number];

export const SEVERITY_LABELS: Record<DamageSeverity, string> = {
  LEVE: 'Leve',
  MODERADO: 'Moderado',
  GRAVE: 'Grave',
};

/** Color del pin sobre la foto — también se usa en el PDF. */
export const SEVERITY_COLORS: Record<DamageSeverity, string> = {
  LEVE: '#eab308',
  MODERADO: '#f97316',
  GRAVE: '#ef4444',
};

export const PHOTO_ANGLES = [
  'FRENTE', 'TRASERA', 'LATERAL_IZQ', 'LATERAL_DER', 'TECHO',
  'INTERIOR', 'TABLERO', 'MOTOR', 'BAUL', 'RUEDAS', 'DETALLE', 'OTRO',
] as const;
export type PhotoAngle = (typeof PHOTO_ANGLES)[number];

export const ANGLE_LABELS: Record<PhotoAngle, string> = {
  FRENTE: 'Frente',
  TRASERA: 'Trasera',
  LATERAL_IZQ: 'Lateral izquierdo',
  LATERAL_DER: 'Lateral derecho',
  TECHO: 'Techo',
  INTERIOR: 'Interior',
  TABLERO: 'Tablero (km)',
  MOTOR: 'Motor',
  BAUL: 'Baúl',
  RUEDAS: 'Ruedas',
  DETALLE: 'Detalle',
  OTRO: 'Otro',
};

/** Ángulos que conviene sacar sí o sí en toda recepción. */
export const REQUIRED_ANGLES: readonly PhotoAngle[] = ['FRENTE', 'TRASERA', 'LATERAL_IZQ', 'LATERAL_DER', 'TABLERO'];

/* ------------------------------------------------------ Checklists */

export interface ChecklistItem {
  code: string;
  label: string;
  group: string;
  /** 'bool' = está / no está · 'state' = bueno/regular/malo · 'text' = observación */
  kind: 'bool' | 'state' | 'text';
  /** Ícono de lucide-react: se reconoce el ítem sin leer la etiqueta. */
  icon?: string;
  /** Ayuda corta de qué mirar. */
  hint?: string;
}

/** Color e ícono de cada grupo de checklist, para que se distingan de un vistazo. */
export interface ChecklistGroupStyle { icon: string; tone: 'brand' | 'ok' | 'warn' | 'danger' | 'violeta' | 'cian' }

export const CHECKLIST_GROUPS: Record<string, ChecklistGroupStyle> = {
  Exterior: { icon: 'Car', tone: 'brand' },
  Interior: { icon: 'Armchair', tone: 'violeta' },
  'Mecánica': { icon: 'Cog', tone: 'warn' },
  Herramientas: { icon: 'Wrench', tone: 'warn' },
  Seguridad: { icon: 'ShieldCheck', tone: 'danger' },
  'Documentación': { icon: 'FileText', tone: 'cian' },
  Equipamiento: { icon: 'Package', tone: 'brand' },
  'Estado general': { icon: 'Gauge', tone: 'ok' },
  Trabajo: { icon: 'Wrench', tone: 'brand' },
  'Verificación': { icon: 'ClipboardCheck', tone: 'warn' },
  Entrega: { icon: 'KeyRound', tone: 'ok' },
};

/** Inventario del vehículo al ingresar: lo que después evita discusiones. */
export const INTAKE_CHECKLIST: readonly ChecklistItem[] = [
  { code: 'rueda_auxilio', label: 'Rueda de auxilio', group: 'Herramientas', kind: 'bool', icon: 'CircleDot' },
  { code: 'gato', label: 'Gato', group: 'Herramientas', kind: 'bool', icon: 'ArrowUpFromLine' },
  { code: 'llave_ruedas', label: 'Llave de ruedas', group: 'Herramientas', kind: 'bool', icon: 'Wrench' },
  { code: 'herramientas', label: 'Juego de herramientas', group: 'Herramientas', kind: 'bool', icon: 'Wrench' },
  { code: 'matafuego', label: 'Matafuego', group: 'Seguridad', kind: 'bool', icon: 'FireExtinguisher' },
  { code: 'balizas', label: 'Balizas / triángulos', group: 'Seguridad', kind: 'bool', icon: 'TriangleAlert' },
  { code: 'chaleco', label: 'Chaleco reflectivo', group: 'Seguridad', kind: 'bool', icon: 'Shirt' },
  { code: 'botiquin', label: 'Botiquín', group: 'Seguridad', kind: 'bool', icon: 'BriefcaseMedical' },
  { code: 'libreta', label: 'Libreta de propiedad', group: 'Documentación', kind: 'bool', icon: 'FileText' },
  { code: 'seguro', label: 'Póliza de seguro', group: 'Documentación', kind: 'bool', icon: 'ShieldCheck' },
  { code: 'itv', label: 'Inspección técnica vigente', group: 'Documentación', kind: 'bool', icon: 'BadgeCheck' },
  { code: 'manual', label: 'Manual del vehículo', group: 'Documentación', kind: 'bool', icon: 'BookOpen' },
  { code: 'llave_extra', label: 'Llave adicional', group: 'Documentación', kind: 'bool', icon: 'KeyRound' },
  { code: 'estereo', label: 'Estéreo / multimedia', group: 'Equipamiento', kind: 'bool', icon: 'Radio' },
  { code: 'alfombras', label: 'Alfombras', group: 'Equipamiento', kind: 'bool', icon: 'Layers' },
  { code: 'tapa_combustible', label: 'Tapa de combustible', group: 'Equipamiento', kind: 'bool', icon: 'Fuel' },
  { code: 'antena', label: 'Antena', group: 'Equipamiento', kind: 'bool', icon: 'RadioTower' },
  { code: 'tapa_ruedas', label: 'Tapas de ruedas', group: 'Equipamiento', kind: 'bool', icon: 'CircleDot' },
  { code: 'objetos_valor', label: 'Objetos de valor en el interior', group: 'Equipamiento', kind: 'text', icon: 'Gem' },
  { code: 'neumaticos', label: 'Estado de neumáticos', group: 'Estado general', kind: 'state', icon: 'CircleDot' },
  { code: 'limpieza', label: 'Estado de limpieza', group: 'Estado general', kind: 'state', icon: 'Sparkles' },
  { code: 'testigos', label: 'Testigos encendidos en el tablero', group: 'Estado general', kind: 'text', icon: 'Lightbulb' },
];

/** Control de calidad antes de entregar. */
export const QUALITY_CHECKLIST: readonly ChecklistItem[] = [
  { code: 'trabajo_completo', label: 'El trabajo pedido está completo', group: 'Trabajo', kind: 'bool', icon: 'ClipboardCheck' },
  { code: 'sin_fugas', label: 'Sin pérdidas de fluidos', group: 'Trabajo', kind: 'bool', icon: 'Droplets' },
  { code: 'torque_ruedas', label: 'Torque de ruedas verificado', group: 'Trabajo', kind: 'bool', icon: 'Wrench' },
  { code: 'niveles', label: 'Niveles completos (aceite, refrigerante, freno)', group: 'Trabajo', kind: 'bool', icon: 'Gauge' },
  { code: 'luces', label: 'Luces y señales funcionando', group: 'Trabajo', kind: 'bool', icon: 'Lightbulb' },
  { code: 'testigos_apagados', label: 'Sin testigos encendidos', group: 'Trabajo', kind: 'bool', icon: 'CircleOff' },
  { code: 'prueba_ruta', label: 'Prueba de ruta realizada', group: 'Verificación', kind: 'bool', icon: 'Route' },
  { code: 'sin_ruidos', label: 'Sin ruidos anormales', group: 'Verificación', kind: 'bool', icon: 'Ear' },
  { code: 'frenos_ok', label: 'Frenado correcto', group: 'Verificación', kind: 'bool', icon: 'Disc' },
  { code: 'herramientas_devueltas', label: 'Herramientas del cliente devueltas', group: 'Entrega', kind: 'bool', icon: 'Wrench' },
  { code: 'repuestos_viejos', label: 'Repuestos sustituidos a disposición del cliente', group: 'Entrega', kind: 'bool', icon: 'Package' },
  { code: 'interior_limpio', label: 'Interior limpio (fundas y papeles retirados)', group: 'Entrega', kind: 'bool', icon: 'Sparkles' },
  { code: 'exterior_lavado', label: 'Exterior lavado', group: 'Entrega', kind: 'bool', icon: 'Droplets' },
];

export const CHECK_STATES = ['BUENO', 'REGULAR', 'MALO'] as const;
export type CheckState = (typeof CHECK_STATES)[number];

/* ------------------------------------------------ Presupuestos */

export const QUOTE_STATUSES = [
  'BORRADOR', 'ENVIADO', 'APROBADO', 'APROBADO_PARCIAL', 'RECHAZADO', 'VENCIDO', 'ANULADO', 'SUPERSEDIDO',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado al cliente',
  APROBADO: 'Aprobado',
  APROBADO_PARCIAL: 'Aprobado parcial',
  RECHAZADO: 'Rechazado',
  VENCIDO: 'Vencido',
  ANULADO: 'Anulado',
  SUPERSEDIDO: 'Reemplazado',
};

export const ITEM_DECISIONS = ['PENDIENTE', 'APROBADO', 'RECHAZADO'] as const;
export type ItemDecision = (typeof ITEM_DECISIONS)[number];

export const APPROVAL_CHANNELS = ['TELEFONO', 'WHATSAPP', 'EMAIL', 'PRESENCIAL', 'OTRO'] as const;
export type ApprovalChannel = (typeof APPROVAL_CHANNELS)[number];

export const CHANNEL_LABELS: Record<ApprovalChannel, string> = {
  TELEFONO: 'Teléfono',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Correo',
  PRESENCIAL: 'Presencial',
  OTRO: 'Otro',
};

/* --------------------------------------------- Pedidos de repuestos */

export const PARTS_ORDER_STATUSES = [
  'BORRADOR', 'SOLICITADO', 'CONFIRMADO', 'EN_TRANSITO', 'RECIBIDO_PARCIAL', 'RECIBIDO', 'CANCELADO',
] as const;
export type PartsOrderStatus = (typeof PARTS_ORDER_STATUSES)[number];

export const PARTS_ORDER_LABELS: Record<PartsOrderStatus, string> = {
  BORRADOR: 'Borrador',
  SOLICITADO: 'Solicitado',
  CONFIRMADO: 'Confirmado',
  EN_TRANSITO: 'En tránsito',
  RECIBIDO_PARCIAL: 'Recibido parcial',
  RECIBIDO: 'Recibido',
  CANCELADO: 'Cancelado',
};

/* ------------------------------------------------------- Citas */

export const APPOINTMENT_STATUSES = ['PROGRAMADA', 'CONFIRMADA', 'EN_TALLER', 'NO_ASISTIO', 'CANCELADA'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADA: 'Programada',
  CONFIRMADA: 'Confirmada',
  EN_TALLER: 'En taller',
  NO_ASISTIO: 'No asistió',
  CANCELADA: 'Cancelada',
};

/* -------------------------------------------------- Postventa */

export const FOLLOWUP_KINDS = ['SATISFACCION', 'RECORDATORIO_SERVICE', 'GARANTIA', 'COBRANZA', 'OTRO'] as const;
export type FollowUpKind = (typeof FOLLOWUP_KINDS)[number];

export const FOLLOWUP_LABELS: Record<FollowUpKind, string> = {
  SATISFACCION: 'Encuesta de satisfacción',
  RECORDATORIO_SERVICE: 'Recordatorio de service',
  GARANTIA: 'Seguimiento de garantía',
  COBRANZA: 'Gestión de cobranza',
  OTRO: 'Otro',
};

export const QUALITY_RESULTS = ['APROBADO', 'APROBADO_CON_OBSERVACIONES', 'RECHAZADO'] as const;
export type QualityResult = (typeof QUALITY_RESULTS)[number];

export const QUALITY_RESULT_LABELS: Record<QualityResult, string> = {
  APROBADO: 'Aprobado',
  APROBADO_CON_OBSERVACIONES: 'Aprobado con observaciones',
  RECHAZADO: 'Rechazado — vuelve a taller',
};

/* =============================================================================
   TIPOS DE INGRESO — cada uno tiene su propio recorrido dentro del taller
   ============================================================================= */

export const WORKORDER_KINDS = [
  'MANTENIMIENTO', 'REPARACION', 'DIAGNOSTICO', 'CHAPA_PINTURA',
  'NEUMATICOS', 'GARANTIA', 'SINIESTRO', 'PREENTREGA',
] as const;
export type WorkOrderKind = (typeof WORKORDER_KINDS)[number];

export interface FlowStep {
  status: (typeof WORKORDER_STATUSES)[number];
  label: string;
  hint: string;
  /** Etapa que puede saltarse sin romper el recorrido. */
  optional?: boolean;
}

export interface KindDefinition {
  kind: WorkOrderKind;
  label: string;
  short: string;
  description: string;
  /** Nombre del ícono de lucide-react que le corresponde. */
  icon: string;
  /** Hex de referencia (PDF, exportaciones). */
  color: string;
  /** Token CSS del tema: es lo que usa la interfaz. */
  token: string;
  steps: FlowStep[];
}

const S = {
  recepcion: { status: 'RECEPCION', label: 'Recepción', hint: 'Fotos, inventario y firma del cliente' },
  diagnostico: { status: 'DIAGNOSTICO', label: 'Diagnóstico', hint: 'El técnico revisa y determina qué hay que hacer' },
  presupuesto: { status: 'PRESUPUESTADO', label: 'Presupuesto', hint: 'Se emite y se envía al cliente' },
  aprobado: { status: 'APROBADO', label: 'Aprobación', hint: 'El cliente aprueba o rechaza, ítem por ítem' },
  repuesto: { status: 'ESPERA_REPUESTO', label: 'Repuestos', hint: 'Pedido al proveedor y espera de la mercadería', optional: true },
  proceso: { status: 'EN_PROCESO', label: 'En taller', hint: 'Ejecución del trabajo aprobado' },
  calidad: { status: 'CONTROL_CALIDAD', label: 'Control de calidad', hint: 'Checklist y prueba de ruta antes de entregar' },
  lavado: { status: 'LAVADO', label: 'Lavado', hint: 'Limpieza final del vehículo', optional: true },
  finalizado: { status: 'FINALIZADO', label: 'Listo', hint: 'Terminado, esperando que el cliente lo retire' },
  entregado: { status: 'ENTREGADO', label: 'Entrega', hint: 'Acta de conformidad, garantía y factura' },
} as const satisfies Record<string, FlowStep>;

export const WORKORDER_KIND_DEFS: Record<WorkOrderKind, KindDefinition> = {
  MANTENIMIENTO: {
    kind: 'MANTENIMIENTO',
    label: 'Mantenimiento programado',
    short: 'Service',
    description: 'Service por kilometraje o tiempo, con trabajo y precio conocidos de antemano.',
    icon: 'Wrench',
    color: '#2563eb',
    token: 'var(--kind-mantenimiento)',
    steps: [S.recepcion, S.presupuesto, S.aprobado, S.proceso, S.calidad, S.lavado, S.finalizado, S.entregado],
  },
  REPARACION: {
    kind: 'REPARACION',
    label: 'Reparación correctiva',
    short: 'Reparación',
    description: 'El vehículo entra con una falla: primero se diagnostica y recién después se presupuesta.',
    icon: 'Hammer',
    color: '#f97316',
    token: 'var(--kind-reparacion)',
    steps: [S.recepcion, S.diagnostico, S.presupuesto, S.aprobado, S.repuesto, S.proceso, S.calidad, S.lavado, S.finalizado, S.entregado],
  },
  DIAGNOSTICO: {
    kind: 'DIAGNOSTICO',
    label: 'Diagnóstico / peritaje',
    short: 'Diagnóstico',
    description: 'Sólo revisar y dictaminar. Puede terminar sin trabajo, con el informe entregado.',
    icon: 'Stethoscope',
    color: '#8b5cf6',
    token: 'var(--kind-diagnostico)',
    steps: [S.recepcion, S.diagnostico, S.presupuesto, S.finalizado, S.entregado],
  },
  CHAPA_PINTURA: {
    kind: 'CHAPA_PINTURA',
    label: 'Chapa y pintura',
    short: 'Chapa',
    description: 'Trabajo de carrocería: el peritaje fotográfico y el secado mandan los tiempos.',
    icon: 'SprayCan',
    color: '#0ea5e9',
    token: 'var(--kind-chapa)',
    steps: [S.recepcion, S.diagnostico, S.presupuesto, S.aprobado, S.repuesto, S.proceso, S.calidad, S.lavado, S.finalizado, S.entregado],
  },
  NEUMATICOS: {
    kind: 'NEUMATICOS',
    label: 'Neumáticos y alineación',
    short: 'Neumáticos',
    description: 'Entrada rápida: se cotiza en el momento y se resuelve en el día.',
    icon: 'CircleDot',
    color: '#14b8a6',
    token: 'var(--kind-neumaticos)',
    steps: [S.recepcion, S.presupuesto, S.aprobado, S.proceso, S.calidad, S.finalizado, S.entregado],
  },
  GARANTIA: {
    kind: 'GARANTIA',
    label: 'Retrabajo por garantía',
    short: 'Garantía',
    description: 'Vuelve un trabajo hecho por el taller. No se presupuesta: se corrige.',
    icon: 'ShieldCheck',
    color: '#16a34a',
    token: 'var(--kind-garantia)',
    steps: [S.recepcion, S.diagnostico, S.proceso, S.calidad, S.finalizado, S.entregado],
  },
  SINIESTRO: {
    kind: 'SINIESTRO',
    label: 'Siniestro / seguro',
    short: 'Siniestro',
    description: 'Con compañía de seguros de por medio: el peritaje y la autorización son de ellos.',
    icon: 'FileWarning',
    color: '#dc2626',
    token: 'var(--kind-siniestro)',
    steps: [S.recepcion, S.diagnostico, S.presupuesto, S.aprobado, S.repuesto, S.proceso, S.calidad, S.lavado, S.finalizado, S.entregado],
  },
  PREENTREGA: {
    kind: 'PREENTREGA',
    label: 'Inspección de preentrega',
    short: 'Preentrega',
    description: 'Revisión completa antes de entregar o comprar un vehículo. Termina en informe.',
    icon: 'ClipboardCheck',
    color: '#64748b',
    token: 'var(--kind-preentrega)',
    steps: [S.recepcion, S.diagnostico, S.calidad, S.finalizado, S.entregado],
  },
};

export const stepsFor = (kind: WorkOrderKind): FlowStep[] => WORKORDER_KIND_DEFS[kind]?.steps ?? WORKORDER_KIND_DEFS.REPARACION.steps;

/** Posición del estado actual dentro del recorrido del tipo de ingreso. */
export function progressOf(kind: WorkOrderKind, status: string) {
  const steps = stepsFor(kind);
  const index = steps.findIndex((s) => s.status === status);
  const terminal = status === 'ENTREGADO' || status === 'CANCELADO';
  return {
    steps,
    index,
    /** Estados fuera del recorrido esperado (rechazo, cancelación). */
    offTrack: index === -1 && !terminal,
    percent: terminal ? 100 : index < 0 ? 0 : Math.round(((index + 1) / steps.length) * 100),
  };
}

/** Próximo estado sugerido según el tipo de ingreso. */
export function suggestedNext(kind: WorkOrderKind, status: string): string | null {
  const steps = stepsFor(kind);
  const i = steps.findIndex((s) => s.status === status);
  if (i < 0 || i >= steps.length - 1) return null;
  return steps[i + 1]?.status ?? null;
}

/* =============================================================================
   FICHA DEL VEHÍCULO — color y detalles visuales aparentes
   ============================================================================= */

export interface VehicleColor { code: string; label: string; hex: string }

export const VEHICLE_COLORS: readonly VehicleColor[] = [
  { code: 'blanco', label: 'Blanco', hex: '#f8fafc' },
  { code: 'negro', label: 'Negro', hex: '#111827' },
  { code: 'gris', label: 'Gris', hex: '#9ca3af' },
  { code: 'plata', label: 'Plata', hex: '#d1d5db' },
  { code: 'grafito', label: 'Grafito', hex: '#4b5563' },
  { code: 'rojo', label: 'Rojo', hex: '#dc2626' },
  { code: 'bordo', label: 'Bordó', hex: '#7f1d1d' },
  { code: 'azul', label: 'Azul', hex: '#1d4ed8' },
  { code: 'celeste', label: 'Celeste', hex: '#38bdf8' },
  { code: 'verde', label: 'Verde', hex: '#15803d' },
  { code: 'beige', label: 'Beige', hex: '#e7d8b1' },
  { code: 'marron', label: 'Marrón', hex: '#78350f' },
  { code: 'naranja', label: 'Naranja', hex: '#ea580c' },
  { code: 'amarillo', label: 'Amarillo', hex: '#facc15' },
  { code: 'violeta', label: 'Violeta', hex: '#7c3aed' },
  { code: 'dorado', label: 'Dorado', hex: '#ca8a04' },
];

export const colorHex = (label?: string | null) =>
  VEHICLE_COLORS.find((c) => c.label.toLowerCase() === (label ?? '').toLowerCase() || c.code === (label ?? '').toLowerCase())?.hex ?? null;

/** Detalles visuales que se anotan al registrar el vehículo. */
export const VEHICLE_FEATURES: readonly ChecklistItem[] = [
  { code: 'polarizado', label: 'Vidrios polarizados', group: 'Exterior', kind: 'bool', icon: 'SunDim', hint: 'Lámina o vidrio de fábrica' },
  { code: 'llantas_aleacion', label: 'Llantas de aleación', group: 'Exterior', kind: 'bool', icon: 'CircleDot', hint: 'Distinto de las llantas de chapa' },
  { code: 'barras_techo', label: 'Barras de techo', group: 'Exterior', kind: 'bool', icon: 'Luggage' },
  { code: 'estribos', label: 'Estribos laterales', group: 'Exterior', kind: 'bool', icon: 'Footprints' },
  { code: 'cobertor_caja', label: 'Cobertor de caja / lona', group: 'Exterior', kind: 'bool', icon: 'Container', hint: 'Sólo en pick-ups' },
  { code: 'enganche', label: 'Enganche de remolque', group: 'Exterior', kind: 'bool', icon: 'Link2' },
  { code: 'calcomanias', label: 'Calcomanías o rotulado', group: 'Exterior', kind: 'bool', icon: 'Sticker', hint: 'Ojo al pintar o pulir' },
  { code: 'pintura', label: 'Estado de la pintura', group: 'Exterior', kind: 'state', icon: 'Paintbrush' },
  { code: 'tapizado', label: 'Estado del tapizado', group: 'Interior', kind: 'state', icon: 'Armchair' },
  { code: 'multimedia_extra', label: 'Multimedia no original', group: 'Interior', kind: 'bool', icon: 'Radio', hint: 'Pantalla o estéreo agregado' },
  { code: 'alarma', label: 'Alarma / rastreo', group: 'Interior', kind: 'bool', icon: 'Siren', hint: 'Puede cortar el arranque' },
  { code: 'gnc', label: 'Equipo de GNC', group: 'Mecánica', kind: 'bool', icon: 'Fuel', hint: 'Verificar oblea y vencimiento' },
  { code: 'modificaciones', label: 'Modificaciones visibles', group: 'Mecánica', kind: 'text', icon: 'Wrench', hint: 'Suspensión, escape, motor…' },
];
