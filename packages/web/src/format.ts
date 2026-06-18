import type { RiskResult } from './types.ts';

export type BandKey = 'red' | 'yellow' | 'green' | 'gray';

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
  const nat = pct(nationalAvg, 0);
  const ratio = fmtRatio(d.relativeRatio);
  if (r.level === 'red') return `Viena pretendenta īpatsvars ${rate} — ${ratio} virs nacionālā vidējā (${nat}). Prioritāra pārbaude.`;
  if (r.level === 'yellow') return `Viena pretendenta īpatsvars ${rate} — paaugstināts pret nacionālo vidējo (${nat}).`;
  return `Viena pretendenta īpatsvars ${rate} — tuvu vai zem nacionālā vidējā (${nat}).`;
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
