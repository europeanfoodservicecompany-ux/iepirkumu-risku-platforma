import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lot } from '../src/types.ts';
import { DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG } from '../src/types.ts';
import { IndicatorA } from '../src/indicators/A.ts';

function lot(p: Partial<Lot>): Lot {
  return {
    id: p.id ?? 'L', noticeId: 'N', buyerId: 'B', receivedBids: 2, winnerChosen: true,
    procedureType: 'open', cpv: p.cpv ?? '30000000-9', awardValue: p.awardValue ?? null,
    noticeDate: p.noticeDate ?? '2025-01-10', winnerId: p.winnerId ?? 'W1', buyerName: 'Test', ...p,
  };
}
const a = new IndicatorA();
const ctx = { nationalAvg: 0.26, b1: DEFAULT_B1_CONFIG, b2: DEFAULT_B2_CONFIG, a: DEFAULT_A_CONFIG, c: DEFAULT_C_CONFIG, cpvStats: new Map(), e: DEFAULT_E_CONFIG, d: DEFAULT_D_CONFIG, companyReg: new Map() };
// S precēm = 42000

test('A: divi zemsliekšņa līgumi, kopā > S, vienā logā → karogs', () => {
  const lots = [
    lot({ id: '1', awardValue: 25000, noticeDate: '2025-01-05', winnerId: 'X' }), // ≥0.5×42000
    lot({ id: '2', awardValue: 22000, noticeDate: '2025-02-01', winnerId: 'Y' }), // ≥0.5×42000
  ];
  const r = a.processBuyer('B', lots, ctx); // sum 47000 > 42000, abi tuvu slieksnim
  assert.equal(r.status, 'RiskFound');
  assert.equal((r.detail?.clusters as any[]).length, 1);
});

test('A: viens uzvarētājs visā kopā → sarkans', () => {
  const lots = [
    lot({ id: '1', awardValue: 30000, noticeDate: '2025-01-05', winnerId: 'SAME' }),
    lot({ id: '2', awardValue: 25000, noticeDate: '2025-01-20', winnerId: 'SAME' }),
  ];
  const r = a.processBuyer('B', lots, ctx);
  assert.equal(r.level, 'red');
});

test('A: līgumi ārpus laika loga → nav kopas', () => {
  const lots = [
    lot({ id: '1', awardValue: 30000, noticeDate: '2025-01-05' }),
    lot({ id: '2', awardValue: 30000, noticeDate: '2025-09-05' }), // >90 dienas
  ];
  const r = a.processBuyer('B', lots, ctx);
  assert.equal(r.status, 'RiskNotFound');
  assert.equal(r.score, 0);
});

test('A: dažādi CPV netiek grupēti kopā', () => {
  const lots = [
    lot({ id: '1', awardValue: 30000, cpv: '30000000-9', noticeDate: '2025-01-05' }),
    lot({ id: '2', awardValue: 30000, cpv: '45000000-7', noticeDate: '2025-01-10' }),
  ];
  const r = a.processBuyer('B', lots, ctx);
  assert.equal(r.status, 'RiskNotFound');
});

test('A: viens līgums virs sliekšņa nav sadalīšana', () => {
  const lots = [
    lot({ id: '1', awardValue: 50000, noticeDate: '2025-01-05' }), // jau > S, korekta procedūra
    lot({ id: '2', awardValue: 5000, noticeDate: '2025-01-10' }),
  ];
  const r = a.processBuyer('B', lots, ctx); // tikai 1 zemsliekšņa kandidāts → nav kopas
  assert.equal(r.status, 'RiskNotFound');
});

test('A: ≥4 tuvu-slieksnim līgumi → sarkans', () => {
  const lots = Array.from({ length: 4 }, (_, i) =>
    lot({ id: 's' + i, awardValue: 22000, noticeDate: `2025-01-0${i + 1}`, winnerId: 'W' + i }));
  const r = a.processBuyer('B', lots, ctx); // 4×22000=88000 > 42000, visi ≥0.5×S, count>=4
  assert.equal(r.level, 'red');
});

test('A: daudz SĪKU pirkumu (zem tuvuma joslas) NETIEK karogoti', () => {
  // 10×5000=50000 > S, bet neviens nav tuvu slieksnim → nav sadalīšana
  const lots = Array.from({ length: 10 }, (_, i) =>
    lot({ id: 't' + i, awardValue: 5000, noticeDate: `2025-01-${String(i + 1).padStart(2, '0')}`, winnerId: 'W' + i }));
  const r = a.processBuyer('B', lots, ctx);
  assert.equal(r.status, 'RiskNotFound');
  assert.equal(r.score, 0);
});

test('A: būvdarbu slieksnis (170k) atšķiras', () => {
  const lots = [
    lot({ id: '1', cpv: '45200000-9', awardValue: 100000, noticeDate: '2025-01-05', winnerId: 'X' }),
    lot({ id: '2', cpv: '45200000-9', awardValue: 90000, noticeDate: '2025-01-20', winnerId: 'Y' }),
  ];
  const r = a.processBuyer('B', lots, ctx); // 190000 > 170000 → kopa
  assert.equal(r.status, 'RiskFound');
});
