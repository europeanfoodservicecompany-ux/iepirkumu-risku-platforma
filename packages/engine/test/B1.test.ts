import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lot } from '../src/types.ts';
import { DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG } from '../src/types.ts';
import { IndicatorB1 } from '../src/indicators/B1.ts';
import { computeNationalBaseline } from '../src/aggregate.ts';
import { runEngine } from '../src/index.ts';

function lot(p: Partial<Lot>): Lot {
  return {
    id: p.id ?? 'L', noticeId: 'N', buyerId: p.buyerId ?? 'B',
    receivedBids: p.receivedBids ?? null, winnerChosen: p.winnerChosen ?? false,
    procedureType: p.procedureType ?? 'open', cpv: p.cpv ?? '00000000-0',
    buyerName: p.buyerName ?? 'Test', ...p,
  };
}
const b1 = new IndicatorB1();
const ctx = { nationalAvg: 0.26, b1: DEFAULT_B1_CONFIG, b2: DEFAULT_B2_CONFIG, a: DEFAULT_A_CONFIG, c: DEFAULT_C_CONFIG, cpvStats: new Map(), e: DEFAULT_E_CONFIG, d: DEFAULT_D_CONFIG, companyReg: new Map() };

// ── Spec 8. sadaļas 6 testa gadījumi ──

test('1) BT-760=1, uzvarētājs izvēlēts → RiskFound (yellow)', () => {
  const r = b1.processLot(lot({ receivedBids: 1, winnerChosen: true }), ctx);
  assert.equal(r.status, 'RiskFound');
  assert.equal(r.level, 'yellow');
});

test('2) BT-760=3 → RiskNotFound (normāla konkurence)', () => {
  const r = b1.processLot(lot({ receivedBids: 3, winnerChosen: true }), ctx);
  assert.equal(r.status, 'RiskNotFound');
  assert.equal(r.level, null);
});

test('3) bez BT-760 → NoData', () => {
  const r = b1.processLot(lot({ receivedBids: null, winnerChosen: true }), ctx);
  assert.equal(r.status, 'NoData');
});

test('4) atcelts (nav uzvarētāja) → NotApplicable', () => {
  const r = b1.processLot(lot({ receivedBids: 1, winnerChosen: false }), ctx);
  assert.equal(r.status, 'NotApplicable');
});

test('5) pasūtītājs ar 5 daļām → score null (min sample)', () => {
  const lots = Array.from({ length: 5 }, (_, i) =>
    lot({ id: 'L' + i, buyerId: 'B5', receivedBids: 1, winnerChosen: true }));
  const r = b1.processBuyer('B5', lots, ctx);
  assert.equal(r.status, 'NoData');
  assert.equal(r.score, null);
});

test('6) pasūtītājs ar 50% single-bid → augsts score, sarkans', () => {
  const lots = [
    ...Array.from({ length: 10 }, (_, i) => lot({ id: 'S' + i, buyerId: 'B6', receivedBids: 1, winnerChosen: true })),
    ...Array.from({ length: 10 }, (_, i) => lot({ id: 'M' + i, buyerId: 'B6', receivedBids: 3, winnerChosen: true })),
  ];
  const r = b1.processBuyer('B6', lots, ctx); // rate 0.5; ratio 0.5/0.26 ≈ 1.92
  assert.equal(r.status, 'RiskFound');
  assert.equal(r.level, 'red');
  assert.ok((r.score ?? 0) >= 70, 'score augsts: ' + r.score);
});

// ── Papildu: NotApplicable/NoData neskaita kā "nav riska" ──
test('7) NotApplicable un NoData neietekmē saucēju', () => {
  const lots = [
    lot({ id: 'a', buyerId: 'B7', receivedBids: 1, winnerChosen: true }),
    lot({ id: 'b', buyerId: 'B7', receivedBids: null, winnerChosen: true }),  // NoData
    lot({ id: 'c', buyerId: 'B7', receivedBids: 2, winnerChosen: false }),    // NotApplicable
  ];
  const base = computeNationalBaseline(lots, (l) => b1.appliesTo(l));
  assert.equal(base.winnerChosenLots, 2); // tikai a + b
  assert.equal(base.singleBidLots, 1);    // tikai a
});

// ── Procedūras filtrs: B1 attiecas tikai uz open/restricted ──
test('8) sarunu procedūra netiek vērtēta ar B1', () => {
  assert.equal(b1.appliesTo(lot({ procedureType: 'neg-wo-call' })), false);
  assert.equal(b1.appliesTo(lot({ procedureType: 'open' })), true);
});

// ── runEngine integrācija ──
test('9) runEngine atgriež nacionālo bāzi un sakārtotus pasūtītājus', () => {
  const lots = [
    ...Array.from({ length: 10 }, (_, i) => lot({ id: 'x' + i, buyerId: 'HIGH', receivedBids: 1, winnerChosen: true })),
    ...Array.from({ length: 10 }, (_, i) => lot({ id: 'y' + i, buyerId: 'LOW', receivedBids: 4, winnerChosen: true })),
  ];
  const out = runEngine(lots);
  assert.ok(out.national.singleBidRate > 0 && out.national.singleBidRate < 1);
  assert.equal(out.buyers[0].buyerId, 'HIGH'); // augstākais risks pirmais
});
