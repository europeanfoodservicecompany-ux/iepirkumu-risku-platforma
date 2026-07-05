// EIS (Elektronisko iepirkumu sistēma) piedāvājumu ATVĒRŠANAS dati (data.gov.lv, VDAA, gada CSV).
// Katra rinda = VIENS pretendents vienam iepirkumam. Sniedz to, kā IUB paziņojumos NAV:
// PRETENDENTU IDENTITĀTES (arī zaudētāju) + reālo pretendentu SKAITU. Sasaiste: Iepirkuma_ID = mūsu eisId.
// Tas atļauj ĪSTU aizliegtas vienošanās (karteļa) analīzi — kurš ar kuru kopā piedalās, rotācija, seguma piedāvājumi.
import { writeFileSync } from 'node:fs';

const DS = 'iepirkumu-piedavajumu-atversanu-datu-grupa';
const PKG = `https://data.gov.lv/dati/api/3/action/package_show?id=${DS}`;
// Tikai gadi, kas pārklājas ar mūsu IUB logu (sākas 2023-10).
const YEARS = ['2023', '2024', '2025', '2026'];

export type EisBidder = { reg: string; name: string | null; country: string | null };
export type EisProc = { bidders: EisBidder[]; n: number; cpv: string | null; buyerReg: string | null };
export type EisData = Record<string, EisProc>; // eisId → pretendenti + skaits

// Robusts CSV parseris ar konfigurējamu delimiteri (2023 lieto ';', pārējie ',') un iegultām pēdiņām/jaunrindām.
function parseCSV(text: string, delim: string): string[][] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch === '\r') { /* izlaiž */ }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
// Daži gadu faili (piem. 2023) eksportē Excel-formātā ="vērtība" (lai piespiestu teksta tipu) — atšķetina.
const deExcel = (s: string | undefined) => (s ?? '').trim().replace(/^="?(.*?)"?$/, '$1');
const clean = (s: string | undefined) => { const t = deExcel(s); return t === '' ? null : t; };

// Parsē vienu gada failu un papildina karti (tikai dotajiem eisId).
function parseYear(text: string, eisIds: Set<string>, out: EisData): number {
  const head = text.slice(0, 300);
  const delim = (head.split(';').length > head.split(',').length) ? ';' : ',';
  const rows = parseCSV(text, delim);
  if (rows.length < 2) return 0;
  const ix = (name: string) => rows[0].findIndex((h) => h.trim().replace(/^﻿/, '') === name);
  const cId = ix('Iepirkuma_ID'), cReg = ix('Pretendenta_registracijas_numurs'), cName = ix('Pretendenta_nosaukums');
  const cCountry = ix('Pretendenta_valsts'), cCpv = ix('CPV_kods_galvenais_prieksmets'), cBuyer = ix('Pasutitaja_registracijas_numurs');
  if (cId < 0 || cReg < 0) return 0;
  let n = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const id = deExcel(r[cId]);
    if (!id || !eisIds.has(id)) continue;
    const reg = deExcel(r[cReg]); if (!reg) continue;
    const e = out[id] ?? (out[id] = { bidders: [], n: 0, cpv: clean(r[cCpv])?.split(' ')[0] ?? null, buyerReg: clean(r[cBuyer]) });
    if (!e.bidders.some((b) => b.reg === reg)) e.bidders.push({ reg, name: clean(r[cName]), country: clean(r[cCountry]) });
    n++;
  }
  return n;
}

// Lejupielādē visus relevantos gadus, sasaista ar mūsu eisId un saglabā kompaktu eis.json.
export async function buildEisBidders(eisIds: Set<string>, savePath: string): Promise<void> {
  const pk = await (await fetch(PKG)).json() as any;
  const resources: { name: string; url: string }[] = (pk?.result?.resources ?? [])
    .filter((r: any) => YEARS.some((y) => (r?.name ?? '').includes(y)));
  const out: EisData = {};
  for (const r of resources) {
    try {
      const text = await (await fetch(r.url)).text();
      const n = parseYear(text, eisIds, out);
      console.log(`  EIS ${r.name}: ${n} pretendentu rindas saskanētas`);
    } catch (e) {
      console.warn(`  EIS ${r.name} neizdevās (${String(e)})`);
    }
  }
  for (const id of Object.keys(out)) out[id].n = out[id].bidders.length;
  writeFileSync(savePath, JSON.stringify(out));
}
