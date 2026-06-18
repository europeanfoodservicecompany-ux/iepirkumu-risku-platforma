import { BaseTenderRiskRule } from '../base.ts';
import { IndicatorB1 } from './B1.ts';
import { IndicatorB2 } from './B2.ts';
import { IndicatorA } from './A.ts';
import { IndicatorC } from './C.ts';
import { IndicatorE } from './E.ts';
import { IndicatorD } from './D.ts';

// Indikatoru reģistrs. Jaunu slāni pievieno kā klasi, kas manto BaseTenderRiskRule.
export const INDICATORS: BaseTenderRiskRule[] = [
  new IndicatorB1(), // viena pretendenta īpatsvars
  new IndicatorB2(), // uzvarētāju koncentrācija
  new IndicatorA(),  // iepirkumu sadalīšana
  new IndicatorC(),  // cenu/vērtības novirze
  new IndicatorE(),  // procedūras integritāte
  new IndicatorD(),  // saistītās puses (jauni uzvarētāji)
];

export function getIndicator(id: string): BaseTenderRiskRule | undefined {
  return INDICATORS.find((i) => i.identifier === id);
}
