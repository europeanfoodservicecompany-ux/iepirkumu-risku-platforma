import type { Lot, RiskResult, EngineContext, Modification } from '../types.ts';
import { BaseTenderRiskRule, riskFound, riskNotFound, noData, clamp } from '../base.ts';

// Indikators G — Līguma grozījumi pēc uzvaras (scope creep).
// Pieejamais signāls (IUB cont-modif paziņojumi): līgumi, kas pēc uzvaras tiek grozīti, īpaši
// par PAPILDU DARBIEM/PIEGĀDĒM (add-wss) vai IZPILDĪTĀJA MAIŅU (mod-repl). Klasiska shēma:
// uzvar ar zemu cenu → vēlāk līgumu uzpūš ar papildu vienošanos. Mēra, cik liela pasūtītāja
// līgumu daļa saņem šādus būtiskus grozījumus (likumīgi grozījumi pastāv — tāpēc tikai īpatsvars,
// nevis katrs grozījums; karogs nav pierādījums).
//
// Datu ierobežojums: grozījuma paziņojumā norādītā vērtība nav uzticams "pieaugums" (lauks atspoguļo
// citu lielumu), tāpēc score balstās uz BŪTISKO grozījumu īpatsvaru, ne uz aprēķinātu % pieaugumu.
export class IndicatorG extends BaseTenderRiskRule {
  override identifier = 'G';
  override name = 'Līguma grozījumi (papildu darbi)';
  override layer = 'G';
  override legalBasis = 'PIL 61. pants — grozījumi pēc līguma noslēgšanas';
  override procedureTypes = null;

  override processBuyer(buyerId: string, lots: Lot[], ctx: EngineContext): RiskResult {
    const buyerName = lots.find((l) => l.buyerName)?.buyerName ?? null;
    const cfg = ctx.g;

    // Saucējs: atšķirīgu līgumu (procedūru) skaits, ko pasūtītājs piešķīris.
    const contracts = new Set<string>();
    for (const l of lots) if (l.winnerChosen && l.procedureId) contracts.add(l.procedureId);
    const contractCount = contracts.size;

    if (contractCount < cfg.minContracts) {
      return noData('G', 'buyer', buyerId, { detail: { buyerName, contracts: contractCount, reason: 'nepietiek līgumu' } });
    }

    const mods = ctx.modifications.get(buyerId) ?? [];
    // Visi grozītie līgumi (pēc procedūras), un būtiski grozītie (papildu darbi / izpildītāja maiņa).
    const modifiedProcs = new Set<string>();
    const substantiveProcs = new Set<string>();
    const byCode: Record<string, number> = {};
    const substantiveList: Modification[] = [];
    for (const m of mods) {
      const code = m.reasonCode ?? '(nav)';
      byCode[code] = (byCode[code] ?? 0) + 1;
      if (m.procedureId) modifiedProcs.add(m.procedureId);
      if (m.reasonCode && cfg.substantiveCodes.includes(m.reasonCode)) {
        if (m.procedureId) substantiveProcs.add(m.procedureId);
        substantiveList.push(m);
      }
    }
    const substantiveCount = substantiveProcs.size;
    const rate = substantiveCount / contractCount;
    substantiveList.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const detail = {
      buyerName,
      contracts: contractCount,
      modifiedContracts: modifiedProcs.size,
      substantiveContracts: substantiveCount,
      substantiveRate: Math.round(rate * 1000) / 1000,
      byReasonCode: byCode,
      modifications: substantiveList.slice(0, 25),
    };

    const score = scoreFromRate(rate, cfg.yellowRate, cfg.redRate);

    // Līmenis ar skaita aizsargu (filtrē 1/N troksni).
    if (rate >= cfg.redRate && substantiveCount >= cfg.minSubstantiveRed) {
      return riskFound('G', 'buyer', buyerId, 'red', score, { detail });
    }
    if (rate >= cfg.yellowRate && substantiveCount >= cfg.minSubstantiveYellow) {
      return riskFound('G', 'buyer', buyerId, 'yellow', Math.min(score, 69), { detail });
    }
    return riskNotFound('G', 'buyer', buyerId, score, { detail });
  }
}

// Lineāra interpolācija: yellowRate→30, redRate→70, 2×redRate→100 (saskaņota ar krāsu joslām).
function scoreFromRate(rate: number, y: number, r: number): number {
  if (rate <= 0) return 0;
  if (rate < y) return Math.round((rate / y) * 30);
  if (rate < r) return Math.round(30 + ((rate - y) / (r - y)) * 40);
  return Math.min(100, Math.round(70 + ((rate - r) / r) * 30));
}
