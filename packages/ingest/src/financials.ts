// Gada pārskatu finanšu dati (VID → UR, data.gov.lv, CC0, dienā).
// Sniedz uzvarētāja jaunākā gada apgrozījumu, darbinieku skaitu un peļņu — konteksts un "frontes firmas"
// signāls (ļoti maz resursu lieliem līgumiem). Divi faili: financial_statements (gads, darbinieki) +
// income_statements (neto apgrozījums, peļņa), savienoti pa statement id.
import { writeFileSync } from 'node:fs';

export const FS_URL = 'https://data.gov.lv/dati/dataset/8d31b878-536a-44aa-a013-8bc6b669d477/resource/27fcc5ec-c63b-4bfd-bb08-01f073a52d04/download/financial_statements.csv';
export const INC_URL = 'https://data.gov.lv/dati/dataset/8d31b878-536a-44aa-a013-8bc6b669d477/resource/d5fd17ef-d32e-40cb-8399-82b780095af0/download/income_statements.csv';

export type Financials = { year: number; employees: number | null; turnover: number | null; profit: number | null };
const FACT: Record<string, number> = { ONES: 1, TENS: 10, HUNDREDS: 100, THOUSANDS: 1000, MILLIONS: 1e6 };

// Parsē abus failus un atgriež reg → jaunākā gada finanses (tikai dotajiem uzvarētāju reģ. numuriem).
export function parseFinancials(fsCsv: string, incCsv: string, winnerRegs: Set<string>): Record<string, Financials> {
  const fsL = fsCsv.split(/\r?\n/);
  const fh = fsL[0].split(';');
  const iId = fh.indexOf('id'), iReg = fh.indexOf('legal_entity_registration_number'), iYr = fh.indexOf('year'), iEmp = fh.indexOf('employees'), iRnd = fh.indexOf('rounded_to_nearest');
  const latest = new Map<string, { id: string; year: number; emp: number | null; fact: number; turnover: number | null; profit: number | null }>();
  for (let i = 1; i < fsL.length; i++) {
    if (!fsL[i]) continue;
    const c = fsL[i].split(';');
    const reg = c[iReg];
    if (!winnerRegs.has(reg)) continue;
    const yr = Number(c[iYr]) || 0;
    const cur = latest.get(reg);
    if (!cur || yr > cur.year) latest.set(reg, { id: c[iId], year: yr, emp: c[iEmp] === '' ? null : Number(c[iEmp]), fact: FACT[c[iRnd]] ?? 1, turnover: null, profit: null });
  }
  const byId = new Map<string, { id: string; year: number; emp: number | null; fact: number; turnover: number | null; profit: number | null }>();
  for (const v of latest.values()) byId.set(v.id, v);
  const il = incCsv.split(/\r?\n/);
  const ih = il[0].split(';');
  const iSid = ih.indexOf('statement_id'), iTo = ih.indexOf('net_turnover'), iPr = ih.indexOf('income_after_income_taxes');
  for (let i = 1; i < il.length; i++) {
    if (!il[i]) continue;
    const c = il[i].split(';');
    const v = byId.get(c[iSid]);
    if (!v) continue;
    v.turnover = c[iTo] === '' ? null : (Number(c[iTo]) || 0) * v.fact;
    v.profit = c[iPr] === '' ? null : (Number(c[iPr]) || 0) * v.fact;
  }
  const out: Record<string, Financials> = {};
  for (const [reg, v] of latest) out[reg] = { year: v.year, employees: v.emp, turnover: v.turnover, profit: v.profit };
  return out;
}

// Lejupielādē abus failus, parsē un saglabā kompaktu karti tikai uzvarētājiem (financials.json).
export async function buildFinancialsMap(winnerRegs: Set<string>, savePath: string): Promise<void> {
  const get = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(`fetch HTTP ${r.status}`); return r.text(); };
  const [fsCsv, incCsv] = await Promise.all([get(FS_URL), get(INC_URL)]);
  writeFileSync(savePath, JSON.stringify(parseFinancials(fsCsv, incCsv, winnerRegs)));
}
