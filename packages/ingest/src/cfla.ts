// CFLA ES fondu projektu dati (data.gov.lv, CC0). Divi periodi: 14-20 + 21-27.
// Apvieno: (1) iepirkumu LĪGUMUS (t.sk. ZEMSLIEKŠŅA, ko IUB nesatur) pa uzvarētāja reģ.nr.;
// (2) projektu SARAKSTU → fonds (ERAF/ESF/KF/AF) + projekta nosaukums + statuss;
// (3) sadarbības PARTNERUS → saistība starp izpildītājiem viena ES projekta ietvaros;
// (4) iepirkumu PLĀNU → cik iepirkumu projektā plānoti (plāns pret faktu).
// Sasaisti ar IUB lotiem (regNr+procNr/datums) veic output.ts.
import { writeFileSync } from 'node:fs';

const DS_1420 = '4ce3df9e-b3c4-4373-af8c-afb1dc6a9a61';
const DS_2127 = 'bfa55ed7-f58c-48c4-bf8e-cb7ff4f12b05';
const pkgUrl = (ds: string) => `https://data.gov.lv/dati/api/3/action/package_show?id=${ds}`;

export type CflaContract = {
  project: string | null; projectName: string | null; fund: string | null;
  procNr: string | null; veids: string | null; date: string | null; value: number; below: boolean;
};
export type CflaProject = { fund: string | null; name: string | null; status: string | null };
export type CflaPartner = { reg: string; name: string | null };
export type CflaData = {
  byWinner: Record<string, CflaContract[]>;
  projects: Record<string, CflaProject>;
  partners: Record<string, CflaPartner[]>;
  plan: Record<string, number>;
};

// Robusts CSV parseris: ņem vērā pēdiņas, iegultos komatus UN jaunrindas (saraksta kopsavilkumi
// satur jaunrindas, tāpēc rindu dalīšana nestrādā). Atgriež string[][] (ar galveni 0. rindā).
function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch === '\r') { /* izlaiž */ }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const clean = (s: string | undefined) => { const t = (s ?? '').trim(); return t === '' ? null : t; };
// Galvenes nosaukumu → indeksu karte (tolerē atstarpes/reģistru).
function headerIdx(header: string[]): (name: string) => number {
  const norm = (s: string) => s.trim().toLowerCase();
  const map = new Map(header.map((h, i) => [norm(h), i]));
  return (name: string) => map.get(norm(name)) ?? -1;
}

const get = async (u: string) => { const r = await fetch(u); if (!r.ok) throw new Error(`fetch HTTP ${r.status}`); return r.text(); };
// Atrod resursa URL datu kopā pēc nosaukuma regex (id mēdz mainīties → dinamiski).
async function resolveRes(ds: string, re: RegExp): Promise<string | null> {
  try {
    const pk = await (await fetch(pkgUrl(ds))).json() as any;
    return pk?.result?.resources?.find((r: any) => re.test(r?.name ?? ''))?.url ?? null;
  } catch { return null; }
}

// ── Parseri katram failam (pēc galvenes nosaukumiem) ──
type Lig = { reg: string; project: string | null; procNr: string | null; veids: string | null; date: string | null; value: number; below: boolean };
function parseLigumi(text: string): Lig[] {
  const rows = parseCSV(text); if (rows.length < 2) return [];
  const ix = headerIdx(rows[0]);
  const cProj = ix('ProjektaNumurs'), cVeids = ix('IepirkumaProcedurasVeids'), cProc = ix('IepirkumaProcedurasIdentifikacijasNr');
  const cDate = ix('LemumaPublicesanasDatums'), cReg = ix('IzpilditajaRegNo');
  // Summa: kolonna mainās starp periodiem (UzProjektuAttiecinamaSummaBezPvn / SummaBezPvn).
  const cVal = [ix('UzProjektuAttiecinamaSummaBezPvn'), ix('SummaBezPvn')].find((i) => i >= 0) ?? -1;
  const out: Lig[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const reg = (r[cReg] ?? '').trim(); if (!reg) continue;
    const veids = clean(r[cVeids]);
    out.push({ reg, project: clean(r[cProj]), procNr: clean(r[cProc]), veids,
      date: (r[cDate] ?? '').slice(0, 10) || null, value: Number(r[cVal]) || 0, below: /zemsliek/i.test(veids ?? '') });
  }
  return out;
}
function parseSaraksts(text: string): Record<string, CflaProject> {
  const rows = parseCSV(text); if (rows.length < 2) return {};
  const ix = headerIdx(rows[0]);
  const cProj = ix('ProjektaNumurs'), cName = ix('ProjektaNosaukums'), cStatus = ix('ProjektaStatuss');
  const cFund = [ix('EsFonds'), ix('Fonds')].find((i) => i >= 0) ?? -1;
  const out: Record<string, CflaProject> = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const p = clean(r[cProj]); if (!p) continue;
    out[p] = { fund: clean(r[cFund]), name: clean(r[cName]), status: clean(r[cStatus]) };
  }
  return out;
}
function parsePartneri(text: string): Record<string, CflaPartner[]> {
  const rows = parseCSV(text); if (rows.length < 2) return {};
  const ix = headerIdx(rows[0]);
  const cProj = ix('ProjektaNumurs'), cName = ix('Nosaukums'), cReg = ix('RegNr');
  const out: Record<string, CflaPartner[]> = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; const p = clean(r[cProj]); const reg = (r[cReg] ?? '').trim(); if (!p || !reg) continue;
    (out[p] ??= []).push({ reg, name: clean(r[cName]) });
  }
  return out;
}
function parsePlan(text: string): Record<string, number> {
  const rows = parseCSV(text); if (rows.length < 2) return {};
  const ix = headerIdx(rows[0]); const cProj = ix('ProjektaNumurs');
  const out: Record<string, number> = {};
  for (let i = 1; i < rows.length; i++) { const p = clean(rows[i][cProj]); if (p) out[p] = (out[p] ?? 0) + 1; }
  return out;
}

