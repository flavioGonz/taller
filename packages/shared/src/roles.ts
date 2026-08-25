export const ROLES = [
  'SUPER_ADMIN',
  'ADMIN_TALLER',
  'JEFE_TALLER',
  'RECEPCIONISTA',
  'TECNICO',
  'REPUESTOS',
  'CAJA',
  'CLIENTE',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super administrador',
  ADMIN_TALLER: 'Administrador del taller',
  JEFE_TALLER: 'Jefe de taller',
  RECEPCIONISTA: 'Recepcionista',
  TECNICO: 'Técnico',
  REPUESTOS: 'Repuestos / Almacén',
  CAJA: 'Caja / Administración',
  CLIENTE: 'Cliente',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: 'Administra la plataforma y todos los talleres.',
  ADMIN_TALLER: 'Control total del taller: usuarios, precios, reportes y configuración.',
  JEFE_TALLER: 'Reparte el trabajo, valida diagnósticos y firma el control de calidad.',
  RECEPCIONISTA: 'Atiende al cliente, recibe el vehículo, arma la OT y presupuesta.',
  TECNICO: 'Ejecuta el trabajo asignado y registra diagnóstico, horas y repuestos usados.',
  REPUESTOS: 'Maneja el stock, los pedidos a proveedores y la entrega de repuestos al taller.',
  CAJA: 'Factura, cobra y sigue las cuentas por cobrar.',
  CLIENTE: 'Consulta sus vehículos, presupuestos e historial.',
};

/** Permisos atómicos del sistema. Formato: `<recurso>:<acción>` */
export const PERMISSIONS = [
  // plataforma
  'tenant:read', 'tenant:write', 'tenant:create',
  'user:read', 'user:write',
  // comercial
  'customer:read', 'customer:write',
  'vehicle:read', 'vehicle:write',
  'catalog:read', 'catalog:write',
  'appointment:read', 'appointment:write',
  // operación
  'workorder:read', 'workorder:read:own', 'workorder:write', 'workorder:status', 'workorder:assign', 'workorder:delete',
  'inspection:read', 'inspection:write',
  'quote:read', 'quote:write', 'quote:decide',
  'quality:read', 'quality:write',
  'delivery:write',
  // almacén
  'inventory:read', 'inventory:write',
  'partsorder:read', 'partsorder:write',
  'service:read', 'service:write',
  // dinero
  'billing:read', 'billing:write',
  // seguimiento
  'followup:read', 'followup:write',
  'dashboard:read', 'audit:read',
  'insight:read', 'insight:write',
  'file:upload',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_TALLER: readonly Permission[] = [
  'tenant:read', 'tenant:write',
  'user:read', 'user:write',
  'customer:read', 'customer:write',
  'vehicle:read', 'vehicle:write',
  'catalog:read', 'catalog:write',
  'appointment:read', 'appointment:write',
  'workorder:read', 'workorder:write', 'workorder:status', 'workorder:assign', 'workorder:delete',
  'inspection:read', 'inspection:write',
  'quote:read', 'quote:write', 'quote:decide',
  'quality:read', 'quality:write',
  'delivery:write',
  'inventory:read', 'inventory:write',
  'partsorder:read', 'partsorder:write',
  'service:read', 'service:write',
  'billing:read', 'billing:write',
  'followup:read', 'followup:write',
  'dashboard:read', 'audit:read', 'insight:read', 'insight:write', 'file:upload',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN_TALLER,
  JEFE_TALLER: [
    'user:read',
    'customer:read', 'customer:write',
    'vehicle:read', 'vehicle:write',
    'catalog:read',
    'appointment:read', 'appointment:write',
    'workorder:read', 'workorder:write', 'workorder:status', 'workorder:assign',
    'inspection:read', 'inspection:write',
    'quote:read', 'quote:write', 'quote:decide',
    'quality:read', 'quality:write',
    'delivery:write',
    'inventory:read', 'partsorder:read', 'partsorder:write',
    'service:read', 'service:write',
    'billing:read',
    'followup:read', 'followup:write',
    'dashboard:read', 'insight:read', 'file:upload',
  ],
  RECEPCIONISTA: [
    'customer:read', 'customer:write',
    'vehicle:read', 'vehicle:write',
    'catalog:read', 'catalog:write',
    'appointment:read', 'appointment:write',
    'workorder:read', 'workorder:write', 'workorder:status',
    'inspection:read', 'inspection:write',
    'quote:read', 'quote:write', 'quote:decide',
    'quality:read', 'delivery:write',
    'inventory:read', 'service:read',
    'billing:read', 'billing:write',
    'followup:read', 'followup:write',
    'dashboard:read', 'file:upload',
  ],
  TECNICO: [
    'customer:read', 'vehicle:read', 'catalog:read',
    'appointment:read',
    'workorder:read:own', 'workorder:write', 'workorder:status',
    'inspection:read', 'inspection:write',
    'quote:read',
    'quality:read',
    'inventory:read', 'service:read',
    'dashboard:read', 'file:upload',
  ],
  REPUESTOS: [
    'vehicle:read', 'catalog:read',
    'workorder:read',
    'quote:read',
    'inventory:read', 'inventory:write',
    'partsorder:read', 'partsorder:write',
    'service:read',
    'dashboard:read', 'file:upload',
  ],
  CAJA: [
    'customer:read', 'customer:write',
    'vehicle:read',
    'workorder:read',
    'quote:read',
    'billing:read', 'billing:write',
    'followup:read', 'followup:write',
    'dashboard:read',
  ],
  CLIENTE: ['workorder:read:own', 'vehicle:read', 'quote:read', 'billing:read'],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAny(role: Role, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** Roles que un ADMIN_TALLER puede crear dentro de su propio taller. */
export const ASSIGNABLE_ROLES: readonly Role[] = [
  'ADMIN_TALLER', 'JEFE_TALLER', 'RECEPCIONISTA', 'TECNICO', 'REPUESTOS', 'CAJA', 'CLIENTE',
];
