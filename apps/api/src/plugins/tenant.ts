import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { badRequest, forbidden } from '../lib/errors.js';

/**
 * Aislamiento multi-tenant. Toda consulta de los módulos de negocio debe pasar
 * por `req.scope()` — devuelve el tenantId efectivo y falla si no hay contexto.
 * El SUPER_ADMIN puede operar sobre cualquier taller enviando `x-tenant-id`.
 */
declare module 'fastify' {
  interface FastifyRequest {
    scope: () => string;
  }
}

export default fp(async (app) => {
  app.decorateRequest('scope', function (this: FastifyRequest) {
    const user = this.currentUser;
    if (!user) throw forbidden('Sin contexto de usuario');

    if (user.role === 'SUPER_ADMIN') {
      const header = this.headers['x-tenant-id'];
      const impersonated = Array.isArray(header) ? header[0] : header;
      const tenantId = impersonated || user.tenantId;
      if (!tenantId) throw badRequest('SUPER_ADMIN debe indicar el taller con la cabecera x-tenant-id');
      return tenantId;
    }

    if (!user.tenantId) throw forbidden('El usuario no pertenece a ningún taller');
    return user.tenantId;
  });
});
