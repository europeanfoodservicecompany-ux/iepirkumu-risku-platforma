import type { Lot, RiskResult, EngineContext } from './types.ts';

// Bāzes klase visiem indikatoriem (DOZORRO prozorro-risks paraugs).
// Katrs indikators manto šo klasi un definē process_lot loģiku.
// Pievienojot to reģistram, dzinējs to automātiski pielieto visiem iepirkumiem.
export class BaseTenderRiskRule {
  identifier: string = 'BASE';
  name: string = '';
  layer: string = '';          // 'A'..'E'
  legalBasis: string = '';
  // Procedūru tipi, uz kuriem indikators attiecas (null = visi).
  procedureTypes: Set<string> | null = null;
  minSample: number = 10;

  appliesTo(lot: Lot): boolean {
    if (this.procedureTypes === null) return true;
    if (!lot.procedureType) return true;
    return this.procedureTypes.has(lot.procedureType);
  }

  // Iepirkuma (lot) līmeņa novērtējums. Pēc noklusējuma — nav (der tikai-agregāta indikatoriem).
  processLot(lot: Lot, _ctx: EngineContext): RiskResult {
    return notApplicable(this.identifier, 'lot', lot.buyerId, { lotId: lot.id });
  }

  // Pasūtītāja (agregāts) līmeņa novērtējums. Pēc noklusējuma — nav.
  processBuyer(_buyerId: string, _lots: Lot[], _ctx: EngineContext): RiskResult | null {
    return null;
  }
}

// Palīgfunkcijas standartizētiem rezultātiem.
export function riskFound(
  indicator: string, scope: 'lot' | 'buyer', buyerId: string,
  level: 'yellow' | 'red', score: number | null,
  extra: Partial<RiskResult> = {},
): RiskResult {
  return { indicator, scope, buyerId, status: 'RiskFound', level, score, ...extra };
}
export function riskNotFound(
  indicator: string, scope: 'lot' | 'buyer', buyerId: string,
  score: number | null = null, extra: Partial<RiskResult> = {},
): RiskResult {
  return { indicator, scope, buyerId, status: 'RiskNotFound', level: null, score, ...extra };
}
export function noData(
  indicator: string, scope: 'lot' | 'buyer', buyerId: string,
  extra: Partial<RiskResult> = {},
): RiskResult {
  return { indicator, scope, buyerId, status: 'NoData', level: null, score: null, ...extra };
}
export function notApplicable(
  indicator: string, scope: 'lot' | 'buyer', buyerId: string,
  extra: Partial<RiskResult> = {},
): RiskResult {
  return { indicator, scope, buyerId, status: 'NotApplicable', level: null, score: null, ...extra };
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
