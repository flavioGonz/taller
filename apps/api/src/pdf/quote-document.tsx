import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { formatMoney, partLabel, DAMAGE_TYPE_LABELS, SEVERITY_LABELS } from '@taller/shared';

/* -------------------------------------------------------------- tipos */

export interface QuotePdfData {
  tenant: {
    name: string; legalName?: string | null; taxId?: string | null;
    address?: string | null; city?: string | null; phone?: string | null; email?: string | null;
    logoDataUrl?: string | null;
  };
  quote: {
    number: string; version: number; issueDate: Date; validUntil?: Date | null;
    currency: string; summary?: string | null; notes?: string | null; terms?: string | null;
    estimatedDays?: number | null; warrantyDays?: number | null;
    subtotal: number; taxTotal: number; total: number;
  };
  customer: { name: string; docNumber?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  vehicle: {
    plate: string; brand: string; model: string; year?: number | null; color?: string | null;
    vin?: string | null; mileage?: number | null; photoDataUrl?: string | null;
  };
  workOrder: { number: string; auditId?: string | null; complaint?: string | null; diagnosis?: string | null; receivedAt: Date };
  items: {
    kind: string; description: string; detail?: string | null;
    quantity: number; unitPrice: number; discountPct: number; taxPct: number; total: number;
    optional: boolean; urgent: boolean;
  }[];
  damages: { partCode: string; type: string; severity: string; note?: string | null }[];
  insurer?: { name: string; claimNumber?: string | null; policyNumber?: string | null; deductible?: number | null } | null;
}

/* ------------------------------------------------------------- estilos */

const BRAND = '#1d4ed8';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 56, paddingHorizontal: 38, fontSize: 9.5, color: INK, fontFamily: 'Helvetica' },

  // portada
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  logoBox: { width: 46, height: 46, borderRadius: 12, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  logoImg: { width: 46, height: 46, borderRadius: 12, objectFit: 'contain' },
  logoText: { color: '#fff', fontSize: 20, fontFamily: 'Helvetica-Bold' },
  shopName: { fontSize: 15, fontFamily: 'Helvetica-Bold', letterSpacing: -0.3 },
  shopMeta: { fontSize: 8, color: MUTED, marginTop: 1 },

  docTag: { alignItems: 'flex-end' },
  docTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BRAND, letterSpacing: 1.4 },
  docNumber: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  docMeta: { fontSize: 8, color: MUTED, marginTop: 2 },

  rule: { height: 3, backgroundColor: BRAND, borderRadius: 2, marginBottom: 16 },

  cols: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  card: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 11 },
  cardTitle: { fontSize: 7.5, color: MUTED, letterSpacing: 1, fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  strong: { fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  line: { fontSize: 8.5, color: MUTED, marginTop: 1.5 },

  plate: {
    borderWidth: 1.4, borderColor: INK, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 1.5, alignSelf: 'flex-start', marginBottom: 4,
  },
  vehiclePhoto: { width: '100%', height: 74, borderRadius: 6, objectFit: 'cover', marginBottom: 6 },

  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, marginBottom: 6, marginTop: 4 },
  summaryBox: { backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: BRAND, borderRadius: 5, padding: 11, marginBottom: 14 },
  summaryText: { fontSize: 9.5, lineHeight: 1.5 },

  damageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2.5 },
  dot: { width: 5, height: 5, borderRadius: 3, marginRight: 6 },

  // tabla
  th: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderTopLeftRadius: 5, borderTopRightRadius: 5, paddingVertical: 6, paddingHorizontal: 8 },
  thText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.8 },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: LINE },
  cDesc: { flex: 1 },
  cQty: { width: 42, textAlign: 'right' },
  cPrice: { width: 74, textAlign: 'right' },
  cTotal: { width: 78, textAlign: 'right' },
  itemName: { fontSize: 9.5 },
  itemDetail: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  tag: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3, marginLeft: 4 },

  totalsWrap: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totals: { width: 230 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: BRAND, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 10, marginTop: 5 },
  grandText: { color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 12 },

  infoGrid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  infoCard: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 10 },
  infoIcon: { fontSize: 8, color: BRAND, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  infoValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  infoHint: { fontSize: 7.5, color: MUTED, marginTop: 2, lineHeight: 1.4 },

  signRow: { flexDirection: 'row', gap: 24, marginTop: 26 },
  signBox: { flex: 1, borderTopWidth: 1, borderTopColor: INK, paddingTop: 5 },
  signLabel: { fontSize: 7.5, color: MUTED },

  footer: {
    position: 'absolute', bottom: 24, left: 38, right: 38,
    borderTopWidth: 1, borderTopColor: LINE, paddingTop: 7,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: MUTED },
});

