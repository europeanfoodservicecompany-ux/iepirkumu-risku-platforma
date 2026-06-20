import type { Lot, RiskResult, EngineContext, CpvStat } from '../types.ts';
import { BaseTenderRiskRule, riskFound, riskNotFound, noData, clamp } from '../base.ts';
import { cpvKey } from '../aggregate.ts';

// Indikators C — Cenu/vērtības novirze.
// Salīdzina pasūtītāja līgumvērtības ar nacionālo sadalījumu tajā pašā CPV kategorijā
// (z-score uz ln(vērtības)). Augsta pozitīva novirze = neparasti augsta vērtība pret līdzīgiem.
//
// SVARĪGA ATRUNA: IUB dati satur līgumu KOPSUMMAS, ne vienības cenas vai daudzumus. Tāpēc šis
// indikators mēra VĒRTĪBAS novirzi, ne tīru pārmaksu — augsta vērtība var nozīmēt vienkārši lielāku
// iepirkumu, ne pārmaksu. Tas ir tikai sākumpunkts izpētei (nepatiesas objektivitātes novēršanai).
export class IndicatorC extends BaseTenderRiskRule {
  override identifier = 'C';
  override name = 'Cenu/vērtības novirze';
  override layer = 'C';
  override legalBasis = 'PIL saimnieciski izdevīgākā piedāvājuma princips';
  override procedureTypes = null;

  // z aprēķins vienam līgumam pret tā CPV grupas nacionālo sadalījumu.
  private zFor(lot: Lot, ctx: EngineContext): { z: number; stat: CpvStat } | null {
    if (!lot.winnerChosen || lot.awardValue == null || lot.awardValue <= 0 || !lot.cpv || lot.dupValue) return null;
    const stat = ctx.cpvStats.get(cpvKey(lot.cpv, ctx.c.cpvDigits));
    if (!stat || stat.std <= 0) return null;
    const z = (Math.log(lot.awardValue) - stat.mean) / stat.std;
    return { z, stat };
  }

  override processBuyer(buyerId: string, lots: Lot[], ctx: EngineContext): RiskResult {
    const buyerName = lots.find((l) => l.buyerName)?.buyerName ?? null;
    const evaluated: { lotId: string; value: number; cpv: string | null; z: number; obs: number; sourceUrl: string | null }[] = [];
    for (const l of lots) {
      const r = this.zFor(l, ctx);
      if (r) evaluated.push({
        lotId: l.id, value: l.awardValue!, cpv: l.cpv ?? null,
        z: round(r.z, 2), obs: r.stat.count, sourceUrl: l.sourceUrl ?? null,
      });
    }
    if (evaluated.length === 0) {
      return noData('C', 'buyer', buyerId, { detail: { buyerName, reason: 'nav salīdzināmu CPV datu' } });
    }

    // Augstas novirzes līgumi (pārsniedz dzelteno z slieksni).
    const flags = evaluated.filter((e) => e.z >= ctx.c.yellowZ).sort((x, y) => y.z - x.z);
    const maxZ = Math.max(...evaluated.map((e) => e.z));
    const detail = { buyerName, evaluatedLots: evaluated.length, maxZ: round(maxZ, 2), priceFlags: flags.slice(0, 25) };

    if (maxZ < ctx.c.yellowZ) {
      return riskNotFound('C', 'buyer', buyerId, 0, { detail });
    }
    // score saskaņots ar z sliekšņiem: yellowZ→30, redZ→70.
    const slope = (70 - 30) / (ctx.c.redZ - ctx.c.yellowZ);
    const score = Math.round(clamp(30 + (maxZ - ctx.c.yellowZ) * slope, 0, 100));
    const level = maxZ >= ctx.c.redZ ? 'red' : 'yellow';
    return riskFound('C', 'buyer', buyerId, level, score, { detail });
  }
}

function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
