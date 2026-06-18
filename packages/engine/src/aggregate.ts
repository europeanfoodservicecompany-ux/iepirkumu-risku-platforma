import type { Lot, CpvStat } from './types.ts';
import { isSingleBid } from './indicators/B1.ts';

export type NationalBaseline = {
  singleBidLots: number;
  winnerChosenLots: number;
  singleBidRate: number; // 0..1
};

// Nacionālā bāze B1 (spec 4.3): kopējais viena-pretendenta īpatsvars
// pa visām attiecināmajām daļām ar izvēlētu uzvarētāju.
export function computeNationalBaseline(
  lots: Lot[],
  appliesTo: (l: Lot) => boolean,
): NationalBaseline {
  const eligible = lots.filter((l) => appliesTo(l) && l.winnerChosen === true);
  const winnerChosenLots = eligible.length;
  const singleBidLots = eligible.filter(isSingleBid).length;
  const singleBidRate = winnerChosenLots > 0 ? singleBidLots / winnerChosenLots : 0;
  return { singleBidLots, winnerChosenLots, singleBidRate };
}

export function groupByBuyer(lots: Lot[]): Map<string, Lot[]> {
  const m = new Map<string, Lot[]>();
  for (const lot of lots) {
    const arr = m.get(lot.buyerId);
    if (arr) arr.push(lot);
    else m.set(lot.buyerId, [lot]);
  }
  return m;
}


export function cpvKey(cpv: string | null | undefined, digits: number): string {
  return (cpv ?? '').replace(/[^0-9]/g, '').slice(0, digits) || '????';
}

// Nacionālais CPV vērtību sadalījums (uz ln(vērtības)) — vidējais, izlases std, skaits.
// Lieto C indikators z-score aprēķinam. Iekļauj tikai līgumus ar pozitīvu vērtību.
export function computeCpvPriceStats(lots: Lot[], digits: number, minObs: number): Map<string, CpvStat> {
  const buckets = new Map<string, number[]>();
  for (const l of lots) {
    if (l.winnerChosen && l.awardValue != null && l.awardValue > 0 && l.cpv) {
      const k = cpvKey(l.cpv, digits);
      const ln = Math.log(l.awardValue);
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(ln);
    }
  }
  const stats = new Map<string, CpvStat>();
  for (const [k, vals] of buckets) {
    if (vals.length < minObs) continue;
    const n = vals.length;
    const mean = vals.reduce((s, v) => s + v, 0) / n;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1); // izlases dispersija
    const std = Math.sqrt(variance);
    stats.set(k, { mean, std, count: n });
  }
  return stats;
}

// ── Nozaru (CPV divīziju) agregāts ──
const CPV_DIVISIONS: Record<string, string> = {
  '03': 'Lauksaimniecība, pārtika', '09': 'Degviela un enerģija', '14': 'Izrakteņi',
  '15': 'Pārtika un dzērieni', '16': 'Lauksaimniecības tehnika', '18': 'Apģērbs, apavi',
  '19': 'Āda, tekstils', '22': 'Iespieddarbi', '24': 'Ķīmiskie produkti', '30': 'Biroja un datortehnika',
  '31': 'Elektroiekārtas', '32': 'Sakaru iekārtas', '33': 'Medicīna, farmācija', '34': 'Transportlīdzekļi',
  '35': 'Drošība, aizsardzība', '37': 'Mūzika, sports', '38': 'Laboratorijas, optika',
  '39': 'Mēbeles, tīrīšana', '41': 'Ūdens', '42': 'Rūpnieciskās iekārtas', '43': 'Ieguves iekārtas',
  '44': 'Būvmateriāli', '45': 'Būvdarbi', '48': 'Programmatūra', '50': 'Remonts, uzturēšana',
  '51': 'Iekārtu uzstādīšana', '55': 'Viesnīcas, ēdināšana', '60': 'Transports', '63': 'Transporta atbalsts',
  '64': 'Pasts, telekomunikācijas', '65': 'Komunālie pakalpojumi', '66': 'Finanses, apdrošināšana',
  '70': 'Nekustamais īpašums', '71': 'Arhitektūra, inženierija', '72': 'IT pakalpojumi',
  '73': 'Pētniecība, izstrāde', '75': 'Valsts pārvalde', '76': 'Naftas/gāzes pakalpojumi',
  '77': 'Lauksaimniecības pakalpojumi', '79': 'Uzņēmējdarbības pakalpojumi', '80': 'Izglītība',
  '85': 'Veselība, sociālā aprūpe', '90': 'Vide, atkritumi', '92': 'Atpūta, kultūra', '98': 'Citi pakalpojumi',
};

export type SectorStat = {
  cpv2: string; label: string;
  contracts: number;       // open/restricted ar uzvarētāju (B1 bāze)
  singleBid: number; singleBidRate: number;
  awardedValue: number;    // visu uzvarēto līgumu kopvērtība
  buyers: number;          // atšķirīgu pasūtītāju skaits
};