const fmt = (d?: Date | null) =>
  d ? new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : '—';

const SEV_COLOR: Record<string, string> = { LEVE: '#eab308', MODERADO: '#f97316', GRAVE: '#ef4444' };

/* ----------------------------------------------------------- documento */

export function QuoteDocument({ data }: { data: QuotePdfData }) {
  const { tenant, quote, customer, vehicle, workOrder, items, damages, insurer } = data;
  const money = (n: number) => formatMoney(n, quote.currency);

  const parts = items.filter((i) => i.kind === 'REPUESTO');
  const labor = items.filter((i) => i.kind !== 'REPUESTO');
  const sum = (list: typeof items) => list.reduce((a, i) => a + i.total, 0);

  return (
    <Document
      title={`Presupuesto ${quote.number} v${quote.version}`}
      author={tenant.name}
      subject={`Presupuesto para ${vehicle.plate}`}
    >
      <Page size="A4" style={s.page} wrap>
        {/* --------------------------------------------------- cabecera */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {tenant.logoDataUrl ? (
              <Image src={tenant.logoDataUrl} style={s.logoImg} />
            ) : (
              <View style={s.logoBox}><Text style={s.logoText}>{tenant.name.charAt(0)}</Text></View>
            )}
            <View>
              <Text style={s.shopName}>{tenant.name}</Text>
              {tenant.legalName ? <Text style={s.shopMeta}>{tenant.legalName}{tenant.taxId ? ` · RUT ${tenant.taxId}` : ''}</Text> : null}
              {tenant.address ? <Text style={s.shopMeta}>{tenant.address}{tenant.city ? `, ${tenant.city}` : ''}</Text> : null}
              <Text style={s.shopMeta}>{[tenant.phone, tenant.email].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>

          <View style={s.docTag}>
            <Text style={s.docTitle}>PRESUPUESTO</Text>
            <Text style={s.docNumber}>{quote.number}</Text>
            <Text style={s.docMeta}>Versión {quote.version} · {fmt(quote.issueDate)}</Text>
            <Text style={s.docMeta}>OT {workOrder.number}</Text>
            {workOrder.auditId ? <Text style={s.docMeta}>Auditoría {workOrder.auditId}</Text> : null}
            {quote.validUntil ? <Text style={s.docMeta}>Válido hasta {fmt(quote.validUntil)}</Text> : null}
          </View>
        </View>
        <View style={s.rule} />

        {/* ------------------------------------------ cliente y vehículo */}
        <View style={s.cols}>
          <View style={s.card}>
            <Text style={s.cardTitle}>CLIENTE</Text>
            <Text style={s.strong}>{customer.name}</Text>
            {customer.docNumber ? <Text style={s.line}>Doc. {customer.docNumber}</Text> : null}
            {customer.phone ? <Text style={s.line}>{customer.phone}</Text> : null}
            {customer.email ? <Text style={s.line}>{customer.email}</Text> : null}
            {customer.address ? <Text style={s.line}>{customer.address}</Text> : null}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>VEHÍCULO</Text>
            {vehicle.photoDataUrl ? <Image src={vehicle.photoDataUrl} style={s.vehiclePhoto} /> : null}
            <Text style={s.plate}>{vehicle.plate}</Text>
            <Text style={s.strong}>{vehicle.brand} {vehicle.model}</Text>
            <Text style={s.line}>{[vehicle.year, vehicle.color].filter(Boolean).join(' · ')}</Text>
            {vehicle.vin ? <Text style={s.line}>VIN {vehicle.vin}</Text> : null}
            {vehicle.mileage ? <Text style={s.line}>{vehicle.mileage.toLocaleString('es-UY')} km</Text> : null}
          </View>
        </View>

        {insurer ? (
          <View style={[s.card, { marginBottom: 14 }]}>
            <Text style={s.cardTitle}>SINIESTRO</Text>
            <Text style={s.strong}>{insurer.name}</Text>
            <Text style={s.line}>
              {[insurer.claimNumber && `Denuncia ${insurer.claimNumber}`, insurer.policyNumber && `Póliza ${insurer.policyNumber}`]
                .filter(Boolean).join(' · ')}
            </Text>
            {insurer.deductible ? <Text style={s.line}>Franquicia a cargo del cliente: {money(insurer.deductible)}</Text> : null}
          </View>
        ) : null}

        {/* ------------------------------------------ descripción de la rotura */}
        <Text style={s.sectionTitle}>QUÉ TIENE EL VEHÍCULO</Text>
        <View style={s.summaryBox} wrap={false}>
          <Text style={s.summaryText}>
            {quote.summary || workOrder.diagnosis || workOrder.complaint || 'Sin descripción cargada.'}
          </Text>
          {damages.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={[s.cardTitle, { marginBottom: 4 }]}>DAÑOS RELEVADOS AL INGRESAR</Text>
              {damages.slice(0, 8).map((d, i) => (
                <View key={i} style={s.damageRow}>
                  <View style={[s.dot, { backgroundColor: SEV_COLOR[d.severity] ?? MUTED }]} />
                  <Text style={{ fontSize: 8.5 }}>
                    {partLabel(d.partCode)} — {DAMAGE_TYPE_LABELS[d.type as keyof typeof DAMAGE_TYPE_LABELS] ?? d.type}
                    {' '}({SEVERITY_LABELS[d.severity as keyof typeof SEVERITY_LABELS] ?? d.severity})
                    {d.note ? `. ${d.note}` : ''}
                  </Text>
                </View>
              ))}
              {damages.length > 8 ? <Text style={s.line}>y {damages.length - 8} más — ver informe de recepción.</Text> : null}
            </View>
          ) : null}
        </View>

        {/* -------------------------------------------------- mano de obra */}
        {labor.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>MANO DE OBRA Y SERVICIOS</Text>
            <ItemTable items={labor} money={money} />
          </>
        ) : null}

        {/* ----------------------------------------------------- repuestos */}
        {parts.length > 0 ? (
          <>
            <Text style={[s.sectionTitle, { marginTop: 12 }]}>REPUESTOS</Text>
            <ItemTable items={parts} money={money} />
          </>
        ) : null}

        {/* -------------------------------------------------------- totales */}
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            {labor.length > 0 ? (
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>Mano de obra y servicios</Text>
                <Text>{money(sum(labor))}</Text>
              </View>
            ) : null}
            {parts.length > 0 ? (
              <View style={s.totalRow}>
                <Text style={{ color: MUTED }}>Repuestos</Text>
                <Text>{money(sum(parts))}</Text>
              </View>
            ) : null}
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>Subtotal sin IVA</Text>
              <Text>{money(quote.subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={{ color: MUTED }}>IVA</Text>
              <Text>{money(quote.taxTotal)}</Text>
            </View>
            <View style={s.grand}>
              <Text style={s.grandText}>TOTAL</Text>
              <Text style={s.grandText}>{money(quote.total)}</Text>
            </View>
          </View>
        </View>

        {/* ------------------------------------------ entrega y garantía */}
        <View style={s.infoGrid} wrap={false}>
          <View style={s.infoCard}>
            <Text style={s.infoIcon}>TIEMPO DE ENTREGA</Text>
            <Text style={s.infoValue}>
              {quote.estimatedDays ? `${quote.estimatedDays} día${quote.estimatedDays === 1 ? '' : 's'} hábiles` : 'A confirmar'}
            </Text>
            <Text style={s.infoHint}>
              Se cuenta desde la aprobación del presupuesto y la disponibilidad de los repuestos.
            </Text>
          </View>

          <View style={s.infoCard}>
            <Text style={s.infoIcon}>GARANTÍA</Text>
            <Text style={s.infoValue}>
              {quote.warrantyDays ? `${quote.warrantyDays} días` : 'Según fabricante'}
            </Text>
            <Text style={s.infoHint}>
              Cubre la mano de obra y los repuestos instalados por el taller, sobre el trabajo detallado en este presupuesto.
            </Text>
          </View>

          <View style={s.infoCard}>
            <Text style={s.infoIcon}>VALIDEZ</Text>
            <Text style={s.infoValue}>{quote.validUntil ? fmt(quote.validUntil) : '15 días'}</Text>
            <Text style={s.infoHint}>
              Los precios pueden variar por cambios de cotización o disponibilidad de repuestos.
            </Text>
          </View>
        </View>

        {quote.notes || quote.terms ? (
          <View style={{ marginTop: 14 }}>
            {quote.notes ? (
              <>
                <Text style={s.sectionTitle}>OBSERVACIONES</Text>
                <Text style={{ fontSize: 8.5, color: MUTED, lineHeight: 1.5 }}>{quote.notes}</Text>
              </>
            ) : null}
            {quote.terms ? (
              <>
                <Text style={[s.sectionTitle, { marginTop: 8 }]}>CONDICIONES</Text>
                <Text style={{ fontSize: 8, color: MUTED, lineHeight: 1.5 }}>{quote.terms}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={s.signRow} wrap={false}>
          <View style={s.signBox}><Text style={s.signLabel}>Firma del cliente — conforme con el trabajo presupuestado</Text></View>
          <View style={s.signBox}><Text style={s.signLabel}>Por {tenant.name}</Text></View>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{tenant.name} · {quote.number} v{quote.version} · OT {workOrder.number}{workOrder.auditId ? ` · ${workOrder.auditId}` : ''}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function ItemTable({ items, money }: { items: QuotePdfData['items']; money: (n: number) => string }) {
  return (
    <View>
      <View style={s.th}>
        <Text style={[s.thText, s.cDesc]}>DETALLE</Text>
        <Text style={[s.thText, s.cQty]}>CANT.</Text>
        <Text style={[s.thText, s.cPrice]}>UNITARIO</Text>
        <Text style={[s.thText, s.cTotal]}>TOTAL</Text>
      </View>
      {items.map((i, idx) => (
        <View key={idx} style={s.tr} wrap={false}>
          <View style={s.cDesc}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={s.itemName}>{i.description}</Text>
              {i.urgent ? <Text style={[s.tag, { backgroundColor: '#fee2e2', color: '#b91c1c' }]}>SEGURIDAD</Text> : null}
              {i.optional ? <Text style={[s.tag, { backgroundColor: '#f1f5f9', color: MUTED }]}>OPCIONAL</Text> : null}
            </View>
            {i.detail ? <Text style={s.itemDetail}>{i.detail}</Text> : null}
          </View>
          <Text style={s.cQty}>{i.quantity}</Text>
          <Text style={s.cPrice}>{money(i.unitPrice)}</Text>
          <Text style={[s.cTotal, { fontFamily: 'Helvetica-Bold' }]}>{money(i.total)}</Text>
        </View>
      ))}
    </View>
  );
}

export { Font };
