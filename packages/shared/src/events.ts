/** Canales y eventos de Socket.io — contrato compartido API ↔ Web ↔ Desktop */
export const SOCKET_EVENTS = {
  WORKORDER_CREATED: 'workorder:created',
  WORKORDER_UPDATED: 'workorder:updated',
  WORKORDER_STATUS_CHANGED: 'workorder:status_changed',
  WORKORDER_DELETED: 'workorder:deleted',
  WORKORDER_ASSIGNED: 'workorder:assigned',
  QUOTE_CREATED: 'quote:created',
  QUOTE_SENT: 'quote:sent',
  QUOTE_DECIDED: 'quote:decided',
  APPOINTMENT_CHANGED: 'appointment:changed',
  PARTS_ORDER_CHANGED: 'partsorder:changed',
  PARTS_RECEIVED: 'partsorder:received',
  QUALITY_CHECKED: 'quality:checked',
  VEHICLE_DELIVERED: 'workorder:delivered',
  INSPECTION_SAVED: 'inspection:saved',
  STOCK_LOW: 'inventory:stock_low',
  STOCK_MOVED: 'inventory:stock_moved',
  DASHBOARD_TICK: 'dashboard:tick',
  INSIGHT_RAISED: 'observability:insight',
  NOTIFICATION: 'notification',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

/** Room por tenant: todos los eventos se emiten sólo dentro del tenant. */
export const tenantRoom = (tenantId: string) => `tenant:${tenantId}`;
/** Room por usuario (notificaciones dirigidas, p.ej. técnico asignado). */
export const userRoom = (userId: string) => `user:${userId}`;
/** Room por OT (pantalla de detalle en vivo). */
export const workOrderRoom = (id: string) => `wo:${id}`;

export interface WorkOrderStatusChangedPayload {
  id: string;
  number: string;
  from: string | null;
  to: string;
  tenantId: string;
  byUserId?: string | null;
  at: string;
}

export interface InsightPayload {
  agent: string;
  severity: string;
  code: string;
  title: string;
  target?: string | null;
  suggestion?: string | null;
}
