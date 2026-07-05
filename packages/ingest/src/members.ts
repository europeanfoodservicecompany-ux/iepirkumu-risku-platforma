// SIA dalībnieku (kapitāldaļu turētāju) atvērtie dati no UR (data.gov.lv, CC0, dienā).
// Ļauj būvēt īpašuma ķēdes "uzņēmums → mātes uzņēmums → … → galējais īpašnieks" un atklāt
// uzvarētājus, kas pieder vienam holdingam (saikne, ko patiesā labuma guvēji ne vienmēr parāda).
import { writeFileSync } from 'node:fs';

export const MEMBERS_URL = 'https://data.gov.lv/dati/dataset/e1162626-e02a-4545-9236-37553609a988/resource/837b451a-4833-4fd1-bfdd-b45b35a994fd/download/members.csv';

export type MemberOwner = { kind: 'company' | 'person' | 'foreign'; reg: string | null; name: string; shares: number };
// bērns (reģ.nr.) → tā dalībnieki + kopējās daļas (procentu aprēķinam)
export type OwnersMap = Map<string, { owners: MemberOwner[]; total: number }>;

export function parseMembers(csv: string): OwnersMap {
  const out: OwnersMap = new Map();
  if (!csv) return out;
  const lines = csv.split(/\r?\n/);
  const h = lines[0].split(';');
  const iChild = h.indexOf('at_legal_entity_registration_number');
  const iType = h.indexOf('entity_type');
  const iName = h.indexOf('name');
  const iOwnerReg = h.indexOf('legal_entity_registration_number');
  const iShares = h.indexOf('number_of_shares');
  if (iChild < 0 || iType < 0) return out;
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(';'); if (c.length < 8) continue;
    const child = (c[iChild] || '').trim(); if (!child) continue;
    const type = c[iType] || '';
    const name = (c[iName] || '').replace(/"/g, '').trim();
    const shares = parseFloat(c[iShares] || '0') || 0;
    let owner: MemberOwner | null = null;
    if (type === 'LEGAL_ENTITY') owner = { kind: 'company', reg: (c[iOwnerReg] || '').trim() || null, name, shares };
    else if (type === 'NATURAL_PERSON') owner = { kind: 'person', reg: null, name, shares };
    else if (type === 'FOREIGN_ENTITY') owner = { kind: 'foreign', reg: null, name, shares };
    else continue; // JOINT_OWNERS — atsevišķā failā, izlaižam
    if (!owner.name) continue;
    const e = out.get(child) ?? { owners: [], total: 0 };
    e.owners.push(owner); e.total += shares;
    out.set(child, e);
  }
  return out;
}

// Visi korporatīvie senči (mātes uzņēmumi) konkrētam uzņēmumam, augšup pa ķēdi (cikla aizsargs + dziļuma limits).
export function ancestorCompanies(reg: string, ownersOf: OwnersMap, maxDepth = 8): Set<string> {
  const seen = new Set<string>();
  const stack: [string, number][] = [[reg, 0]];
  while (stack.length) {
    const [r, d] = stack.pop()!;
    if (d >= maxDepth) continue;
    const e = ownersOf.get(r);
    if (!e) continue;
    for (const o of e.owners) {
      // izlaižam pašcilpu (o.reg===r) un sākotnējo uzņēmumu (o.reg===reg), lai firma nekļūst par savu senci
      if (o.kind === 'company' && o.reg && o.reg !== r && o.reg !== reg && !seen.has(o.reg)) { seen.add(o.reg); stack.push([o.reg, d + 1]); }
    }
  }
  return seen;
}

export async function downloadMembers(savePath: string): Promise<void> {
  const res = await fetch(MEMBERS_URL);
  if (!res.ok) throw new Error(`members fetch HTTP ${res.status}`);
  writeFileSync(savePath, await res.text());
}
