import type { RiskResult } from './types.ts';

export type BandKey = 'red' | 'yellow' | 'green' | 'gray';

// Meklēšanas normalizācija: mazie burti + noņem diakritiku ("Rīga"→"riga", "Ķekava"→"kekava").
// Precomponētam ievadam (kā šie dati) garums saglabājas, tāpēc izcēluma indeksi paliek saskaņoti.
export function norm(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Robežota Levenšteina distance (early-exit pie >max) — typo tolerancei meklēšanā.
export function levLE(a: string, b: string, max = 1): boolean {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return false;
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur[j] = v; if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false; // neviena rinda vairs nevar sasniegt ≤max
    prev = cur;
  }
  return prev[lb] <= max;
}

// Meklēšanas vaicājuma tokeni (normalizēti, ≥2 simboli).
export function queryTokens(q: string): string[] {
  return norm(q).split(/\s+/).filter((t) => t.length >= 2);
}

// Skaitliskas summas parsēšana meklēšanā: "500k"→500000, "1.5m"→1500000, "100000"→100000.
// Atbalsta k / tūkst un m / milj sufiksus; atgriež null, ja nav derīgs skaitlis.
export function parseAmount(s: string): number | null {
  const t = norm(s).replace(/\s/g, '');
  const mm = t.match(/^([0-9]+(?:[.,][0-9]+)?)(k|tukst|m|milj)?$/);
  if (!mm) return null;
  const n = parseFloat(mm[1].replace(',', '.'));
  if (!isFinite(n)) return null;
  const mult = mm[2] === 'k' || mm[2] === 'tukst' ? 1e3 : mm[2] === 'm' || mm[2] === 'milj' ? 1e6 : 1;
  return n * mult;
}

export interface SearchQuery {
  raw: string;           // brīvais teksts (vārds/nosaukums) izcēlumam un tokeniem
  tokens: string[];      // normalizēti brīvā teksta tokeni
  reg: string | null;    // reg:… — reģ.nr / personas koda cipari (prefikss)
  cpv: string | null;    // cpv:… — CPV kods (cipari)
  minVal: number | null; // >summa
  maxVal: number | null; // <summa
  structured: boolean;   // vai ir kāds prefikss (reg/cpv/summa) — tad ignorē min. sliekšņus kā meklēšanā
}

// Parsē strukturēto meklēšanu: prefiksi reg:, cpv:, >summa, <summa; pārējais paliek brīvais teksts.
// Piemēri: "reg:40003", "cpv:45", ">1m", "<500k", "reg:4000 celtne".
export function parseSearch(q: string): SearchQuery {
  let reg: string | null = null, cpv: string | null = null;
  let minVal: number | null = null, maxVal: number | null = null;
  const rest: string[] = [];
  for (const part of (q ?? '').trim().split(/\s+/)) {
    if (!part) continue;
    const low = part.toLowerCase();
    let m: RegExpMatchArray | null;
    if ((m = low.match(/^reg:(.*)$/))) { const d = m[1].replace(/\D/g, ''); if (d) reg = d; continue; }
    if ((m = low.match(/^cpv:(.*)$/))) { const d = m[1].replace(/\D/g, ''); if (d) cpv = d; continue; }
    if ((m = part.match(/^([<>])=?(.+)$/))) { const v = parseAmount(m[2]); if (v != null) { if (m[1] === '>') minVal = v; else maxVal = v; continue; } }
    rest.push(part);
  }
  const raw = rest.join(' ');
  const structured = reg != null || cpv != null || minVal != null || maxVal != null;
  return { raw, tokens: queryTokens(raw), reg, cpv, minVal, maxVal, structured };
}

// Tokenu + typo-tolerantā sakritība: KATRAM tokenam jāsakrīt (jebkurā secībā) vai nu kā
// apakšvirknei, vai (garākiem tokeniem) ar Levenšteina distanci ≤1 pret kādu vārdu. hayNorm jau normalizēts.
export function tokenMatch(hayNorm: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  let words: string[] | null = null;
  return tokens.every((t) => {
    if (hayNorm.includes(t)) return true;
    if (t.length < 5) return false; // typo toleranci tikai garākiem tokeniem (mazāk viltus sakritību)
    if (!words) words = hayNorm.split(/\s+/);
    return words.some((w) => levLE(w, t, 1));
  });
}

