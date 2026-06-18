import type { Lot, RiskResult, EngineContext } from '../types.ts';
import { BaseTenderRiskRule, riskFound, riskNotFound, noData, clamp } from '../base.ts';

// Indikators B2 — Uzvarētāju koncentrācija.
// Slānis B (konkurences trūkums). Mēra, cik koncentrēti pasūtītāja piešķirtie līgumi nonāk
// pie nedaudziem uzvarētājiem: top uzvarētāja daļa + Herfindāla–Hiršmana indekss (HHI).
// Augsta koncentrācija var liecināt par "iecienītu" piegādātāju vai vāju reālu konkurenci.
export class IndicatorB2 extends BaseTenderRiskRule {
  override identifier = 'B2';
  override name = 'Uzvarētāju koncentrācija';
  override layer = 'B';
  override legalBasis = 'PIL konkurences princips';
  override procedureTypes = null; // visi procedūru tipi (koncentrācija ir relevanta visur)

  override processBuyer(buyerId: string, lots: Lot[], ctx: EngineContext): RiskResult {
    const awarded = lots.filter((l) => l.winnerChosen === true && l.winnerId);
    const buyerName = lots.find((l) => l.buyerName)?.buyerName ?? null;
    const detailBase = { buyerName, awardedLots: awarded.length };

    if (awarded.length < ctx.b2.minSample) {
      return noData('B2', 'buyer', buyerId, { detail: { ...detailBase, reason: 'nepietiek datu (< min_sample)' } });
    }

    // Agregē pa uzvarētājiem: pēc vērtības, ja pieejama; citādi pēc skaita.
    const totalValue = awarded.reduce((s, l) => s + (l.awardValue ?? 0), 0);
    const byValue = totalValue > 0;
    const weights = new Map<string, number>();
    const names = new Map<string, string>();
    for (const l of awarded) {
      const w = byValue ? (l.awardValue ?? 0) : 1;
      weights.set(l.winnerId!, (weights.get(l.winnerId!) ?? 0) + w);
      if (l.winnerName && !names.has(l.winnerId!)) names.set(l.winnerId!, l.winnerName);
    }
    const total = byValue ? totalValue : awarded.length;
    let hhi = 0; let topShare = 0; let topWinner = '';
    for (const [wid, w] of weights) {
      const share = w / total;
      hhi += share * share;
      if (share > topShare) { topShare = share; topWinner = wid; }
    }

    // Score saskaņots ar krāsu joslām: yellowHhi→30, redHhi→70.
    const slope = (70 - 30) / (ctx.b2.redHhi - ctx.b2.yellowHhi);
    const score = Math.round(clamp(30 + (hhi - ctx.b2.yellowHhi) * slope, 0, 100));

    const detail = {
      ...detailBase,
      basis: byValue ? 'value' : 'count',
      distinctWinners: weights.size,
      hhi: round(hhi, 3),
      topWinnerShare: round(topShare, 3),
      topWinnerId: topWinner,
      topWinnerName: names.get(topWinner) ?? null,
      totalAwardValue: byValue ? round(totalValue, 2) : null,
    };

    // Sarkans: izteikta koncentrācija (HHI vai top daļa). Dzeltens: mērena. Kombinētais princips.
    if (hhi >= ctx.b2.redHhi || topShare >= ctx.b2.redTopShare) {
      return riskFound('B2', 'buyer', buyerId, 'red', Math.max(score, 70), { detail });
    }
    if (hhi >= ctx.b2.yellowHhi || topShare >= ctx.b2.yellowTopShare) {
      return riskFound('B2', 'buyer', buyerId, 'yellow', Math.max(score, 30), { detail });
    }
    return riskNotFound('B2', 'buyer', buyerId, score, { detail });
  }
}

function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
