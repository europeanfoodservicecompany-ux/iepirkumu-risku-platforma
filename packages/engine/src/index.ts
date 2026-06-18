import type {
  Lot, RiskResult, B1Config, B2Config, AConfig, CConfig, EConfig, DConfig, CompanyInfo, Weights, EngineContext,
} from './types.ts';
import {
  DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG, DEFAULT_WEIGHTS,
} from './types.ts';
import { IndicatorB1 } from './indicators/B1.ts';
import { IndicatorB2 } from './indicators/B2.ts';
import { IndicatorA } from './indicators/A.ts';
import { IndicatorC } from './indicators/C.ts';
import { IndicatorE } from './indicators/E.ts';
import { IndicatorD } from './indicators/D.ts';
import { computeNationalBaseline, computeCpvPriceStats, groupByBuyer, type NationalBaseline } from './aggregate.ts';

export * from './types.ts';
export { IndicatorB1, isSingleBid } from './indicators/B1.ts';
export { IndicatorB2 } from './indicators/B2.ts';
export { IndicatorA } from './indicators/A.ts';
export { IndicatorC } from './indicators/C.ts';
export { IndicatorE } from './indicators/E.ts';
export { IndicatorD } from './indicators/D.ts';
export { computeNationalBaseline, computeCpvPriceStats, computeSectorStats, computeClosedMarkets, groupByBuyer } from './aggregate.ts';

export type BuyerSummary = {
  buyerId: string;
  buyerName: string | null;
  riskScore: number | null;     // augstākais starp indikatoriem
  combinedScore: number | null; // svērtais kopējais risks (rangam un galvenajam rādītājam)
  combinedLevel: 'red' | 'yellow' | 'green' | null;
  layerScores: { A: number | null; B: number | null; C: number | null; D: number | null; E: number | null };
  result: RiskResult;        // B1
  b2: RiskResult;            // B2 — uzvarētāju koncentrācija
  a: RiskResult;             // A  — iepirkumu sadalīšana
  c: RiskResult;             // C  — cenu/vērtības novirze
  e: RiskResult;             // E  — procedūras integritāte
  d: RiskResult;             // D  — saistītās puses
  flaggedLots: RiskResult[]; // karogotie iepirkumi (B1 lot līmenis)
};

export type EngineOutput = {
  computedAt: string;
  national: NationalBaseline;
  lotResults: RiskResult[];
  buyers: BuyerSummary[];
};

function maxScore(...rs: RiskResult[]): number | null {
  const vals = rs.map((r) => r.score).filter((s): s is number => s !== null);
  return vals.length ? Math.max(...vals) : null;
}


// Kopējais svērtais risks. B slānis = max(B1, B2). Renormalizē svarus pār slāņiem, kuriem ir
// rādītājs (trūkstošs slānis nedz pazemina, nedz dilst — tas vienkārši netiek ieskaitīts).
function combine(
  layers: { A: number | null; B: number | null; C: number | null; D: number | null; E: number | null },
  w: Weights,
): { score: number | null; level: 'red' | 'yellow' | 'green' | null } {
  const keys = Object.keys(w) as (keyof Weights)[];
  // Ja NEVIENS slānis nav novērtējams → null (nezināms, ne "zems").
  if (keys.every((k) => layers[k] === null)) return { score: null, level: null };
  // Svērtā summa pār VISIEM slāņiem; trūkstošais slānis dod 0 ieguldījumu (nevis pilnu svaru).
  // Tā augstu kopējo risku rada vairāku signālu sakritība, ne viens izolēts rādītājs.
  const totalW = keys.reduce((a, k) => a + w[k], 0);
  const sum = keys.reduce((a, k) => a + w[k] * (layers[k] ?? 0), 0);
  const score = Math.round(sum / totalW);
  const level = score >= 70 ? 'red' : score >= 30 ? 'yellow' : 'green';
  return { score, level };
}

export type EngineConfig = {
  b1?: B1Config; b2?: B2Config; a?: AConfig; c?: CConfig; e?: EConfig; d?: DConfig;
  companyReg?: Map<string, CompanyInfo>;
  weights?: Weights;
};

// Galvenā plūsma: aprēķina visus indikatorus (B1, B2, A, C, E, D) pasūtītājiem.
export function runEngine(lots: Lot[], cfg: EngineConfig = {}): EngineOutput {
  const b1 = new IndicatorB1();
  const b2 = new IndicatorB2();
  const a = new IndicatorA();
  const c = new IndicatorC();
  const e = new IndicatorE();
  const d = new IndicatorD();
  const weights = cfg.weights ?? DEFAULT_WEIGHTS;
  const national = computeNationalBaseline(lots, (l) => b1.appliesTo(l));
  const cConfig = cfg.c ?? DEFAULT_C_CONFIG;
  const ctx: EngineContext = {
    nationalAvg: national.singleBidRate,
    b1: cfg.b1 ?? DEFAULT_B1_CONFIG,
    b2: cfg.b2 ?? DEFAULT_B2_CONFIG,
    a: cfg.a ?? DEFAULT_A_CONFIG,
    c: cConfig,
    cpvStats: computeCpvPriceStats(lots, cConfig.cpvDigits, cConfig.minObs),
    e: cfg.e ?? DEFAULT_E_CONFIG,
    d: cfg.d ?? DEFAULT_D_CONFIG,
    companyReg: cfg.companyReg ?? new Map(),
  };

  const lotResults = lots.map((l) => b1.processLot(l, ctx));

  const byBuyer = groupByBuyer(lots);
  const buyers: BuyerSummary[] = [];
  for (const [buyerId, buyerLots] of byBuyer) {
    const r1 = b1.processBuyer(buyerId, buyerLots, ctx);
    const r2 = b2.processBuyer(buyerId, buyerLots, ctx);
    const rA = a.processBuyer(buyerId, buyerLots, ctx);
    const rC = c.processBuyer(buyerId, buyerLots, ctx);
    const rE = e.processBuyer(buyerId, buyerLots, ctx);
    const rD = d.processBuyer(buyerId, buyerLots, ctx);
    const flaggedLots = buyerLots
      .map((l) => b1.processLot(l, ctx))
      .filter((r) => r.status === 'RiskFound');
    const layerScores = {
      A: rA.score,
      B: maxScore(r1, r2),
      C: rC.score,
      D: rD.score,
      E: rE.score,
    };
    const comb = combine(layerScores, weights);
    buyers.push({
      buyerId,
      buyerName: buyerLots.find((l) => l.buyerName)?.buyerName ?? null,
      riskScore: maxScore(r1, r2, rA, rC, rE, rD),
      combinedScore: comb.score,
      combinedLevel: comb.level,
      layerScores,
      result: r1, b2: r2, a: rA, c: rC, e: rE, d: rD,
      flaggedLots,
    });
  }
  buyers.sort((x, y) => (y.combinedScore ?? -1) - (x.combinedScore ?? -1));

  return { computedAt: new Date().toISOString(), national, lotResults, buyers };
}
