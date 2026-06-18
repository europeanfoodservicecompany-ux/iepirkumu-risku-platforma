import type { Lot, RiskResult, EngineContext } from '../types.ts';
import { BaseTenderRiskRule, riskFound, riskNotFound, noData, clamp } from '../base.ts';

// Indikators E — Procedūras integritāte.
// Pieejamais signāls: sarunu procedūra BEZ iepriekšējas konkurences izsludināšanas (neg-wo-call).
// Tā apiet atklātu konkurenci; valstī tā ir reta, tāpēc augsts īpatsvars pie viena pasūtītāja
// ir integritātes signāls. E ir papildinošs slānis (zems svars) un spēcīgs kombinācijā ar citiem.
export class IndicatorE extends BaseTenderRiskRule {
  override identifier = 'E';
  override name = 'Procedūras integritāte';
  override layer = 'E';
  override legalBasis = 'PIL atklātības princips';
  override procedureTypes = null;

  // Lot līmenis: ne-konkurences procedūra → dzeltens; + viens pretendents → sarkans (kombinācija).
  override processLot(lot: Lot, ctx: EngineContext): RiskResult {
    const base = { lotId: lot.id, detail: { procedureType: lot.procedureType, sourceUrl: lot.sourceUrl } };
    if (!lot.winnerChosen) return riskNotFound('E', 'lot', lot.buyerId, null, base);
    if (lot.procedureType && ctx.e.nonCompetitiveTypes.includes(lot.procedureType)) {
      const level = lot.receivedBids === 1 ? 'red' : 'yellow';
      return riskFound('E', 'lot', lot.buyerId, level, null, base);
    }
    return riskNotFound('E', 'lot', lot.buyerId, null, base);
  }

  override processBuyer(buyerId: string, lots: Lot[], ctx: EngineContext): RiskResult {
    const buyerName = lots.find((l) => l.buyerName)?.buyerName ?? null;
    const awarded = lots.filter((l) => l.winnerChosen);
    if (awarded.length < ctx.e.minSample) {
      return noData('E', 'buyer', buyerId, { detail: { buyerName, awardedLots: awarded.length, reason: 'nepietiek datu' } });
    }
    const nonComp = awarded.filter((l) => l.procedureType && ctx.e.nonCompetitiveTypes.includes(l.procedureType));
    const share = nonComp.length / awarded.length;
    const flaggedLotIds = nonComp.map((l) => l.id);
    const detail = {
      buyerName, awardedLots: awarded.length, nonCompetitiveLots: nonComp.length,
      nonCompetitiveShare: round(share, 3), flaggedLotIds,
    };

    if (share < ctx.e.yellowShare) return riskNotFound('E', 'buyer', buyerId, 0, { detail });
    // score saskaņots ar sliekšņiem: yellowShare→30, redShare→70.
    const slope = (70 - 30) / (ctx.e.redShare - ctx.e.yellowShare);
    const score = Math.round(clamp(30 + (share - ctx.e.yellowShare) * slope, 0, 100));
    const level = share >= ctx.e.redShare ? 'red' : 'yellow';
    return riskFound('E', 'buyer', buyerId, level, score, { detail });
  }
}

function round(x: number, dp: number): number { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
