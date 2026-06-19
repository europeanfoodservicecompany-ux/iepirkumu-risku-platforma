// Raksta frontend datus: index.json (mazs), sectors.json, buyers/<id>.json (detaļas pēc pieprasījuma).
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Lot } from '../../engine/src/types.ts';
import type { EngineOutput } from '../../engine/src/index.ts';
import { computeSectorStats, computeClosedMarkets, IndicatorB1 } from '../../engine/src/index.ts';

export function writeDataset(dataDir: string, output: EngineOutput, lots: Lot[], coverage: string, source: string) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const buyersDir = join(dataDir, 'buyers');
  mkdirSync(buyersDir, { recursive: true }); // pārraksta failus; dzēšana nav vajadzīga

  const meta = { coverage, source, generatedAt: new Date().toISOString(), lots: lots.length, buyers: output.buyers.length };

  // index.json — viegls saraksts meklēšanai/rangam (bez detaļām).
  const index = {
    meta, national: output.national,
    buyers: output.buyers.map((b) => ({
      buyerId: b.buyerId, buyerName: b.buyerName,
      combinedScore: b.combinedScore, combinedLevel: b.combinedLevel,
      layerScores: b.layerScores,
      levels: { B1: b.result.level, B2: b.b2.level, A: b.a.level, C: b.c.level, E: b.e.level, D: b.d.level, G: b.g.level },
      scores: { B1: b.result.score, B2: b.b2.score, A: b.a.score, C: b.c.score, E: b.e.score, D: b.d.score, G: b.g.score },
    })),
  };
  writeFileSync(join(dataDir, 'index.json'), JSON.stringify(index));

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
