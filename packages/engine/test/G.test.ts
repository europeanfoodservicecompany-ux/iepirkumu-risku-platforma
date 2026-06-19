import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lot, Modification, EngineContext } from '../src/types.ts';
import { DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG, DEFAULT_G_CONFIG } from '../src/types.ts';
import { IndicatorG } from '../src/indicators/G.ts';

const g = new IndicatorG();

function lot(procedureId: string): Lot {
  return { id: 'L' + procedureId, noticeId: 'N', procedureId, buyerId: 'B', winnerChosen: true,
    receivedBids: 2, cpv: '45000000-7', awardValue: 100000, noticeDate: '2025-06-01', buyerName: 'Test' };
}
function mod(procedureId: string, reasonCode: string): Modification {
  return { procedureId, buyerId: 'B', buyerName: 'Test', cpv: '45000000-7', reasonCode,
    reasonDescription: null, description: null, value: 1000, winnerName: 'SIA X', sourceUrl: null, date: null, name: 'Līgums' };
}
function ctx(mods: Modification[]): EngineContext {
  return { nationalAvg: 0.26, b1: DEFAULT_B1_CONFIG, b2: DEFAULT_B2_CONFIG, a: DEFAULT_A_CONFIG, c: DEFAULT_C_CONFIG,
    cpvStats: new Map(), e: DEFAULT_E_CONFIG, d: DEFAULT_D_CONFIG, g: DEFAULT_G_CONFIG,
    companyReg: new Map(), modifications: new Map([['B', mods]]) };
}

test('G: < min līgumu → NoData', () => {
  const lots = Array.from({ length: 5 }, (_, i) => lot('p' + i));
  assert.equal(g.processBuyer('B', lots, ctx([])).status, 'NoData');
});

test('G: nav grozījumu → RiskNotFound, score 0', () => {
  const lots = Array.from({ length: 20 }, (_, i) => lot('p' + i));
  const r = g.processBuyer('B', lots, ctx([]));
  assert.equal(r.status, 'RiskNotFound');
  assert.equal(r.score, 0);
});

test('G: viens papildu-darbu grozījums (1/20) → zem aizsarga, nav sarkans', () => {
  const lots = Array.from({ length: 20 }, (_, i) => lot('p' + i));
  const r = g.processBuyer('B', lots, ctx([mod('p0', 'add-wss')]));
  assert.notEqual(r.level, 'red'); // skaita aizsargs: 1 < minSubstantiveYellow(2)
});

test('G: augsts papildu-darbu īpatsvars → sarkans', () => {
  const lots = Array.from({ length: 20 }, (_, i) => lot('p' + i));
  // 3 atšķirīgi līgumi ar papildu darbiem (3/20 = 15% >= redRate 9%, count 3 >= 3)
  const mods = [mod('p0', 'add-wss'), mod('p1', 'add-wss'), mod('p2', 'mod-repl')];
  const r = g.processBuyer('B', lots, ctx(mods));
  assert.equal(r.level, 'red');
  assert.equal((r.detail as any).substantiveContracts, 3);
});

test('G: termiņa pagarinājumi (mod-cir) neskaitās par būtiskiem', () => {
  const lots = Array.from({ length: 20 }, (_, i) => lot('p' + i));
  const mods = [mod('p0', 'mod-cir'), mod('p1', 'mod-cir'), mod('p2', 'mod-cir'), mod('p3', 'mod-nons')];
  const r = g.processBuyer('B', lots, ctx(mods));
  assert.equal(r.status, 'RiskNotFound'); // nav būtisku → 0
  assert.equal((r.detail as any).substantiveContracts, 0);
});
