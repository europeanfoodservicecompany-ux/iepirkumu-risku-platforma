// Pilna plūsma: (ievākšana →) parsēšana → indikatoru aprēķins → izvade data/ mapē.
//
//   node src/run.ts                       → noklusējums: 3 mēnešu reālie PARSĒTIE dati (offline, bez tīkla)
//   node src/run.ts --raw                 → parsē pievienoto raw paraugu (iub_sample.json) — parsētāja demo
//   node src/run.ts 2025-01-01 2025-04-04 → ievāc REĀLOS IUB datus par diapazonu (tīkls)
//
// Izvadi data/engine_output.json lasa frontend.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import type { Lot } from '../../engine/src/types.ts';
import { parseNotices, parseActiveTenders, filterOpenTenders, parseModifications, groupModificationsByBuyer } from './parse.ts';
import { loadRegistrationMap, buildRegistrationMap } from './ur.ts';
import { writeDataset } from './output.ts';
import { runEngine, markDuplicateValues } from '../../engine/src/index.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../../..');
const DATA = join(ROOT, 'data');
const SAMPLE_LOTS = join(__dir, '..', 'sample', 'lots.sample.json');
const SAMPLE_RAW = join(__dir, '..', 'sample', 'iub_sample.json');

function dedupeById(lots: Lot[]): Lot[] {
  const m = new Map<string, Lot>();
  for (const l of lots) { l.id = String(l.id); m.set(l.id, l); }
  return [...m.values()];
}