export function computeSectorStats(lots: Lot[], b1AppliesTo: (l: Lot) => boolean): SectorStat[] {
  type Acc = { contracts: number; singleBid: number; value: number; buyers: Set<string> };
  const m = new Map<string, Acc>();
  for (const l of lots) {
    if (!l.winnerChosen || !l.cpv) continue;
    const cpv2 = l.cpv.replace(/[^0-9]/g, '').slice(0, 2);
    if (!cpv2) continue;
    const a = m.get(cpv2) ?? m.set(cpv2, { contracts: 0, singleBid: 0, value: 0, buyers: new Set() }).get(cpv2)!;
    a.value += l.awardValue ?? 0;
    a.buyers.add(l.buyerId);
    if (b1AppliesTo(l)) {
      a.contracts++;
      if (l.receivedBids === 1) a.singleBid++;
    }
  }
  const out: SectorStat[] = [];
  for (const [cpv2, a] of m) {
    out.push({
      cpv2, label: CPV_DIVISIONS[cpv2] ?? `CPV ${cpv2}`,
      contracts: a.contracts, singleBid: a.singleBid,
      singleBidRate: a.contracts > 0 ? a.singleBid / a.contracts : 0,
      awardedValue: Math.round(a.value), buyers: a.buyers.size,
    });
  }
  // Sakārto pēc viena-pretendenta likmes (vājākā konkurence augšā), tikai ar pietiekamu apjomu.
  return out.filter((s) => s.contracts >= 10).sort((x, y) => y.singleBidRate - x.singleBidRate);
}

// ── Slēgtā tirgus indikators (karteļa netieša pazīme) ──
// Tirgus (CPV) līmenī: nedaudzi uzvarētāji kontrolē lielāko vērtības daļu (augsts HHI)
// UN augsta viena-pretendenta likme = tirgus faktiski nav konkurētspējīgs.
// PIEZĪME: tas nav karteļa pierādījums — IUB nepublicē zaudētāju identitātes, tāpēc bid-rotation
// nevar pierādīt. Tas izceļ tirgus, ko vērts nodot Konkurences padomei.
export type MarketStat = {
  cpv: string; label: string;
  contracts: number;            // open/restricted ar uzvarētāju
  distinctWinners: number;
  hhi: number;                  // uzvarētāju koncentrācija (pēc vērtības/skaita)
  top1Share: number; top3Share: number;
  singleBidRate: number;
  awardedValue: number;
  topWinners: { id: string; name: string | null; contracts: number; value: number; share: number }[];
  score: number; level: 'red' | 'yellow' | null;
};

export function computeClosedMarkets(
  lots: Lot[], cpvDigits: number, minContracts: number, b1AppliesTo: (l: Lot) => boolean,
): MarketStat[] {
  type W = { contracts: number; value: number; name: string | null };
  type M = { contracts: number; singleBid: number; value: number; byValue: boolean; winners: Map<string, W> };
  const markets = new Map<string, M>();
  for (const l of lots) {
    if (!l.winnerChosen || !l.cpv || !l.winnerId) continue;
    const key = l.cpv.replace(/[^0-9]/g, '').slice(0, cpvDigits);
    if (!key) continue;
    const m = markets.get(key) ?? markets.set(key, { contracts: 0, singleBid: 0, value: 0, byValue: false, winners: new Map() }).get(key)!;
    const w = m.winners.get(l.winnerId) ?? { contracts: 0, value: 0, name: l.winnerName ?? null };
    w.contracts++; w.value += l.awardValue ?? 0; m.winners.set(l.winnerId, w);
    m.value += l.awardValue ?? 0;
    if (b1AppliesTo(l)) { m.contracts++; if (l.receivedBids === 1) m.singleBid++; }
  }

  const out: MarketStat[] = [];
  for (const [cpv, m] of markets) {
    if (m.contracts < minContracts) continue;
    const byValue = m.value > 0;
    const total = byValue ? m.value : [...m.winners.values()].reduce((s, w) => s + w.contracts, 0);
    const shares = [...m.winners.entries()].map(([id, w]) => ({
      id, name: w.name, contracts: w.contracts, value: Math.round(w.value),
      share: (byValue ? w.value : w.contracts) / total,
    })).sort((a, b) => b.share - a.share);
    const hhi = shares.reduce((s, x) => s + x.share * x.share, 0);
    const top1 = shares[0]?.share ?? 0;
    const top3 = shares.slice(0, 3).reduce((s, x) => s + x.share, 0);
    const singleBidRate = m.contracts > 0 ? m.singleBid / m.contracts : 0;
    // Slēgtā tirgus score: koncentrācija (HHI) + zema konkurence (viena pretendenta likme).
    const score = Math.round(clampN(0.6 * hhi * 100 + 0.4 * singleBidRate * 100, 0, 100));
    const level = score >= 55 ? 'red' : score >= 30 ? 'yellow' : null;
    out.push({
      cpv, label: (CPV_DIVISIONS[cpv.slice(0, 2)] ?? 'CPV') + ` (CPV ${cpv})`,
      contracts: m.contracts, distinctWinners: m.winners.size,
      hhi: round2(hhi, 3), top1Share: round2(top1, 3), top3Share: round2(top3, 3),
      singleBidRate: round2(singleBidRate, 3), awardedValue: Math.round(m.value),
      topWinners: shares.slice(0, 5).map((x) => ({ ...x, share: round2(x.share, 3) })),
      score, level,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

function clampN(x: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, x)); }
function round2(x: number, dp: number): number { const f = Math.pow(10, dp); return Math.round(x * f) / f; }
