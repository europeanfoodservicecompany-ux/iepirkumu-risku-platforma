// Raksta frontend datus: index.json (mazs), sectors.json, buyers/<id>.json (detaļas pēc pieprasījuma).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lot } from '../../engine/src/types.ts';
import type { EngineOutput } from '../../engine/src/index.ts';
import { computeSectorStats, computeClosedMarkets, computeWinners, IndicatorB1, sectorLabel, regionLabel } from '../../engine/src/index.ts';
import { parsePersons } from './plg.ts';

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
    if (!l.dupValue) e.value += l.awardValue ?? 0;
    if (l.cpv) { const c = l.cpv.replace(/[^0-9]/g, '').slice(0, 2); if (c) e.sectorVal.set(c, (e.sectorVal.get(c) ?? 0) + (l.awardValue ?? 0) + 1); }
    if (l.nutsCode) e.nuts.set(l.nutsCode, (e.nuts.get(l.nutsCode) ?? 0) + 1);
    enr.set(l.buyerId, e);
  }
  const topKey = (m: Map<string, number>): string | null => { let k: string | null = null, v = -1; for (const [kk, vv] of m) if (vv > v) { v = vv; k = kk; } return k; };

  // Pasūtītāja "kur aiziet nauda": agregāts pa piegādātājiem (vērtība, līgumi, viena pretendenta).
  type Sup = { name: string | null; value: number; contracts: number; singleBid: number };
  const buyerSup = new Map<string, Map<string, Sup>>();
  for (const l of lots) {
    if (!l.winnerChosen || !l.winnerId) continue;
    const m = buyerSup.get(l.buyerId) ?? new Map<string, Sup>();
    const s = m.get(l.winnerId) ?? { name: l.winnerName ?? null, value: 0, contracts: 0, singleBid: 0 };
    if (!l.dupValue) s.value += l.awardValue ?? 0;
    s.contracts++; if (l.receivedBids === 1) s.singleBid++;
    if (!s.name && l.winnerName) s.name = l.winnerName;
    m.set(l.winnerId, s); buyerSup.set(l.buyerId, m);
  }

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
        singleBidRate: (b.result.detail?.singleBidRate as number | undefined) ?? null,
        contracts: (b.result.detail?.winnerChosenLots as number | undefined) ?? null,
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
  const fileIdByWinner = new Map(winners.map((w, i) => [w.winnerId, fileIds[i]]));

  // ── Personas (PLG + valde + prokūristi) ── ielādē data/plg.csv + data/officers.csv un sasaista uzvarētājus pēc kopīgas personas.
  const winnerByReg = new Map(winners.map((w, i) => [w.winnerId, { fileId: fileIds[i], name: w.winnerName, value: w.awardedValue, contracts: w.contracts }]));
  let regPersons = new Map<string, { name: string; id: string; role: string; nat: string | null }[]>();
  let regPersonKeys = new Map<string, { pk: string; name: string; role: string }[]>();
  let personWinners = new Map<string, { name: string; id: string; regs: Set<string>; roleByReg: Map<string, string> }>();
  {
    const plgPath = join(dataDir, 'plg.csv');
    const offPath = join(dataDir, 'officers.csv');
    if (existsSync(plgPath) || existsSync(offPath)) {
      const parsed = parsePersons(
        existsSync(plgPath) ? readFileSync(plgPath, 'utf8') : '',
        existsSync(offPath) ? readFileSync(offPath, 'utf8') : '',
        new Set(winners.map((w) => w.winnerId)),
      );
      regPersons = parsed.regPersons; regPersonKeys = parsed.regPersonKeys; personWinners = parsed.personWinners;
    }
  }
  // Saistītie uzvarētāji (kopīga persona) konkrētam reģ. nr.
  const relatedWinnersFor = (reg: string) => {
    const out: { fileId: string | null; name: string | null; value: number; contracts: number; via: string; role: string }[] = [];
    const seen = new Set<string>();
    for (const { pk, name: viaName, role } of regPersonKeys.get(reg) ?? []) {
      const pw = personWinners.get(pk);
      if (!pw) continue;
      for (const other of pw.regs) {
        if (other === reg || seen.has(other)) continue;
        const w = winnerByReg.get(other);
        if (!w) continue;
        seen.add(other);
        out.push({ fileId: w.fileId, name: w.name, value: w.value, contracts: w.contracts, via: viaName, role });
      }
    }
    return out.sort((a, b) => b.value - a.value).slice(0, 20);
  };
  writeFileSync(join(dataDir, 'winners-index.json'), JSON.stringify({
    meta,
    winners: winners.map((w, i) => ({
      winnerId: w.winnerId, fileId: fileIds[i], winnerName: w.winnerName, contracts: w.contracts, value: w.awardedValue,
      buyers: w.buyers, singleBidRate: w.singleBidRate, topBuyerShare: w.topBuyerShare,
      sectorCpv2: w.sectorCpv2, sectorLabel: w.sectorLabel,
    })),
  }));
  for (let i = 0; i < winners.length; i++) {
    const reg = winners[i].winnerId;
    const persons = regPersons.get(reg) ?? [];
    writeFileSync(join(winnersDir, `${fileIds[i]}.json`), JSON.stringify({
      ...winners[i], fileId: fileIds[i],
      beneficialOwners: persons.filter((p) => p.role === 'PLG').map((p) => ({ name: p.name, id: p.id, nat: p.nat })),
      officers: persons.filter((p) => p.role !== 'PLG').map((p) => ({ name: p.name, id: p.id, role: p.role })),
      relatedWinners: relatedWinnersFor(reg),
      meta,
    }));
  }

  // sectors.json — nozaru agregāts.
  const b1 = new IndicatorB1();
  const sectorStats = computeSectorStats(lots, (l) => b1.appliesTo(l));
  writeFileSync(join(dataDir, 'sectors.json'), JSON.stringify({
    meta, national: output.national, sectors: sectorStats,
  }));

  // markets.json — slēgtā tirgus indikators (karteļa proxy), top 120 pēc score.
  writeFileSync(join(dataDir, 'markets.json'), JSON.stringify({
    meta, national: output.national,
    markets: computeClosedMarkets(lots, 4, 10, (l) => b1.appliesTo(l)).slice(0, 120),
  }));

  // overview.json — nacionālā pārskata lapa (KPI, riska sadalījums, top, mēnešu tendence).
  let totalValue = 0;
  const monthly = new Map<string, { contracts: number; singleBid: number; value: number }>();
  for (const l of lots) {
    if (!l.winnerChosen) continue;
    if (!l.dupValue) totalValue += l.awardValue ?? 0;
    const d = l.noticeDate;
    if (!d || d.length < 7) continue;
    const m = d.slice(0, 7);
    const e = monthly.get(m) ?? { contracts: 0, singleBid: 0, value: 0 };
    if (!l.dupValue) e.value += l.awardValue ?? 0;
    if (b1.appliesTo(l)) { e.contracts++; if (l.receivedBids === 1) e.singleBid++; }
    monthly.set(m, e);
  }
  const timeline = [...monthly.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .filter(([m]) => m >= '2023-10')
    .map(([month, e]) => ({ month, contracts: e.contracts, singleBidRate: e.contracts > 0 ? Math.round((e.singleBid / e.contracts) * 1000) / 1000 : 0, value: Math.round(e.value) }));
  let red = 0, yellow = 0, green = 0, none = 0;
  for (const b of output.buyers) {
    if (b.combinedLevel === 'red') red++;
    else if (b.combinedLevel === 'yellow') yellow++;
    else if (b.combinedScore != null) green++;
    else none++;
  }
  const topRiskBuyers = [...output.buyers].filter((b) => b.combinedScore != null)
    .sort((a, b) => (b.combinedScore as number) - (a.combinedScore as number)).slice(0, 5)
    .map((b) => ({ buyerId: b.buyerId, buyerName: b.buyerName, combinedScore: b.combinedScore, combinedLevel: b.combinedLevel }));

  // Reģionu agregāts (Latvijas karte). Atslēga bez diakritikas, sakrīt ar lvRegions.ts.
  const REGION_KEY: Record<string, string> = { 'Rīga': 'Riga', 'Pierīga': 'Pieriga', 'Kurzeme': 'Kurzeme', 'Latgale': 'Latgale', 'Zemgale': 'Zemgale', 'Vidzeme': 'Vidzeme' };
  type RAcc = { contracts: number; singleBid: number; value: number; buyers: Set<string>; red: number };
  const regAcc = new Map<string, RAcc>();
  const getReg = (key: string) => regAcc.get(key) ?? regAcc.set(key, { contracts: 0, singleBid: 0, value: 0, buyers: new Set(), red: 0 }).get(key)!;
  for (const l of lots) {
    if (!l.winnerChosen) continue;
    const key = REGION_KEY[regionLabel(l.nutsCode) ?? ''];
    if (!key) continue;
    const a = getReg(key);
    if (!l.dupValue) a.value += l.awardValue ?? 0;
    a.buyers.add(l.buyerId);
    if (b1.appliesTo(l)) { a.contracts++; if (l.receivedBids === 1) a.singleBid++; }
  }
  for (const b of output.buyers) {
    if (b.combinedLevel !== 'red') continue;
    const e = enr.get(b.buyerId);
    const key = e ? REGION_KEY[regionLabel(topKey(e.nuts)) ?? ''] : undefined;
    if (key) getReg(key).red++;
  }
  const regions = [...regAcc.entries()].map(([key, a]) => ({
    key, contracts: a.contracts,
    singleBidRate: a.contracts > 0 ? Math.round((a.singleBid / a.contracts) * 1000) / 1000 : 0,
    value: Math.round(a.value), buyers: a.buyers.size, red: a.red,
  }));

  // Naudas plūsma (Sankey): top operatīvie pasūtītāji → to galvenie piegādātāji.
  // Izlaižam mega-ietvarus (viens piegādātājs > €300M, piem. Rail Baltica), kas citādi pārmāc skatu.
  type FB = { name: string | null; val: number; sup: Map<string, { n: string | null; v: number }> };
  const fAgg = new Map<string, FB>();
  for (const l of lots) {
    if (!l.winnerChosen || l.dupValue || !l.awardValue || !l.winnerId) continue;
    const e = fAgg.get(l.buyerId) ?? { name: l.buyerName, val: 0, sup: new Map() };
    e.val += l.awardValue;
    const s = e.sup.get(l.winnerId) ?? { n: l.winnerName, v: 0 };
    s.v += l.awardValue; e.sup.set(l.winnerId, s);
    fAgg.set(l.buyerId, e);
  }
  const opBuyers = [...fAgg.values()]
    .filter((b) => Math.max(...[...b.sup.values()].map((s) => s.v)) <= 300_000_000)
    .sort((a, b) => b.val - a.val).slice(0, 6);
  const topFlows: { buyer: string; supplier: string; value: number }[] = [];
  for (const b of opBuyers) {
    const sups = [...b.sup.values()].sort((x, y) => y.v - x.v).slice(0, 4);
    for (const s of sups) topFlows.push({ buyer: b.name ?? '?', supplier: s.n ?? '?', value: Math.round(s.v / 1e6) });
  }

  writeFileSync(join(dataDir, 'overview.json'), JSON.stringify({
    meta, national: output.national,
    totals: { procurements: lots.length, awardedValue: Math.round(totalValue), buyers: output.buyers.length, suppliers: winners.length },
    riskDistribution: { red, yellow, green, none },
    topSectors: sectorStats.slice(0, 6).map((s) => ({ cpv2: s.cpv2, label: s.label, singleBidRate: s.singleBidRate, contracts: s.contracts })),
    topRiskBuyers, regions, topFlows,
    timeline,
  }));

  // buyers/<id>.json — pilnas detaļas (ielādē atverot profilu) + top piegādātāji ("kur aiziet nauda").
  for (const b of output.buyers) {
    const sm = buyerSup.get(b.buyerId);
    const topSuppliers = sm ? [...sm.entries()]
      .map(([winnerId, s]) => ({ winnerId, fileId: fileIdByWinner.get(winnerId) ?? null, name: s.name, value: Math.round(s.value), contracts: s.contracts, singleBidRate: s.contracts > 0 ? Math.round((s.singleBid / s.contracts) * 100) / 100 : 0 }))
      .sort((x, y) => y.value - x.value).slice(0, 12) : [];
    // Saistīti uzvarētāji: vai ŠĪ pasūtītāja vairāki uzvarētāji dala kopīgu personu (PLG/valde/prokūrists) — interešu konflikta pazīme.
    const mine = [...(sm?.keys() ?? [])];
    const pkToMine = new Map<string, Set<string>>();
    const pkName = new Map<string, string>();
    for (const reg of mine) for (const { pk } of regPersonKeys.get(reg) ?? []) {
      (pkToMine.get(pk) ?? pkToMine.set(pk, new Set<string>()).get(pk)!).add(reg);
      if (!pkName.has(pk)) pkName.set(pk, personWinners.get(pk)?.name ?? '');
    }
    const sharedOwnerGroups = [...pkToMine.entries()].filter(([, s]) => s.size >= 2)
      .map(([pk, s]) => ({
        person: pkName.get(pk) ?? '',
        winners: [...s].map((reg) => { const w = winnerByReg.get(reg); return { fileId: w?.fileId ?? null, name: w?.name ?? reg, value: w?.value ?? 0, contracts: w?.contracts ?? 0, role: personWinners.get(pk)?.roleByReg.get(reg) ?? '' }; }).sort((x, y) => y.value - x.value),
      })).sort((x, y) => y.winners.length - x.winners.length).slice(0, 10);
    writeFileSync(join(buyersDir, `${b.buyerId}.json`), JSON.stringify({
      ...b, flaggedLots: b.flaggedLots.slice(0, 50), topSuppliers, sharedOwnerGroups, meta,
    }));
  }

  // persons-index.json — meklēšanai pēc personas: katra persona ar tās uzvarētājiem-uzņēmumiem.
  const personsIndex = [...personWinners.values()].map((pw) => {
    const companies = [...pw.regs].map((reg) => { const w = winnerByReg.get(reg); return { fileId: w?.fileId ?? null, name: w?.name ?? reg, value: w?.value ?? 0, contracts: w?.contracts ?? 0, role: pw.roleByReg.get(reg) ?? '' }; }).sort((x, y) => y.value - x.value);
    return { name: pw.name, id: pw.id, companyCount: companies.length, totalValue: companies.reduce((s, c) => s + c.value, 0), roles: [...new Set(companies.map((c) => c.role))], companies: companies.slice(0, 40) };
  }).sort((x, y) => y.companyCount - x.companyCount || y.totalValue - x.totalValue);
  writeFileSync(join(dataDir, 'persons-index.json'), JSON.stringify({ meta, persons: personsIndex }));

  // lots.json — pilni dati (datu kopa / atkārtotai apstrādei), nelasa frontend.
  writeFileSync(join(dataDir, 'lots.json'), JSON.stringify(lots));
  return meta;
}
