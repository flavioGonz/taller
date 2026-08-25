/** Redondeo monetario a 2 decimales evitando errores de coma flotante. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineLike {
  quantity: number | string;
  unitPrice: number | string;
  discountPct?: number | string;
  taxPct?: number | string;
}

export interface LineTotals {
  gross: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
}

export function computeLine(line: LineLike): LineTotals {
  const qty = Number(line.quantity ?? 0);
  const price = Number(line.unitPrice ?? 0);
  const discPct = Number(line.discountPct ?? 0);
  const taxPct = Number(line.taxPct ?? 0);

  const gross = round2(qty * price);
  const discount = round2(gross * (discPct / 100));
  const net = round2(gross - discount);
  const tax = round2(net * (taxPct / 100));
  return { gross, discount, net, tax, total: round2(net + tax) };
}

export interface OrderTotals {
  laborTotal: number;
  partsTotal: number;
  discountTotal: number;
  taxTotal: number;
  subtotal: number;
  grandTotal: number;
}

export function computeTotals(
  lines: (LineLike & { kind?: string })[],
): OrderTotals {
  let laborTotal = 0, partsTotal = 0, discountTotal = 0, taxTotal = 0, subtotal = 0;
  for (const line of lines) {
    const t = computeLine(line);
    subtotal = round2(subtotal + t.net);
    discountTotal = round2(discountTotal + t.discount);
    taxTotal = round2(taxTotal + t.tax);
    if (line.kind === 'REPUESTO') partsTotal = round2(partsTotal + t.net);
    else laborTotal = round2(laborTotal + t.net);
  }
  return { laborTotal, partsTotal, discountTotal, taxTotal, subtotal, grandTotal: round2(subtotal + taxTotal) };
}

export function formatMoney(value: number | string, currency = 'UYU', locale = 'es-UY'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value ?? 0));
}
