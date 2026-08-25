import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedCatalog } from './seed-catalog.js';
import { backfillVehicleCatalog } from './backfill-catalog.js';
import { seedInsurers } from './seed-insurers.js';
import { newAuditId } from '../src/lib/audit-id.js';

const prisma = new PrismaClient();
const hash = (p: string) => bcrypt.hash(p, 11);

async function main() {
  console.log('🌱 Sembrando Taller Silver…');

  const cat = await seedCatalog(prisma);
  console.log(`   🚗 Catálogo: ${cat.brands} marcas (+${cat.newBrands} nuevas, +${cat.newModels} modelos)`);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'taller-silver' },
    update: {},
    create: {
      slug: 'taller-silver',
      name: 'Taller Silver',
      legalName: 'Taller Silver S.R.L.',
      country: 'UY',
      currency: 'UYU',
      timezone: 'America/Montevideo',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    },
  });

  const pwd = process.env.SEED_PASSWORD ?? 'Silver2026!';

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@tallersilver.uy' } },
    update: {},
    create: {
      tenantId: tenant.id, email: 'admin@tallersilver.uy', passwordHash: await hash(pwd),
      firstName: 'Admin', lastName: 'Taller', role: 'ADMIN_TALLER',
    },
  });
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'recepcion@tallersilver.uy' } },
    update: {},
    create: {
      tenantId: tenant.id, email: 'recepcion@tallersilver.uy', passwordHash: await hash(pwd),
      firstName: 'Sofía', lastName: 'Recepción', role: 'RECEPCIONISTA',
    },
  });
  const tecnico = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'tecnico@tallersilver.uy' } },
    update: {},
    create: {
      tenantId: tenant.id, email: 'tecnico@tallersilver.uy', passwordHash: await hash(pwd),
      firstName: 'Diego', lastName: 'Rodríguez', role: 'TECNICO', specialty: 'Mecánica general', hourlyRate: 900,
    },
  });

  for (const u of [
    { email: 'jefe@tallersilver.uy', firstName: 'Gabriel', lastName: 'Méndez', role: 'JEFE_TALLER' as const, specialty: 'Jefe de taller' },
    { email: 'repuestos@tallersilver.uy', firstName: 'Laura', lastName: 'Bentancor', role: 'REPUESTOS' as const, specialty: null },
    { email: 'caja@tallersilver.uy', firstName: 'Nicolás', lastName: 'Farías', role: 'CAJA' as const, specialty: null },
  ]) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      update: {},
      create: {
        tenantId: tenant.id, email: u.email, passwordHash: await hash(pwd),
        firstName: u.firstName, lastName: u.lastName, role: u.role, specialty: u.specialty,
      },
    });
  }

  await prisma.supplier.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Repuestos del Centro' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Repuestos del Centro', phone: '099887766', email: 'ventas@repuestoscentro.uy' },
  });

  // SUPER_ADMIN global (sin tenant)
  const superEmail = process.env.SUPERADMIN_EMAIL ?? 'super@infratec.com.uy';
  const existingSuper = await prisma.user.findFirst({ where: { email: superEmail, tenantId: null } });
  if (!existingSuper) {
    await prisma.user.create({
      data: {
        tenantId: null, email: superEmail, passwordHash: await hash(process.env.SUPERADMIN_PASSWORD ?? pwd),
        firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN',
      },
    });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Depósito principal' } },
    update: { isDefault: true },
    create: { tenantId: tenant.id, name: 'Depósito principal', isDefault: true },
  });

  for (const name of ['Elevador 1', 'Elevador 2', 'Fosa', 'Alineación']) {
    await prisma.bay.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    });
  }

  const services = [
    { code: 'SRV-001', name: 'Cambio de aceite y filtro', category: 'Mantenimiento', estimatedHours: 0.5, price: 1800 },
    { code: 'SRV-002', name: 'Alineación y balanceo', category: 'Tren delantero', estimatedHours: 1, price: 2500 },
    { code: 'SRV-003', name: 'Cambio de pastillas de freno', category: 'Frenos', estimatedHours: 1.5, price: 3200 },
    { code: 'SRV-004', name: 'Service completo 10.000 km', category: 'Mantenimiento', estimatedHours: 3, price: 7800 },
    { code: 'SRV-005', name: 'Diagnóstico con scanner', category: 'Electrónica', estimatedHours: 1, price: 1500 },
    { code: 'SRV-006', name: 'Cambio de correa de distribución', category: 'Motor', estimatedHours: 5, price: 12500 },
  ];
  for (const s of services) {
    await prisma.serviceCatalog.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: s.code } },
      update: {},
      create: { tenantId: tenant.id, ...s },
    });
  }

  const parts = [
    { sku: 'ACE-5W30', name: 'Aceite sintético 5W30 (1L)', brand: 'Shell', category: 'Lubricantes', cost: 380, price: 620, minStock: 12 },
    { sku: 'FIL-ACE-01', name: 'Filtro de aceite universal', brand: 'Mann', category: 'Filtros', cost: 250, price: 450, minStock: 8 },
    { sku: 'FIL-AIR-01', name: 'Filtro de aire', brand: 'Mann', category: 'Filtros', cost: 310, price: 560, minStock: 6 },
    { sku: 'PAS-FRE-DEL', name: 'Pastillas de freno delanteras', brand: 'Ferodo', category: 'Frenos', cost: 1450, price: 2400, minStock: 4 },
    { sku: 'BAT-12V-60', name: 'Batería 12V 60Ah', brand: 'Willard', category: 'Eléctrico', cost: 4200, price: 6500, minStock: 2 },
    { sku: 'BUJ-NGK-4', name: 'Juego de bujías NGK (x4)', brand: 'NGK', category: 'Encendido', cost: 900, price: 1600, minStock: 5 },
  ];
  for (const p of parts) {
    const part = await prisma.part.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
      update: {},
      create: { tenantId: tenant.id, ...p },
    });
    await prisma.partStock.upsert({
      where: { partId_warehouseId: { partId: part.id, warehouseId: warehouse.id } },
      update: {},
      create: { tenantId: tenant.id, partId: part.id, warehouseId: warehouse.id, quantity: 20 },
    });
  }

  // Cliente + vehículo + OT de ejemplo
  const customer = await prisma.customer.upsert({
    where: { tenantId_docNumber: { tenantId: tenant.id, docNumber: '48123456' } },
    update: {},
    create: {
      tenantId: tenant.id, firstName: 'Martín', lastName: 'Pereyra', docType: 'CI', docNumber: '48123456',
      phone: '099123456', email: 'martin.pereyra@example.com', city: 'Montevideo',
    },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { tenantId_plate: { tenantId: tenant.id, plate: 'SAB1234' } },
    update: {},
    create: {
      tenantId: tenant.id, customerId: customer.id, plate: 'SAB1234', brand: 'Volkswagen', model: 'Gol Trend',
      year: 2018, color: 'Gris', fuel: 'NAFTA', mileage: 84500, vin: '9BWAA45U8JT123456',
    },
  });

  const existing = await prisma.workOrder.findFirst({ where: { tenantId: tenant.id, number: 'OT-2026-00001' } });
  if (!existing) {
    await prisma.counter.upsert({
      where: { tenantId_key_period: { tenantId: tenant.id, key: 'work_order', period: String(new Date().getFullYear()) } },
      update: { value: 1 },
      create: { tenantId: tenant.id, key: 'work_order', period: String(new Date().getFullYear()), value: 1 },
    });
    await prisma.workOrder.create({
      data: {
        tenantId: tenant.id, number: `OT-${new Date().getFullYear()}-00001`, auditId: newAuditId(), customerId: customer.id, vehicleId: vehicle.id,
        technicianId: tecnico.id, status: 'DIAGNOSTICO', priority: 'NORMAL',
        complaint: 'Ruido en tren delantero al pasar lomadas y vibración al frenar.',
        mileageIn: 84500, fuelLevel: 40,
        laborTotal: 2500, partsTotal: 2400, taxTotal: 1078, grandTotal: 5978,
        items: {
          create: [
            { tenantId: tenant.id, kind: 'SERVICIO', description: 'Alineación y balanceo', quantity: 1, unitPrice: 2500, taxPct: 22, total: 3050 },
            { tenantId: tenant.id, kind: 'REPUESTO', description: 'Pastillas de freno delanteras', quantity: 1, unitPrice: 2400, taxPct: 22, total: 2928 },
          ],
        },
        history: { create: [{ tenantId: tenant.id, toStatus: 'RECEPCION', note: 'Ingreso' }, { tenantId: tenant.id, fromStatus: 'RECEPCION', toStatus: 'DIAGNOSTICO' }] },
      },
    });
  }

  const ins = await seedInsurers(prisma, tenant.id);
  console.log(`   🛡️  Aseguradoras: ${ins.total} en el catálogo (+${ins.created} nuevas)`);

  const back = await backfillVehicleCatalog(prisma);
  if (back.linked > 0) console.log(`   🔗 Vehículos vinculados al catálogo: ${back.linked}/${back.checked}`);

  console.log('✅ Listo. Usuarios: admin@tallersilver.uy / recepcion@… / tecnico@… — contraseña:', pwd);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
