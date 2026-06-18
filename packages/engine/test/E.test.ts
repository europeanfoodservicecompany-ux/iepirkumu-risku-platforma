import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lot } from '../src/types.ts';
import { DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG } from '../src/types.ts';
import { IndicatorE } from '../src/indicators/E.ts';

function lot(p: Partial<Lot>): Lot {
  return { id: p.id ?? 'L', noticeId: 'N', buyerId: 'B', receivedBids: p.receivedBids ?? 2, winnerChosen: p.winnerChosen ?? true,
    procedureType: p.procedureType ?? 'open', cpv: '30000000-9', awardValue: 1000, noticeDate: '2025-01-10', winnerId: 'W', buyerName: 'Test', ...p }; }
const e = new IndicatorE();
const ctx = { nationalAvg: 0.26, b1: DEFAULT_B1_CONFIG, b2: DEFAULT_B2_CONFIG, a: DEFAULT_A_CONFIG, c: DEFAULT_C_CONFIG, cpvStats: new Map(), e: DEFAULT_E_CONFIG, d: DEFAULT_D_CONFIG, companyReg: new Map() };

test('E lot: neg-wo-call → dzeltens', () => {
  assert.equal(e.processLot(lot({ procedureType: 'neg-wo-call' }), ctx).level, 'yellow');
});
test('E lot: neg-wo-call + viens pretendents → sarkans (kombinācija)', () => {
  assert.equal(e.processLot(lot({ procedureType: 'neg-wo-call', receivedBids: 1 }), ctx).level, 'red');
});
test('E lot: atklāta procedūra → nav riska', () => {
  assert.equal(e.processLot(lot({ procedureType: 'open' }), ctx).status, 'RiskNotFound');
});
test('E buyer: augsts ne-konkurences īpatsvars → sarkans', () => {
  const lots = [
    ...Array.from({ length: 8 }, (_, i) => lot({ id: 'n' + i, procedureType: 'neg-wo-call' })),
    ...Array.from({ length: 8 }, (_, i) => lot({ id: 'o' + i, procedureType: 'open' })),
  ]; // 16 >= minSample 15; share 0.5 >= redShare 0.35
  const r = e.processBuyer('B', lots, ctx);
  assert.equal(r.level, 'red');
  assert.equal(r.detail?.nonCompetitiveLots, 8);
});
test('E buyer: < min_sample → NoData', () => {
  const lots = Array.from({ length: 5 }, (_, i) => lot({ id: 'x' + i, procedureType: 'neg-wo-call' }));
  assert.equal(e.processBuyer('B', lots, ctx).status, 'NoData');
});
