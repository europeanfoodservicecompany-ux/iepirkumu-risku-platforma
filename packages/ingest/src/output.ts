// Raksta frontend datus: index.json (mazs), sectors.json, buyers/<id>.json (detaļas pēc pieprasījuma).
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Lot } from '../../engine/src/types.ts';
import type { EngineOutput } from '../../engine/src/index.ts';
import { computeSectorStats, computeClosedMarkets, computeWinners, IndicatorB1, sectorLabel, regionLabel } from '../../engine/src/index.ts';

export function writeDataset(dataDir: string, output: EngineOutput, lots: Lot[], coverage: string, source: string) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const buyersDir = join(dataDir, 'buyers');
  mkdirSync(buyersDir, { recursive: true }); // pārraksta failus; dzēšana nav vajadzīga

  const meta = { coverage, source, generatedAt: new Date().toISOString(), lots: lots.length, buyers: output.buyers.length };

  // Pasūtītāja papildlauki filtriem: kopvērtība, galvenā nozare (CPV2), reģions (NUTS).
  type Enr = { value: number; sectorVal: Map<string, number>; nuts: Map<string, number> };
  const enr = new Map<string, Enr>();
  for (const l of lots) {
    if (!l.winnerChosen) continue;
    const e = enr.get(l.buyerId) ?? { value: 0, sectorVal: new Map(), nuts: new Map() };
    e.value += l.awardValue ?? 0;
    if (l.cpv) { const c = l.cpv.replace(/[^0-9]/g, '').slice(0, 2); if (c) e.sectorVal.set(c, (e.sectorVal.get(c) ?? 0) + (l.awardValue ?? 0) + 1); }
    if (l.nutsCode) e.nuts.set(l.nutsCode, (e.nuts.get(l.nutsCode) ?? 0) + 1);
    enr.set(l.buyerId, e);
  }
  const topKey = (m: Map<string, number>): string | null => { let k: string | null = null, v = -1; for (const [kk, vv] of m) if (vv > v) { v = vv; k = kk; } return k; };

  // index.json — viegls saraksts meklēšanai/rangam/filtriem (bez detaļām).
  const index = {
    meta, national: output.national,
    buyers: output.buyers.map((b) => {
      const e = enr.get(b.buyerId);
      const cpv2 = e ? topKey(e.sectorVal) : null;
      const nuts = e ? topKey(e.nuts) : null;
      return {
        buyerId: b.buyerId, buyerName: b.buyerName,
        combinedScore: b.combinedScore, combinedLevel: b.combinedLevel,
        layerScores: b.layerScores,
        value: e ? Math.round(e.value) : 0,
        sectorCpv2: cpv2, sectorLabel: cpv2 ? sectorLabel(cpv2) : null,
        region: regionLabel(nuts),
        levels: { B1: b.result.level, B2: b.b2.level, A: b.a.level, C: b.c.level, E: b.e.level, D: b.d.level, G: b.g.level },
        scores: { B1: b.result.score, B2: b.b2.score, A: b.a.score, C: b.c.score, E: b.e.score, D: b.d.score, G: b.g.score },
      };
    }),
  };
  writeFileSync(join(dataDir, 'index.json'), JSON.stringify(index));

  // ── Piegādātāji (uzvarētāji) ──
  // Drošs faila nosaukums (reģ.nr. var saturēt /, ārvalstu formātus). fileId glabājas indeksā,
  // lai frontend zina, kuru failu pieprasīt. Sadursmes risinām ar sufiksu.
  const winners = computeWinners(lots);
  const winnersDir = join(dataDir, 'winners');
  mkdirSync(winnersDir, { recursive: true });
  const usedFileIds = new Set<string>();
  const fileIdOf = (id: string): string => {
    let base = id.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
    let fid = base; let i = 1;
    while (usedFileIds.has(fid)) fid = `${base}-${i++}`;
    usedFileIds.add(fid);
    return fid;
  };
  const fileIds = winners.map((w) => fileIdOf(w.winnerId));
  writeFileSync(join(dataDir, 'winners-index.json'), JSON.stringify({
    meta,
    winners: winners.map((w, i) => ({
      winnerId: w.winnerId, fileId: fileIds[i], winnerName: w.winnerName, contracts: w.contracts, value: w.awardedValue,
      buyers: w.buyers, singleBidRate: w.singleBidRate, topBuyerShare: w.topBuyerShare,
      sectorCpv2: w.sectorCpv2, sectorLabel: w.sectorLabel,
    })),
  }));
  for (let i = 0; i < winners.length; i++) {
    writeFileSync(join(winnersDir, `${fileIds[i]}.json`), JSON.stringify({ ...winners[i], fileId: fileIds[i], meta }));
  }

  // sectors.json — nozaru agregāts.
  const b1 = new IndicatorB1();
  writeFileSync(join(dataDir, 'sectors.json'), JSON.stringify({
    meta, national: output.national, sectors: computeSectorStats(lots, (l) => b1.appliesTo(l)),
  }));

  // markets.json — slēgtā tirgus indikators (karteļa proxy), top 120 pēc score.
  writeFileSync(join(dataDir, 'markets.json'), JSON.stringify({
    meta, national: output.national,
    markets: computeClosedMarkets(lots, 4, 10, (l) => b1.appliesTo(l)).slice(0, 120),
  }));

  // buyers/<id>.json — pilnas detaļas (ielādē atverot profilu).
  for (const b of output.buyers) {
    writeFileSync(join(buyersDir, `${b.buyerId}.json`), JSON.stringify({
      ...b, flaggedLots: b.flaggedLots.slice(0, 50), meta,
    }));
  }

  // lots.json — pilni dati (datu kopa / atkārtotai apstrādei), nelasa frontend.
  writeFileSync(join(dataDir, 'lots.json'), JSON.stringify(lots));
  return meta;
}
