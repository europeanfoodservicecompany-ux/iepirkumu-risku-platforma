import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lot } from '../src/types.ts';
import { DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG } from '../src/types.ts';
import { IndicatorB2 } from '../src/indicators/B2.ts';

function lot(p: Partial<Lot>): Lot {
  return {
    id: p.id ?? 'L', noticeId: 'N', buyerId: p.buyerId ?? 'B',
    receivedBids: 2, winnerChosen: p.winnerChosen ?? true,
    procedureType: 'open', winnerId: p.winnerId ?? null, awardValue: p.awardValue ?? null,
    buyerName: 'Test', ...p,
  };
}
const b2 = new IndicatorB2();
const ctx = { nationalAvg: 0.26, b1: DEFAULT_B1_CONFIG, b2: DEFAULT_B2_CONFIG, a: DEFAULT_A_CONFIG, c: DEFAULT_C_CONFIG, cpvStats: new Map(), e: DEFAULT_E_CONFIG, d: DEFAULT_D_CONFIG, companyReg: new Map() };

test('B2: < min_sample → NoData', () => {
  const lots = Array.from({ length: 5 }, (_, i) => lot({ id: 'a' + i, winnerId: 'W1' }));
  assert.equal(b2.processBuyer('B', lots, ctx).status, 'NoData');
});

test('B2: viens uzvarētājs visiem (HHI=1) → sarkans, score 100', () => {
  const lots = Array.from({ length: 12 }, (_, i) => lot({ id: 'a' + i, winnerId: 'MONO', awardValue: 1000 }));
  const r = b2.processBuyer('B', lots, ctx);
  assert.equal(r.level, 'red');
  assert.equal(r.score, 100);
  assert.equal(r.detail?.hhi, 1);
  assert.equal(r.detail?.topWinnerShare, 1);
});

test('B2: daudz dažādu uzvarētāju (zems HHI) → nav riska', () => {
  const lots = Array.from({ length: 12 }, (_, i) => lot({ id: 'a' + i, winnerId: 'W' + i, awardValue: 1000 }));
  const r = b2.processBuyer('B', lots, ctx);
  assert.equal(r.status, 'RiskNotFound');
  assert.ok((r.score ?? 99) < 30);
});

test('B2: koncentrācija pēc vērtības, ne tikai skaita', () => {
  // 11 mazi līgumi dažādiem + 1 milzīgs vienam → augsta vērtības koncentrācija
  const lots = [
    ...Array.from({ length: 11 }, (_, i) => lot({ id: 's' + i, winnerId: 'W' + i, awardValue: 100 })),
    lot({ id: 'big', winnerId: 'BIG', awardValue: 100000 }),
  ];
  const r = b2.processBuyer('B', lots, ctx);
  assert.equal(r.detail?.basis, 'value');
  assert.ok((r.detail?.topWinnerShare as number) > 0.9, 'top daļa pēc vērtības augsta');
  assert.equal(r.level, 'red');
});

test('B2: bez uzvarētāja datiem netiek skaitīts', () => {
  const lots = Array.from({ length: 12 }, (_, i) => lot({ id: 'a' + i, winnerId: null }));
  assert.equal(b2.processBuyer('B', lots, ctx).status, 'NoData');
});
