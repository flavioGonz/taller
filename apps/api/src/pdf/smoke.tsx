/* Render de prueba del PDF de presupuesto, sin base de datos. */
import { writeFileSync } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import { QuoteDocument, type QuotePdfData } from './quote-document.js';

const data: QuotePdfData = {
  tenant: {
    name: 'Taller Silver', legalName: 'Silver Automotores S.R.L.', taxId: '21 555 5555 0011',
    address: 'Av. Italia 3456', city: 'Montevideo', phone: '2600 1234', email: 'taller@infratec.com.uy',
    logoDataUrl: null,
  },
  quote: {
    number: 'PRE-000042', version: 2, issueDate: new Date(), validUntil: new Date(Date.now() + 15 * 864e5),
    currency: 'UYU',
    summary: 'Golpe en el guardabarros delantero derecho: el paragolpes quedó desprendido del soporte, el faro tiene una fisura y la puerta roza al abrir. Hay que sacar y pintar el guardabarros, cambiar el faro y alinear la puerta.',
    notes: 'El vehículo queda en el taller desde el lunes.',
    terms: 'Precios en pesos uruguayos, IVA incluido. Los repuestos se piden una vez aprobado el presupuesto.',
    estimatedDays: 5, warrantyDays: 90,
    subtotal: 41500, taxTotal: 9130, total: 50630,
  },
  customer: { name: 'María Fernández', docNumber: '4.123.456-7', phone: '099 123 456', email: 'maria@ejemplo.com', address: 'Bulevar Artigas 1122' },
  vehicle: { plate: 'SAB 1234', brand: 'Volkswagen', model: 'Gol Trend', year: 2019, color: 'Gris plata', vin: '9BWAA05U9KT012345', mileage: 87450, photoDataUrl: null },
  workOrder: { number: 'OT-000128', complaint: 'Choque de frente contra un cordón', diagnosis: 'Daño en frontal derecho sin compromiso de chasis', receivedAt: new Date() },
  items: [
    { kind: 'MANO_OBRA', description: 'Chapa y pintura guardabarros delantero derecho', detail: 'Incluye preparado, fondo y pintura bicapa', quantity: 8, unitPrice: 1200, discountPct: 0, taxPct: 22, total: 11712, optional: false, urgent: false },
    { kind: 'MANO_OBRA', description: 'Alineación y ajuste de puerta delantera derecha', detail: null, quantity: 3, unitPrice: 1200, discountPct: 0, taxPct: 22, total: 4392, optional: false, urgent: false },
    { kind: 'REPUESTO', description: 'Faro delantero derecho original', detail: 'VW OEM 5U0941006', quantity: 1, unitPrice: 18900, discountPct: 5, taxPct: 22, total: 21903, optional: false, urgent: true },
    { kind: 'REPUESTO', description: 'Grilla de paragolpes', detail: null, quantity: 2, unitPrice: 1450, discountPct: 0, taxPct: 22, total: 3538, optional: true, urgent: false },
  ],
  damages: [
    { partCode: 'guardabarros_del_der', type: 'ABOLLADURA', severity: 'GRAVE', note: 'Con pliegue en el borde' },
    { partCode: 'paragolpes_del', type: 'ROTURA', severity: 'MODERADO', note: null },
    { partCode: 'faro_del_der', type: 'RAYON', severity: 'LEVE', note: 'Fisura en el cristal' },
  ],
  insurer: { name: 'BSE — Banco de Seguros del Estado', claimNumber: 'SN-2026-99881', policyNumber: 'POL-4471209', deductible: 12000 },
};

const buf = await renderToBuffer(<QuoteDocument data={data} />);
writeFileSync('/tmp/presupuesto-demo.pdf', buf);
console.log('PDF_OK', buf.length, 'bytes');