async function loadLots(): Promise<{ lots: Lot[]; source: string; coverage: string; notices?: any[] }> {
  const args = process.argv.slice(2);
  if (args[0] === '--raw') {
    const notices = JSON.parse(readFileSync(SAMPLE_RAW, 'utf8'));
    return { lots: dedupeById(parseNotices(notices)), source: 'raw paraugs (iub_sample.json)', coverage: 'paraugs' };
  }
  if (args[0] === '--since' && args[1]) {
    // VISA vēsture: no fiksēta sākuma datuma līdz vakardienai (lieto automātiskā atjaunošana).
    // Tā aptvērums vienmēr aug un nekad nepamet sākumu (IUB dati sākas 2023-10-25).
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const from = args[1];
    const to = iso(new Date(Date.now() - 86400000));
    const { fetchRange } = await import('./fetch.ts');
    console.log(`Ievācu visu vēsturi: ${from} … ${to}`);
    const notices = await fetchRange(from, to);
    return { lots: dedupeById(parseNotices(notices)), source: 'IUB visa vēsture', coverage: `${from} … ${to}`, notices };
  }
  if (args[0] === '--days' && args[1]) {
    // Slīdošais logs: pēdējās N dienas līdz vakardienai.
    const n = parseInt(args[1], 10);
    const to = new Date(Date.now() - 86400000);
    const from = new Date(to.getTime() - (n - 1) * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const { fetchRange } = await import('./fetch.ts');
    console.log(`Ievācu pēdējās ${n} dienas: ${iso(from)} … ${iso(to)}`);
    const notices = await fetchRange(iso(from), iso(to));
    return { lots: dedupeById(parseNotices(notices)), source: `IUB pēdējās ${n} dienas`, coverage: `${iso(from)} … ${iso(to)}`, notices };
  }
  if (args[0] && args[1]) {
    const { fetchRange } = await import('./fetch.ts');
    console.log(`Ievācu reālos IUB datus ${args[0]} … ${args[1]}`);
    const notices = await fetchRange(args[0], args[1]);
    return { lots: dedupeById(parseNotices(notices)), source: `IUB ${args[0]}..${args[1]}`, coverage: `${args[0]} … ${args[1]}`, notices };
  }
  if (!existsSync(SAMPLE_LOTS)) {
    console.error(`Nav parauga (${SAMPLE_LOTS}). Palaid ar diapazonu: node src/run.ts 2025-01-01 2025-04-04`);
    process.exit(1);
  }
  return { lots: dedupeById(JSON.parse(readFileSync(SAMPLE_LOTS, 'utf8'))), source: 'pievienotie reālie dati', coverage: '2025-06-18 … 2026-06-17' };
}

const { lots, source, coverage, notices } = await loadLots();
const dupMarked = markDuplicateValues(lots);
console.log(`Atzīmēti vērtību dublikāti (ietvara/bloka atkārtojumi): ${dupMarked}`);

// UR reģistrācijas dati D indikatoram. Atjauno tikai tīkla (fetch) ceļā: lejupielādē UR reģistru
// un saglabā kompaktu karti TIKAI pašreizējiem uzvarētājiem (tā D segums nenoveco, kā tas notiktu ar
// statisku karti). Ja lejupielāde neizdodas — izmanto esošo failu.
const UR_PATH = join(ROOT, 'data', 'ur_registration.json');
let companyReg = new Map();
if (notices) {
  const winnerCodes = new Set(lots.map((l) => l.winnerId).filter((x): x is string => !!x));
  try {
    console.log(`Atjaunoju UR reģistrācijas datus ${winnerCodes.size} uzvarētājiem…`);
    await buildRegistrationMap(winnerCodes, UR_PATH);
  } catch (e) {
    console.warn(`UR atjaunošana neizdevās (${String(e)}); izmantoju esošo failu.`);
  }
}
if (existsSync(UR_PATH)) {
  companyReg = loadRegistrationMap(UR_PATH);
  console.log(`UR reģistrācijas dati: ${companyReg.size} uzņēmumi`);
} else {
  console.log('UR dati nav atrasti (D indikators būs "nepietiek datu"). Skat. packages/ingest/src/ur.ts.');
}

// Līguma grozījumi (cont-modif) G indikatoram — tikai fetch ceļā (jēlpaziņojumi pieejami).
let modifications = new Map();
if (notices) {
  const mods = parseModifications(notices);
  modifications = groupModificationsByBuyer(mods);
  writeFileSync(join(DATA, 'modifications.json'), JSON.stringify({ count: mods.length, modifications: mods }));
  console.log(`Līguma grozījumi (cont-modif): ${mods.length}`);
}

const output = runEngine(lots, { companyReg, modifications });
(output as any).meta = { source, generatedAt: new Date().toISOString(), lots: lots.length };

if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
writeDataset(DATA, output, lots, coverage, source);

// Aktuālie (vēl atvērtie) konkursi — tikai ja ievācām jēlpaziņojumus (fetch ceļš).
if (notices) {
  const today = new Date().toISOString().slice(0, 10);
  const open = filterOpenTenders(parseActiveTenders(notices), today);
  writeFileSync(join(DATA, 'active.json'), JSON.stringify({ meta: { generatedAt: new Date().toISOString(), asOf: today, count: open.length }, tenders: open }));
  console.log(`Aktuālie konkursi (atvērti): ${open.length}`);
}

const flagged = output.lotResults.filter((r) => r.status === 'RiskFound').length;
const scored = output.buyers.filter((b) => b.result.score !== null).length;
console.log('\n──────── KOPSAVILKUMS ────────');
console.log(`Avots:                  ${source}`);
console.log(`Iepirkuma daļas (lots): ${lots.length}`);
console.log(`Pasūtītāji:             ${output.buyers.length} (ar pietiekamu paraugu ≥10: ${scored})`);
console.log(`Nacionālā bāze:         ${(output.national.singleBidRate * 100).toFixed(1)}% viena pretendenta ` +
            `(${output.national.singleBidLots}/${output.national.winnerChosenLots})`);
console.log(`Karogotie iepirkumi:    ${flagged}`);
console.log(`Sarkani/dzelteni pasūtītāji: ${output.buyers.filter(b=>b.result.level==='red').length}/` +
            `${output.buyers.filter(b=>b.result.level==='yellow').length}`);
console.log(`Izvade:                 data/engine_output.json, data/lots.json`);
