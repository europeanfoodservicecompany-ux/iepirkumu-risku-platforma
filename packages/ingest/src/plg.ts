// Personu dati par uzvarētājiem no Uzņēmumu reģistra atvērtajiem datiem:
//  - PLG (patiesā labuma guvēji)
//  - amatpersonas (valdes locekļi, prokūristi u.c.)
// Ļauj atklāt uzņēmumus ar KOPĪGU personu (īpašnieks/valde/prokūrists) — slēptas saiknes starp pretendentiem.

import { writeFileSync } from 'node:fs';

export const PLG_CSV =
  'https://data.gov.lv/dati/dataset/b7848ab9-7886-4df0-8bc6-70052a8d9e1a/resource/20a9b26d-d056-4dbb-ae18-9ff23c87bdee/download/beneficial_owners.csv';
export const OFFICERS_CSV =
  'https://data.gov.lv/dati/dataset/096c7a47-33cd-4dc9-a876-2c86e86230fd/resource/e665114a-73c2-4375-9470-55874b4cfa6b/download/officers.csv';

export type Role = 'PLG' | 'valde' | 'prokūrists' | 'likvidators' | 'amatpersona';
export type CompanyPerson = { name: string; id: string; role: Role; nat: string | null };

// Privātuma maska: tikai pirmie 4 personas koda cipari. Pilns dzimšanas datums datos NETIEK saglabāts.
function maskId(midRaw: string): string {
  const d = (midRaw || '').replace(/[^0-9]/g, '');
  return d ? d.slice(0, 4) + '***' : '***';
}
// Personas identitāte sasaistei: normalizēts vārds (tokeni sakārtoti, jo PLG=“Vārds Uzvārds”, amatpersonas=“Uzvārds Vārds”) + koda cipari.
function personKey(name: string, midRaw: string): string {
  const nm = name.toLowerCase().replace(/["“”]/g, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ');
  const d = (midRaw || '').replace(/[^0-9]/g, '');
  return `${nm}|${d}`;
}
function officerRole(position: string, body: string): Role {
  const s = `${position} ${body}`.toUpperCase();
  if (/PROCUR|PROKUR/.test(s)) return 'prokūrists';
  if (/BOARD|VALD/.test(s)) return 'valde';
  if (/LIQUIDAT|LIKVID/.test(s)) return 'likvidators';
  return 'amatpersona';
}

export type PersonMaps = {
  regPersons: Map<string, CompanyPerson[]>;                       // uzņēmums → personas (PLG + amatpersonas)
  regPersonKeys: Map<string, { pk: string; name: string; role: Role }[]>;
  personWinners: Map<string, { name: string; id: string; regs: Set<string>; roleByReg: Map<string, Role> }>; // persona → uzvarētāji
};

// Apvieno PLG + amatpersonu CSV. Tikai uzvarētāju uzņēmumiem.
export function parsePersons(plgCsv: string, officersCsv: string, winnerRegs: Set<string>): PersonMaps {
  const regPersons = new Map<string, CompanyPerson[]>();
  const regPersonKeys = new Map<string, { pk: string; name: string; role: Role }[]>();
  const personWinners = new Map<string, { name: string; id: string; regs: Set<string>; roleByReg: Map<string, Role> }>();
  const add = (reg: string, name: string, mid: string, role: Role, nat: string | null) => {
    if (!reg || !winnerRegs.has(reg) || !name) return;
    const pk = personKey(name, mid);
    (regPersons.get(reg) ?? regPersons.set(reg, []).get(reg)!).push({ name, id: maskId(mid), role, nat });
    (regPersonKeys.get(reg) ?? regPersonKeys.set(reg, []).get(reg)!).push({ pk, name, role });
    const pw = personWinners.get(pk) ?? { name, id: maskId(mid), regs: new Set<string>(), roleByReg: new Map<string, Role>() };
    pw.regs.add(reg); if (!pw.roleByReg.has(reg)) pw.roleByReg.set(reg, role); personWinners.set(pk, pw);
  };
  // PLG: forename;surname atsevišķi
  if (plgCsv) {
    const lines = plgCsv.split(/\r?\n/);
    const h = lines[0].split(';');
    const iReg = h.indexOf('legal_entity_registration_number'), iFn = h.indexOf('forename'), iSn = h.indexOf('surname'), iMid = h.indexOf('latvian_identity_number_masked'), iNat = h.indexOf('nationality');
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(';'); if (c.length < 5) continue;
      add(c[iReg], `${c[iFn] ?? ''} ${c[iSn] ?? ''}`.trim(), c[iMid] ?? '', 'PLG', (c[iNat] || '').trim() || null);
    }
  }
  // Amatpersonas: name (Uzvārds Vārds), position, governing_body; tikai fiziskas personas.
  if (officersCsv) {
    const lines = officersCsv.split(/\r?\n/);
    const h = lines[0].split(';');
    const iReg = h.indexOf('at_legal_entity_registration_number'), iType = h.indexOf('entity_type'), iPos = h.indexOf('position'), iBody = h.indexOf('governing_body'), iName = h.indexOf('name'), iMid = h.indexOf('latvian_identity_number_masked');
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(';'); if (c.length < 6) continue;
      if ((c[iType] || '') !== 'NATURAL_PERSON') continue;
      add(c[iReg], (c[iName] || '').replace(/"/g, '').trim(), c[iMid] ?? '', officerRole(c[iPos] ?? '', c[iBody] ?? ''), null);
    }
  }
  return { regPersons, regPersonKeys, personWinners };
}

async function dl(url: string, savePath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch HTTP ${res.status}`);
  writeFileSync(savePath, await res.text());
}
export const downloadPlg = (savePath: string) => dl(PLG_CSV, savePath);
export const downloadOfficers = (savePath: string) => dl(OFFICERS_CSV, savePath);
