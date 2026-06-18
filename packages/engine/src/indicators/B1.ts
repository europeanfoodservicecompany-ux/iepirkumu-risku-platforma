import type { Lot, RiskResult, EngineContext } from '../types.ts';
import {
  BaseTenderRiskRule, riskFound, riskNotFound, noData, notApplicable, clamp,
} from '../base.ts';

// ── Iepirkuma līmeņa pamatloģika (B1 specifikācija 4.1) ──
// is_single_bid(lot) := (received_bids == 1) AND (winner_chosen)
export function isSingleBid(lot: Lot): boolean {
  return lot.winnerChosen === true && lot.receivedBids === 1;
}

// Indikators B1 — Viena pretendenta īpatsvars.
// Slānis B (konkurences trūkums). Starptautiski visplašāk validētais korupcijas riska proxy.
export class IndicatorB1 extends BaseTenderRiskRule {
  override identifier = 'B1';
  override name = 'Viena pretendenta īpatsvars';
  override layer = 'B';
  override legalBasis = 'PIL konkurences princips';
  // Atklāta/slēgta procedūra — kur konkurence ir gaidāma (Opentender/Fazekas pieeja).
  override procedureTypes = new Set<string>(['open', 'restricted']);

  // ── Iepirkuma līmeņa karogs (B1 spec 4.1 / 5.1) ──
  override processLot(lot: Lot, _ctx: EngineContext): RiskResult {
    const base = { lotId: lot.id, detail: { receivedBids: lot.receivedBids, sourceUrl: lot.sourceUrl } };
    // Atcelts / bez uzvarētāja → neskaita saucējā (NotApplicable).
    if (lot.winnerChosen === false) {
      return notApplicable('B1', 'lot', lot.buyerId, base);
    }
    // BT-760 trūkst → NoData (NEdrīkst pielīdzināt "nav riska").
    if (lot.receivedBids === null || lot.receivedBids === undefined) {
      return noData('B1', 'lot', lot.buyerId, base);
    }
    // Tieši viens piedāvājums → dzeltens karogs.
    // Sarkans iedegas tikai KOMBINĀCIJĀ ar citu signālu (cena tuvu max / atkārtots uzvarētājs) —
    // to pievieno vēlāk, kad strādā A/C/E slāņi. Atsevišķs viens pretendents = dzeltens.
    if (lot.receivedBids === 1) {
      return riskFound('B1', 'lot', lot.buyerId, 'yellow', null, base);
    }
    return riskNotFound('B1', 'lot', lot.buyerId, null, base);
  }

  // ── Pasūtītāja agregāts (B1 spec 4.2 / 4.3 / 5.2) ──
  override processBuyer(buyerId: string, lots: Lot[], ctx: EngineContext): RiskResult {
    const applicable = lots.filter((l) => this.appliesTo(l) && l.winnerChosen === true);
    const winnerChosenCount = applicable.length;
    const singleBidCount = applicable.filter(isSingleBid).length;
    const buyerName = lots.find((l) => l.buyerName)?.buyerName ?? null;

    const detailBase = {
      buyerName,
      winnerChosenLots: winnerChosenCount,
      singleBidLots: singleBidCount,
      nationalAvg: round(ctx.nationalAvg, 4),
      flaggedLotIds: applicable.filter(isSingleBid).map((l) => l.id),
    };

    // Minimālā parauga prasība (spec 4.3): ja par maz datu → "nepietiek datu".
    if (winnerChosenCount < ctx.b1.minSample) {
      return noData('B1', 'buyer', buyerId, { detail: { ...detailBase, reason: 'nepietiek datu (< min_sample)' } });
    }

    const singleBidRate = singleBidCount / winnerChosenCount;
    const ratio = ctx.nationalAvg > 0 ? singleBidRate / ctx.nationalAvg : 0;
    const score = Math.round(clamp((ratio - 1.0) * ctx.b1.scoreSlope, 0, 100));

    const detail = {
      ...detailBase,
      singleBidRate: round(singleBidRate, 4),
      relativeRatio: round(ratio, 3),
    };

    // Krāsa pēc relatīvās attiecības pret nacionālo bāzi (spec 5.2 tabula; konfigurējami sliekšņi).
    if (ratio >= ctx.b1.buyerRedRatio) {
      return riskFound('B1', 'buyer', buyerId, 'red', score, { detail });
    }
    if (ratio >= ctx.b1.buyerYellowRatio) {
      return riskFound('B1', 'buyer', buyerId, 'yellow', score, { detail });
    }
    return riskNotFound('B1', 'buyer', buyerId, score, { detail });
  }
}

function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