// ── Mazās izlases disciplīna ──
// Vilsona ticamības intervāla apakšējā robeža proporcijai k/n (noklusējums 95%, z=1.96).
// Konservatīvs "cik ticami likme tiešām ir vismaz šī" novērtējums: pie mazas izlases robeža
// krīt tuvu nullei, tāpēc 1/1=100% vairs neizskatās kā stabils 100%. k=viltus, n=novērojumi.
export function wilsonLower(k: number, n: number, z = 1.96): number {
  if (n <= 0) return 0;
  const p = Math.min(1, Math.max(0, k / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return Math.max(0, (center - margin) / denom);
}

// Izlases kvalitātes klase pēc novērojumu skaita — attēlojumam (birka + brīdinājums).
// 'low' → rādīt "maza izlase"; 'mid' → dzeltens konteksts; 'ok' → pietiekami.
export function sampleClass(n: number): 'low' | 'mid' | 'ok' {
  if (n < 5) return 'low';
  if (n < 12) return 'mid';
  return 'ok';
}

// Pasūtītāja rezultāts → krāsas josla + latvisks apzīmējums.
export function buyerBand(r: RiskResult): { key: BandKey; label: string } {
  if (r.status === 'NoData' || r.score === null) return { key: 'gray', label: 'Nepietiek datu' };
  if (r.level === 'red') return { key: 'red', label: 'Augsts risks' };
  if (r.level === 'yellow') return { key: 'yellow', label: 'Vērts pārbaudīt' };
  return { key: 'green', label: 'Zems' };
}

export function pct(x: number | undefined | null, dp = 0): string {
  if (x === undefined || x === null) return '–';
  return (x * 100).toFixed(dp) + '%';
}

export function fmtRatio(x: number | undefined | null): string {
  if (x === undefined || x === null) return '–';
  return x.toFixed(2) + '×';
}

// Viena teikuma kopsavilkums pasūtītāja profilam.
export function buyerSummary(r: RiskResult, nationalAvg: number): string {
  const d = r.detail ?? {};
  if (r.status === 'NoData' || r.score === null) {
    return `Pārāk maz iepirkumu ar izvēlētu uzvarētāju (${d.winnerChosenLots ?? 0}), lai aprēķinātu ticamu rādītāju.`;
  }
  const rate = pct(d.singleBidRate, 0);
  const exp = pct(d.expectedRate ?? nationalAvg, 0); // nozarei sagaidāmā (vērtības-svērtā) likme
  const ratio = fmtRatio(d.relativeRatio);
  if (r.level === 'red') return `Viena pretendenta īpatsvars ${rate}. Vērtības-svērti ${ratio} virs nozarei sagaidāmā līmeņa (${exp}). Prioritāra pārbaude.`;
  if (r.level === 'yellow') return `Viena pretendenta īpatsvars ${rate}. Vērtības-svērti paaugstināts pret nozarei sagaidāmo (${exp}).`;
  return `Viena pretendenta īpatsvars ${rate}. Vērtības-svērti tuvu vai zem nozarei sagaidāmā (${exp}).`;
}

// Viena teikuma kopsavilkums B2 (uzvarētāju koncentrācija).
export function b2Summary(r: RiskResult): string {
  const d = r.detail ?? {};
  if (r.status === 'NoData' || r.score === null) {
    return `Pārāk maz piešķirtu līgumu (${d.awardedLots ?? 0}), lai novērtētu koncentrāciju.`;
  }
  const top = pct(d.topWinnerShare, 0);
  const name = d.topWinnerName ?? 'lielākais uzvarētājs';
  const basis = d.basis === 'value' ? 'līgumvērtības' : 'līgumu skaita';
  if (r.level === 'red') return `Augsta koncentrācija: ${top} no ${basis} nonāk pie viena uzvarētāja (${name}). HHI ${d.hhi}.`;
  if (r.level === 'yellow') return `Mērena koncentrācija: lielākais uzvarētājs (${name}) saņem ${top} no ${basis}. HHI ${d.hhi}.`;
  return `Uzvarētāji izkliedēti starp ${d.distinctWinners ?? '?'} piegādātājiem. HHI ${d.hhi}.`;
}

// EUR formatēšana.
export function eur(x: number | undefined | null): string {
  if (x === undefined || x === null) return '–';
  return new Intl.NumberFormat('lv-LV', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x);
}

// Viena teikuma kopsavilkums A (sadalīšana).
export function aSummary(r: RiskResult): string {
  const d = r.detail ?? {};
  const n = d.clusterCount ?? 0;
  if (r.status === 'NoData') return 'Nepietiek datu sadalīšanas analīzei.';
  if (n === 0) return 'Nav atrastu sadalīšanas pazīmju šajā datu periodā.';
  const word = n === 1 ? 'aizdomīga kopa' : (n < 10 ? 'aizdomīgas kopas' : 'aizdomīgu kopu');
  return `Atrasta${n === 1 ? '' : 's'} ${n} ${word}: vairāki tuvu-slieksnim līgumi vienā CPV īsā laikā, kas kopā pārsniedz procedūras slieksni.`;
}

// Viena teikuma kopsavilkums C (cenu/vērtības novirze).
export function cSummary(r: RiskResult): string {
  const d = r.detail ?? {};
  if (r.status === 'NoData') return 'Nav pietiekami salīdzināmu līgumu tajās pašās CPV kategorijās.';
  const n = (d.priceFlags ?? []).length;
  if (n === 0 || r.score === 0) return 'Līgumvērtības atbilst līdzīgu iepirkumu sadalījumam.';
  return `${n} līgum${n === 1 ? 's' : 'i'} ar neparasti augstu vērtību attiecīgajā CPV kategorijā (augstākā novirze z=${d.maxZ}). Tas var nozīmēt arī vienkārši lielāku iepirkumu — jāpārbauda.`;
}

// Kopsavilkums E (procedūras integritāte).
export function eSummary(r: RiskResult): string {
  const d = r.detail ?? {};
  if (r.status === 'NoData') return 'Nepietiek datu procedūru analīzei.';
  const n = d.nonCompetitiveLots ?? 0;
  if (n === 0 || r.score === 0) return 'Nav konstatētas sarunu procedūras bez konkurences.';
  return `${n} iepirkum${n === 1 ? 's' : 'i'} (${pct(d.nonCompetitiveShare, 0)}) veikti sarunu procedūrā bez iepriekšējas konkurences izsludināšanas.`;
}

// Kopsavilkums D (saistītās puses / jauni uzvarētāji).
export function dSummary(r: RiskResult): string {
  const d = r.detail ?? {};
  if (r.status === 'NoData') return 'Nepietiek datu ar uzvarētāju reģistrācijas datumiem.';
  const n = d.newWinnerAwards ?? 0;
  if (n === 0 || r.score === 0) return 'Nav nesen dibinātu uzvarētāju.';
  return `${n} līgum${n === 1 ? 's' : 'i'} piešķirt${n === 1 ? 's' : 'i'} uzņēmumam, kas reģistrēts īsi pirms uzvaras${(d.veryNewAwards ?? 0) > 0 ? ' (t.sk. ļoti jauns uzņēmums)' : ''} — saistīto pušu riska signāls.`;
}

// Kopsavilkums G (līguma grozījumi / scope creep).
export function gSummary(r: RiskResult): string {
  const d = r.detail ?? {};
  if (r.status === 'NoData') return 'Nepietiek līgumu grozījumu analīzei.';
  const n = d.substantiveContracts ?? 0;
  if (n === 0 || r.score === 0) return 'Nav konstatēti būtiski līguma grozījumi (papildu darbi / izpildītāja maiņa).';
  return `${n} no ${d.contracts ?? '?'} līgumiem pēc uzvaras grozīti ar papildu darbiem vai izpildītāja maiņu (${pct(d.substantiveRate, 0)}). Var liecināt par cenas/apjoma uzpūšanu pēc uzvaras — jāpārbauda.`;
}

// Krāsas josla no rādītāja + līmeņa (indeksa datiem, kur nav pilna RiskResult).
export function bandFromScore(score: number | null, level: 'red' | 'yellow' | null): BandKey {
  if (score === null) return 'gray';
  if (level === 'red') return 'red';
  if (level === 'yellow') return 'yellow';
  return 'green';
}

// CSV lejupielāde (UTF-8 BOM + ; delimiters — atveras pareizi LV Excel).
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
