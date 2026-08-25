import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createBrandSchema, createModelSchema, idParamSchema } from '@taller/shared';
import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';

const slugify = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

/**
 * Catálogo de marcas y modelos. Las filas globales (tenantId = null) vienen del
 * dataset importado; cada taller puede sumar las suyas sin tocar las globales.
 */
export default async function catalogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/catalog/brands
  app.get('/brands', { preHandler: [app.authorize('catalog:read')] }, async (req) => {
    const tenantId = req.scope();
    const { q } = req.query as { q?: string };
    return prisma.vehicleBrand.findMany({
      where: {
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true, logoFile: true, tenantId: true, _count: { select: { models: true } } },
    });
  });

  // GET /api/catalog/brands/:id/models
  app.get('/brands/:id/models', { preHandler: [app.authorize('catalog:read')] }, async (req) => {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.scope();
    const { q } = req.query as { q?: string };
    return prisma.vehicleModel.findMany({
      where: {
        brandId: id,
        isActive: true,
        OR: [{ tenantId: null }, { tenantId }],
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, bodyType: true, yearFrom: true, yearTo: true, tenantId: true },
    });
  });

  // POST /api/catalog/brands — alta propia del taller
  app.post('/brands', { preHandler: [app.authorize('catalog:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createBrandSchema.parse(req.body);
    const slug = slugify(data.name);

    const existing = await prisma.vehicleBrand.findFirst({
      where: { slug, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (existing) return existing;

    try {
      reply.code(201);
      return await prisma.vehicleBrand.create({
        data: { tenantId, slug, name: data.name, logoFile: data.logoFile, country: data.country, source: 'manual' },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('La marca ya existe');
      throw e;
    }
  });

  // POST /api/catalog/models
  app.post('/models', { preHandler: [app.authorize('catalog:write')] }, async (req, reply) => {
    const tenantId = req.scope();
    const data = createModelSchema.parse(req.body);

    const brand = await prisma.vehicleBrand.findFirst({
      where: { id: data.brandId, OR: [{ tenantId: null }, { tenantId }] },
      select: { id: true },
    });
    if (!brand) throw notFound('Marca no encontrada');

    const existing = await prisma.vehicleModel.findFirst({
      where: { brandId: data.brandId, name: { equals: data.name, mode: 'insensitive' }, OR: [{ tenantId: null }, { tenantId }] },
    });
    if (existing) return existing;

    reply.code(201);
    return prisma.vehicleModel.create({ data: { ...data, tenantId, source: 'manual' } });
  });

  // GET /api/catalog/search?q=  — búsqueda transversal para el autocompletar
  app.get('/search', { preHandler: [app.authorize('catalog:read')] }, async (req) => {
    const tenantId = req.scope();
    const { q } = req.query as { q?: string };
    if (!q || q.length < 2) return [];
    const models = await prisma.vehicleModel.findMany({
      where: { isActive: true, name: { contains: q, mode: 'insensitive' }, OR: [{ tenantId: null }, { tenantId }] },
      take: 25,
      orderBy: { name: 'asc' },
      include: { brand: { select: { id: true, name: true, logoFile: true } } },
    });
    return models.map((m) => ({
      modelId: m.id, model: m.name,
      brandId: m.brand.id, brand: m.brand.name, logoFile: m.brand.logoFile,
    }));
  });
}