// Lejupielādē visus CFLA failus, sasaista ar uzvarētājiem un saglabā kompaktu cfla.json.
export async function buildCflaMap(winnerRegs: Set<string>, savePath: string): Promise<void> {
  // Resursu URL (dinamiski, lai izturētu id maiņas).
  const [lig1420, lig2127, sar1420, sar2127, par1420, par2127, pl1420, pl2127] = await Promise.all([
    resolveRes(DS_1420, /iepirkum.*l[īi]gum/i), resolveRes(DS_2127, /iepirkum.*l[īi]gum/i),
    resolveRes(DS_1420, /projektu saraksts/i), resolveRes(DS_2127, /projektu saraksts/i),
    resolveRes(DS_1420, /sadarb[īi]bas partner/i), resolveRes(DS_2127, /sadarb[īi]bas partner/i),
    resolveRes(DS_1420, /iepirkum.*pl[āa]n/i), resolveRes(DS_2127, /iepirkum.*pl[āa]n/i),
  ]);
  const fetchAll = async (urls: (string | null)[]) => Promise.all(urls.map((u) => (u ? get(u) : Promise.resolve(''))));
  const [ligA, ligB, sarA, sarB, parA, parB, plA, plB] = await fetchAll([lig1420, lig2127, sar1420, sar2127, par1420, par2127, pl1420, pl2127]);

  // Projekti, partneri, plāns (abu periodu apvienojums).
  const projects: Record<string, CflaProject> = { ...parseSaraksts(sarA), ...parseSaraksts(sarB) };
  const partnersAll: Record<string, CflaPartner[]> = { ...parsePartneri(parA), ...parsePartneri(parB) };
  const planAll: Record<string, number> = { ...parsePlan(plA), ...parsePlan(plB) };

  // Līgumi → tikai mūsu uzvarētājiem, bagātināti ar fondu + projekta nosaukumu.
  const byWinner: Record<string, CflaContract[]> = {};
  const relevantProjects = new Set<string>();
  for (const lig of [parseLigumi(ligA), parseLigumi(ligB)]) for (const r of lig) {
    if (!winnerRegs.has(r.reg)) continue;
    const pj = r.project ? projects[r.project] : undefined;
    (byWinner[r.reg] ??= []).push({
      project: r.project, projectName: pj?.name ?? null, fund: pj?.fund ?? null,
      procNr: r.procNr, veids: r.veids, date: r.date, value: r.value, below: r.below,
    });
    if (r.project) relevantProjects.add(r.project);
  }
  for (const reg of Object.keys(byWinner)) byWinner[reg] = byWinner[reg].sort((a, b) => b.value - a.value).slice(0, 100);

  // Ierobežo projektu/partneru/plāna kartes uz tikai būtiskajiem projektiem (faila izmēram).
  const projOut: Record<string, CflaProject> = {};
  const parOut: Record<string, CflaPartner[]> = {};
  const planOut: Record<string, number> = {};
  for (const p of relevantProjects) {
    if (projects[p]) projOut[p] = projects[p];
    if (partnersAll[p]) parOut[p] = partnersAll[p].slice(0, 60);
    if (planAll[p]) planOut[p] = planAll[p];
  }
  const data: CflaData = { byWinner, projects: projOut, partners: parOut, plan: planOut };
  writeFileSync(savePath, JSON.stringify(data));
}
