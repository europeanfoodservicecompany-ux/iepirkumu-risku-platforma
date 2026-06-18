import type { Lot, RiskResult, EngineContext } from '../types.ts';
import { BaseTenderRiskRule, riskFound, riskNotFound, noData, clamp } from '../base.ts';

// Indikators D — Saistītās puses / jauni uzvarētāji.
// Pieejamais signāls (no Uzņēmumu reģistra atvērtajiem datiem): uzvarētājs, kas reģistrēts īsi
// PIRMS līguma iegūšanas. Nesen dibināts uzņēmums, kas uzreiz iegūst publisku līgumu, ir klasisks
// saistīto pušu / fiktīva pretendenta riska signāls. (Īpašnieku pārklāšanās — nākotnes paplašinājums.)
export class IndicatorD extends BaseTenderRiskRule {
  override identifier = 'D';
  override name = 'Saistītās puses (jauni uzvarētāji)';
  override layer = 'D';
  override legalBasis = 'Interešu konflikta un negodprātīgas rīcības novēršana';
  override procedureTypes = null;

  override processBuyer(buyerId: string, lots: Lot[], ctx: EngineContext): RiskResult {
    const buyerName = lots.find((l) => l.buyerName)?.buyerName ?? null;
    type Flag = { lotId: string; winnerId: string; winnerName: string | null; registered: string; ageMonths: number; value: number | null; veryNew: boolean; sourceUrl: string | null };
    const evaluable: string[] = [];
    const flags: Flag[] = [];

    for (const l of lots) {
      if (!l.winnerChosen || !l.winnerId || !l.noticeDate) continue;
      const info = ctx.companyReg.get(l.winnerId);
      if (!info || !info.registered) continue;
      const award = Date.parse(l.noticeDate);
      const reg = Date.parse(info.registered);
      if (Number.isNaN(award) || Number.isNaN(reg)) continue;
      evaluable.push(l.id);
      const ageMonths = (award - reg) / (30.44 * 86400000);
      if (ageMonths >= 0 && ageMonths < ctx.d.newCompanyMonths) {
        flags.push({
          lotId: l.id, winnerId: l.winnerId, winnerName: l.winnerName ?? null,
          registered: info.registered, ageMonths: Math.round(ageMonths * 10) / 10,
          value: l.awardValue ?? null, veryNew: ageMonths < ctx.d.veryNewMonths, sourceUrl: l.sourceUrl ?? null,
        });
      }
    }

    if (evaluable.length < ctx.d.minAwards) {
      return noData('D', 'buyer', buyerId, { detail: { buyerName, evaluableAwards: evaluable.length, reason: 'nepietiek datu ar uzvarētāja reģ. datumu' } });
    }

    flags.sort((a, b) => a.ageMonths - b.ageMonths);
    const veryNew = flags.filter((f) => f.veryNew).length;
    const detail = { buyerName, evaluableAwards: evaluable.length, newWinnerAwards: flags.length, veryNewAwards: veryNew, newWinners: flags.slice(0, 25) };

    if (flags.length === 0) return riskNotFound('D', 'buyer', buyerId, 0, { detail });

    let score = 40;                       // vismaz viens jauns uzvarētājs
    if (flags.length >= 2) score += 15;
    if (flags.length >= 3) score += 15;
    if (veryNew >= 1) score = Math.max(score, 70);  // ļoti jauns uzņēmums → sarkans
    score = Math.round(clamp(score, 0, 100));
    const level = score >= 70 || veryNew >= 1 ? 'red' : 'yellow';
    return riskFound('D', 'buyer', buyerId, level, score, { detail });
  }
}
