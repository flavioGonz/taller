import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from './prisma.js';
import { fileToDataUrl } from './files.js';
import { notFound } from './errors.js';
import { QuoteDocument, type QuotePdfData } from '../pdf/quote-document.js';

const displayName = (c: {
  isCompany: boolean; firstName?: string | null; lastName?: string | null; companyName?: string | null;
}) => (c.isCompany ? (c.companyName ?? '—') : [c.firstName, c.lastName].filter(Boolean).join(' ') || '—');

/** Arma el PDF del presupuesto con todo lo que hace falta explicarle al cliente. */
export async function buildQuotePdf(quoteId: string, tenantId: string): Promise<{ buffer: Buffer; filename: string; data: QuotePdfData }> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, tenantId },
    include: {
      items: { orderBy: { position: 'asc' } },
      workOrder: {
        include: {
          customer: true,
          vehicle: true,
          inspections: { where: { kind: 'INGRESO' }, include: { damages: true } },
          insuranceCase: { include: { insurer: { select: { name: true } } } },
        },
      },
    },
  });
  if (!quote) throw notFound('Presupuesto no encontrado');

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const wo = quote.workOrder;

  const [logoDataUrl, photoDataUrl] = await Promise.all([
    fileToDataUrl(tenant.logoUrl),
    fileToDataUrl(wo.vehicle.photoUrl),
  ]);

  const data: QuotePdfData = {
    tenant: {
      name: tenant.name,
      legalName: tenant.legalName,
      taxId: tenant.taxId,
      address: tenant.address,
      city: tenant.city,
      phone: tenant.phone,
      email: tenant.email,
      logoDataUrl,
    },
    quote: {
      number: quote.number,
      version: quote.version,
      issueDate: quote.createdAt,
      validUntil: quote.validUntil,
      currency: quote.currency,
      summary: quote.summary,
      notes: quote.notes,
      terms: quote.terms,
      estimatedDays: quote.estimatedDays,
      warrantyDays: quote.warrantyDays,
      subtotal: Number(quote.subtotal),
      taxTotal: Number(quote.taxTotal),
      total: Number(quote.total),
    },
    customer: {
      name: displayName(wo.customer),
      docNumber: wo.customer.docNumber,
      phone: wo.customer.phone,
      email: wo.customer.email,
      address: [wo.customer.address, wo.customer.city].filter(Boolean).join(', ') || null,
    },
    vehicle: {
      plate: wo.vehicle.plate,
      brand: wo.vehicle.brand,
      model: wo.vehicle.model,
      year: wo.vehicle.year,
      color: wo.vehicle.color,
      vin: wo.vehicle.vin,
      mileage: wo.vehicle.mileage,
      photoDataUrl,
    },
    workOrder: {
      number: wo.number,
      auditId: wo.auditId,
      complaint: wo.complaint,
      diagnosis: wo.diagnosis,
      receivedAt: wo.receivedAt,
    },
    items: quote.items.map((i) => ({
      kind: i.kind,
      description: i.description,
      detail: i.detail,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discountPct: Number(i.discountPct),
      taxPct: Number(i.taxPct),
      total: Number(i.total),
      optional: i.optional,
      urgent: i.urgent,
    })),
    damages: (wo.inspections[0]?.damages ?? []).map((d) => ({
      partCode: d.partCode,
      type: d.type,
      severity: d.severity,
      note: d.note,
    })),
    insurer: wo.insuranceCase
      ? {
          name: wo.insuranceCase.insurer.name,
          claimNumber: wo.insuranceCase.claimNumber,
          policyNumber: wo.insuranceCase.policyNumber,
          deductible: wo.insuranceCase.deductible ? Number(wo.insuranceCase.deductible) : null,
        }
      : null,
  };

  const buffer = await renderToBuffer(QuoteDocument({ data }));
  const filename = `Presupuesto-${quote.number}-v${quote.version}-${wo.vehicle.plate}.pdf`;
  return { buffer, filename, data };
}
