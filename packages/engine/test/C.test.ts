import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lot } from '../src/types.ts';
import { DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG } from '../src/types.ts';
import { IndicatorC } from '../src/indicators/C.ts';
import { computeCpvPriceStats } from '../src/aggregate.ts';

function lot(p: Partial<Lot>): Lot {
  return {
    id: p.id ?? 'L', noticeId: 'N', buyerId: p.buyerId ?? 'B', receivedBids: 2, winnerChosen: true,
    procedureType: 'open', cpv: p.cpv ?? '30000000-9', awardValue: p.awardValue ?? null,
    noticeDate: '2025-01-10', winnerId: 'W', buyerName: 'Test', ...p,
  };
}
const c = new IndicatorC();
function ctxWith(lots: Lot[]) {
  return {
    nationalAvg: 0.26, b1: DEFAULT_B1_CONFIG, b2: DEFAULT_B2_CONFIG, a: DEFAULT_A_CONFIG,
    c: DEFAULT_C_CONFIG, cpvStats: computeCpvPriceStats(lots, DEFAULT_C_CONFIG.cpvDigits, DEFAULT_C_CONFIG.minObs), e: DEFAULT_E_CONFIG, d: DEFAULT_D_CONFIG, companyReg: new Map(),
  };
}

test('C: nepietiek CPV novērojumu → NoData', () => {
  const lots = [lot({ id: '1', cpv: '30000000-9', awardValue: 1000 })];
  const ctx = ctxWith(lots);
  assert.equal(c.processBuyer('B', lots, ctx).status, 'NoData');
});

test('C: izteikts vērtības izlēcējs → augsts z, sarkans', () => {
  // 8 līdzīgi ~1000 + 1 milzīgs 1 000 000 tajā pašā CPV
  const base = Array.from({ length: 8 }, (_, i) => lot({ id: 'n' + i, buyerId: 'OTHER', cpv: '30000000-9', awardValue: 1000 + i * 10 }));
  const outlier = lot({ id: 'big', buyerId: 'SUSPECT', cpv: '30000000-9', awardValue: 1_000_000 });
  const all = [...base, outlier];
  const ctx = ctxWith(all);
  const r = c.processBuyer('SUSPECT', [outlier], ctx);
  assert.equal(r.status, 'RiskFound');
  assert.equal(r.level, 'red');
  assert.ok((r.detail?.maxZ as number) > 2);
  assert.equal((r.detail?.priceFlags as any[]).length, 1);
});

test('C: tipiska vērtība → nav riska', () => {
  const base = Array.from({ length: 10 }, (_, i) => lot({ id: 'n' + i, buyerId: 'X', cpv: '30000000-9', awardValue: 1000 + i * 20 }));
  const ctx = ctxWith(base);
  const subject = base[0];
  const r = c.processBuyer('X', [subject], ctx);
  assert.equal(r.status, 'RiskNotFound');
});

test('C: CPV statistika rēķina tikai grupas ar pietiekamiem novērojumiem', () => {
  const lots = [
    ...Array.from({ length: 6 }, (_, i) => lot({ id: 'a' + i, cpv: '30000000-9', awardValue: 1000 })),
    ...Array.from({ length: 2 }, (_, i) => lot({ id: 'b' + i, cpv: '45000000-7', awardValue: 1000 })),
  ];
  const stats = computeCpvPriceStats(lots, 4, 5);
  assert.ok(stats.has('3000'));   // 6 ≥ 5
  assert.ok(!stats.has('4500'));  // 2 < 5
});
