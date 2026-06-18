import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lot, CompanyInfo } from '../src/types.ts';
import { DEFAULT_B1_CONFIG, DEFAULT_B2_CONFIG, DEFAULT_A_CONFIG, DEFAULT_C_CONFIG, DEFAULT_E_CONFIG, DEFAULT_D_CONFIG } from '../src/types.ts';
import { IndicatorD } from '../src/indicators/D.ts';

function lot(p: Partial<Lot>): Lot {
  return { id: p.id ?? 'L', noticeId: 'N', buyerId: 'B', receivedBids: 2, winnerChosen: true,
    procedureType: 'open', cpv: '30000000-9', awardValue: 50000, noticeDate: p.noticeDate ?? '2025-01-10',
    winnerId: p.winnerId ?? 'W1', winnerName: 'SIA Test', buyerName: 'Test', ...p }; }
const d = new IndicatorD();
function ctx(reg: Record<string, CompanyInfo>) {
  return { nationalAvg: 0.26, b1: DEFAULT_B1_CONFIG, b2: DEFAULT_B2_CONFIG, a: DEFAULT_A_CONFIG, c: DEFAULT_C_CONFIG,
    cpvStats: new Map(), e: DEFAULT_E_CONFIG, d: DEFAULT_D_CONFIG, companyReg: new Map(Object.entries(reg)) };
}

test('D: nepietiek datu (< minAwards) → NoData', () => {
  const lots = Array.from({ length: 4 }, (_, i) => lot({ id: 'a' + i, winnerId: 'W' + i }));
  const reg = Object.fromEntries(lots.map((l) => [l.winnerId!, { registered: '2010-01-01', type: 'SIA' }]));
  assert.equal(d.processBuyer('B', lots, ctx(reg)).status, 'NoData');
});

test('D: vecs uzvarētājs → nav riska', () => {
  const lots = Array.from({ length: 6 }, (_, i) => lot({ id: 'a' + i, winnerId: 'OLD' }));
  assert.equal(d.processBuyer('B', lots, ctx({ OLD: { registered: '2005-01-01', type: 'SIA' } })).status, 'RiskNotFound');
});

test('D: ļoti jauns uzvarētājs (reģistrēts mēnesi pirms līguma) → sarkans', () => {
  const lots = Array.from({ length: 6 }, (_, i) => lot({ id: 'a' + i, winnerId: i === 0 ? 'NEW' : 'OLD' + i, noticeDate: '2025-01-10' }));
  const reg: any = { NEW: { registered: '2024-12-15', type: 'SIA' } };
  for (let i = 1; i < 6; i++) reg['OLD' + i] = { registered: '2008-01-01', type: 'SIA' };
  const r = d.processBuyer('B', lots, ctx(reg));
  assert.equal(r.level, 'red');
  assert.equal((r.detail?.newWinners as any[]).length, 1);
  assert.equal(r.detail?.veryNewAwards, 1);
});

test('D: uzvarētājs bez reģ. datuma netiek skaitīts', () => {
  const lots = Array.from({ length: 6 }, (_, i) => lot({ id: 'a' + i, winnerId: 'UNKNOWN' }));
  assert.equal(d.processBuyer('B', lots, ctx({})).status, 'NoData');
});
