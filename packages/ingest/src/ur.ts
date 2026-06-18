// Uzņēmumu reģistra (UR) atvērto datu ievākšana — uzņēmumu reģistrācijas datumi.
// Avots: data.gov.lv “Uzņēmumu reģistra atvērtie dati” (register.csv; ~485k subjekti, atjaunots dienā).
// D indikators izmanto reģistrācijas datumu, lai atklātu nesen dibinātus uzvarētājus.

import { readFileSync, writeFileSync } from 'node:fs';
import type { CompanyInfo } from '../../engine/src/types.ts';

export const UR_REGISTER_CSV =
  'https://data.gov.lv/dati/dataset/4de9697f-850b-45ec-8bba-61fa09ce932f/resource/25e80bf3-f107-4ab4-89ef-251b5b9374e9/download/register.csv';

// Parsē UR register.csv (; atdalīts) un atgriež karti regcode → {registered, type}.
// Ja dots `onlyRegcodes`, iekļauj tikai tos (kompakta karte uzvarētājiem).
export function parseRegisterCsv(csv: string, onlyRegcodes?: Set<string>): Record<string, CompanyInfo> {
  const lines = csv.split(/\r?\n/);
  const header = lines[0].split(';');
  const iCode = header.indexOf('regcode');
  const iReg = header.indexOf('registered');
  const iType = header.indexOf('type');
  const out: Record<string, CompanyInfo> = {};
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = splitCsvLine(lines[i]);
    const code = cols[iCode];
    if (!code) continue;
    if (onlyRegcodes && !onlyRegcodes.has(code)) continue;
    out[code] = { registered: cols[iReg] || null, type: cols[iType] || null };
  }
  return out;
}

// Lejupielādē UR reģistru un saglabā kompaktu karti tikai dotajiem reģ. numuriem.
export async function buildRegistrationMap(regcodes: Set<string>, savePath?: string): Promise<Record<string, CompanyInfo>> {
  const res = await fetch(UR_REGISTER_CSV);
  if (!res.ok) throw new Error(`UR fetch HTTP ${res.status}`);
  const csv = await res.text();
  const map = parseRegisterCsv(csv, regcodes);
  if (savePath) writeFileSync(savePath, JSON.stringify(map, null, 0));
  return map;
}

// Ielādē saglabāto reģistrācijas karti kā Map (lieto dzinēja companyReg).
export function loadRegistrationMap(path: string): Map<string, CompanyInfo> {
  const json = JSON.parse(readFileSync(path, 'utf8')) as Record<string, CompanyInfo>;
  return new Map(Object.entries(json));
}

// CSV rinda ar pēdiņu atbalstu (UR lieto " kā teksta ietvērēju).
function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ';') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
