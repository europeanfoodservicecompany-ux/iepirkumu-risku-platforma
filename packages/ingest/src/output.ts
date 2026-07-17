// Raksta frontend datus: index.json (mazs), sectors.json, buyers/<id>.json (detaļas pēc pieprasījuma).
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lot } from '../../engine/src/types.ts';
import type { EngineOutput } from '../../engine/src/index.ts';
import { computeSectorStats, computeClosedMarkets, computeWinners, IndicatorB1, sectorLabel, regionLabel } from '../../engine/src/index.ts';
import { parsePersons } from './plg.ts';
import { parseMembers, ancestorCompanies } from './members.ts';
import type { Financials } from './financials.ts';
import type { PpiInfo } from './ppi.ts';
import type { CflaData } from './cfla.ts';

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

  // Pasūtītāja "kur aiziet nauda": agregāts pa piegādātājiem (vērtība, līgumi, viena pretendenta, gadi — lojalitātei).
  type Sup = { name: string | null; value: number; contracts: number; singleBid: number; years: Set<string> };
  const buyerSup = new Map<string, Map<string, Sup>>();
  for (const l of lots) {
    if (!l.winnerChosen || !l.winnerId) continue;
    const m = buyerSup.get(l.buyerId) ?? new Map<string, Sup>();
    const s = m.get(l.winnerId) ?? { name: l.winnerName ?? null, value: 0, contracts: 0, singleBid: 0, years: new Set<string>() };
    if (!l.dupValue) s.value += l.awardValue ?? 0;
    s.contracts++; if (l.receivedBids === 1) s.singleBid++;
    if (l.noticeDate && l.noticeDate.length >= 4) s.years.add(l.noticeDate.slice(0, 4));
    if (!s.name && l.winnerName) s.name = l.winnerName;
    m.set(l.winnerId, s); buyerSup.set(l.buyerId, m);
  }
  // Maksimālais datums datu kopā — tendenču logiem (pēdējie 12 mēn. vs iepriekšējie 12).
  let maxDate = '';
  for (const l of lots) if (l.winnerChosen && l.noticeDate && l.noticeDate > maxDate) maxDate = l.noticeDate.slice(0, 10);
  const shiftDays = (iso: string, days: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  const recentStart = maxDate ? shiftDays(maxDate, -365) : '';
  const priorStart = maxDate ? shiftDays(maxDate, -730) : '';
  // Per-pasūtītājs viena pretendenta likme abos logos (tikai B1-attiecināmie līgumi).
  const b1trend = new IndicatorB1();
  type Trend = { rN: number; rSB: number; pN: number; pSB: number };
  const trendAgg = new Map<string, Trend>();
  for (const l of lots) {
    if (!l.noticeDate || !b1trend.appliesTo(l)) continue;
    const d = l.noticeDate.slice(0, 10);
    const t = trendAgg.get(l.buyerId) ?? { rN: 0, rSB: 0, pN: 0, pSB: 0 };
    if (d >= recentStart) { t.rN++; if (l.receivedBids === 1) t.rSB++; }
    else if (d >= priorStart) { t.pN++; if (l.receivedBids === 1) t.pSB++; }
    trendAgg.set(l.buyerId, t);
  }
  const trendOf = (buyerId: string) => {
    const t = trendAgg.get(buyerId);
    if (!t || t.rN < 8 || t.pN < 8) return null; // par maz datu kādā logā
    const recent = t.rSB / t.rN, prior = t.pSB / t.pN;
    const diff = recent - prior;
    const dir = diff >= 0.1 ? 'up' : diff <= -0.1 ? 'down' : 'flat';
    return { recent: Math.round(recent * 100) / 100, prior: Math.round(prior * 100) / 100, dir, recentN: t.rN, priorN: t.pN };
  };

  // ── Vērtību sablīvēšanās zem sliekšņa (bunching) ── pasūtītāji, kas tur vērtības TIEŠI zem atklātas
  // procedūras sliekšņa (€170k būvdarbi / €42k preces/pakalpojumi), lai izvairītos no konkurences.
  // Konservatīvi: pasūtītāja līmeņa RELATĪVA novirze pret nacionālo bāzi, ne atsevišķu līgumu karogi.
  const THR_W = 170000, THR_G = 42000;
  const bunchAgg = new Map<string, { n: number; below: number }>();
  let bunchNatN = 0, bunchNatBelow = 0;
  for (const l of lots) {
    if (!l.winnerChosen || !(l.awardValue && l.awardValue > 0) || l.dupValue || !l.buyerId) continue;
    const S = (l.cpv ?? '').startsWith('45') ? THR_W : THR_G;
    const r = l.awardValue / S;
    const below = r >= 0.85 && r < 1.0;
    bunchNatN++; if (below) bunchNatBelow++;
    const a = bunchAgg.get(l.buyerId) ?? { n: 0, below: 0 }; a.n++; if (below) a.below++; bunchAgg.set(l.buyerId, a);
  }
  const bunchNat = bunchNatN ? bunchNatBelow / bunchNatN : 0;
  const bunchingFor = (buyerId: string): { rate: number; below: number; n: number; natRate: number } | null => {
    const a = bunchAgg.get(buyerId); if (!a || a.n < 15) return null;
    const rate = a.below / a.n;
    if (rate < 0.18 || rate < bunchNat * 2.5) return null; // krasi virs nacionālā vidējā
    return { rate: Math.round(rate * 100) / 100, below: a.below, n: a.n, natRate: Math.round(bunchNat * 1000) / 1000 };
  };

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
        bunching: bunchingFor(b.buyerId) ? 1 : undefined, // sablīvēšanās zem sliekšņa (filtram/birkai)
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

  // ── Ofšoru / noslēpumainības jurisdikciju patiesā labuma guvēji (UR PLG dati) ──
  // Uzvarētāji, kuru PATIESIE īpašnieki dzīvo/ir pilsoņi nodokļu paradīzēs vai noslēpumainības zonās.
  // Caurspīdīguma pazīme: patiesos labuma guvējus grūtāk pārbaudīt. Karogs nav pierādījums — tas ir legāli.
  const OFFSHORE_JUR: Record<string, string> = {
    VG: 'Britu Virdžīnas', KY: 'Kaimanu salas', BM: 'Bermudu salas', PA: 'Panama', SC: 'Seišelas',
    BS: 'Bahamu salas', BZ: 'Beliza', GI: 'Gibraltārs', JE: 'Džērsija', GG: 'Gērnsija', IM: 'Menas sala',
    LI: 'Lihtenšteina', MC: 'Monako', AD: 'Andora', MU: 'Maurīcija', MH: 'Māršala salas', VU: 'Vanuatu',
    WS: 'Samoa', CW: 'Kirasao', AE: 'AAE', HK: 'Honkonga', PW: 'Palau',
  };
  const GREY_JUR: Record<string, string> = { CY: 'Kipra', MT: 'Malta', LU: 'Luksemburga', CH: 'Šveice' };
  const offshoreFor = (reg: string) => {
    const owners: { name: string; country: string; label: string; tier: 'offshore' | 'grey' }[] = [];
    for (const p of regPersons.get(reg) ?? []) {
      if (p.role !== 'PLG') continue;
      const codes = [(p.nat || '').toUpperCase(), (p.res || '').toUpperCase()];
      let hit: { country: string; label: string; tier: 'offshore' | 'grey' } | null = null;
      for (const c of codes) if (OFFSHORE_JUR[c]) { hit = { country: c, label: OFFSHORE_JUR[c], tier: 'offshore' }; break; }
      if (!hit) for (const c of codes) if (GREY_JUR[c]) { hit = { country: c, label: GREY_JUR[c], tier: 'grey' }; break; }
      if (hit) owners.push({ name: p.name, ...hit });
    }
    if (!owners.length) return null;
    // Dedup: viena persona PLG var parādīties vairākas reizes (vēsturiski ieraksti).
    const seenO = new Set<string>();
    const uniq = owners.filter((o) => { const k = `${o.name}|${o.country}`; if (seenO.has(k)) return false; seenO.add(k); return true; });
    owners.length = 0; owners.push(...uniq);
    return { tier: owners.some((o) => o.tier === 'offshore') ? 'offshore' as const : 'grey' as const, owners };
  };
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

  // ── Kopīga juridiskā adrese ── uzvarētāji, kas reģistrēti vienā adresē (UR register addressid).
  let regInfo: Record<string, { addressId?: string | null; address?: string | null; addrTotal?: number }> = {};
  { const p = join(dataDir, 'ur_registration.json'); if (existsSync(p)) regInfo = JSON.parse(readFileSync(p, 'utf8')); }
  const aidWinners = new Map<string, string[]>();
  for (const w of winners) { const aid = regInfo[w.winnerId]?.addressId; if (aid) (aidWinners.get(aid) ?? aidWinners.set(aid, []).get(aid)!).push(w.winnerId); }
  const sameAddressFor = (reg: string) => {
    const info = regInfo[reg]; const aid = info?.addressId; if (!aid) return null;
    const others = (aidWinners.get(aid) ?? []).filter((r) => r !== reg);
    if (!others.length) return null;
    return { address: info?.address ?? null, addrTotal: info?.addrTotal ?? 0, winners: others.slice(0, 15).map((r) => ({ fileId: fileIdByWinner.get(r) ?? null, name: winnerByReg.get(r)?.name ?? r })) };
  };

  // ── Finanšu dati (gada pārskati) ── apgrozījums, darbinieki, peļņa + "frontes firmas" signāls.
  let finData: Record<string, Financials> = {};
  { const p = join(dataDir, 'financials.json'); if (existsSync(p)) finData = JSON.parse(readFileSync(p, 'utf8')); }

  // ── PPI: publisko personu un iestāžu saraksts ── pasūtītāja tips, mātes iestāde, oficiālais kontakts.
  // AKTUĀLAIS momentuzņēmums (nav vēsturisko versiju) → frontends marķē "pēc UR aktuālā saraksta".
  let ppiData: Record<string, PpiInfo> = {};
  { const p = join(dataDir, 'ppi.json'); if (existsSync(p)) ppiData = JSON.parse(readFileSync(p, 'utf8')); }

  // ── CFLA: ES fondu projektu dati (līgumi + fonds + partneri + plāns) ──
  // Papildina piegādātāja profilu ar ES līdzfinansētiem līgumiem — t.sk. ZEMSLIEKŠŅA iepirkumiem,
  // ko IUB atvērtie dati NESATUR. Sniedz: fondu (ERAF/ESF/KF), sadalīšanas (salami) pazīmi, saistību
  // caur kopīgiem ES projektiem un plānoto vs faktisko iepirkumu skaitu. Karogs nav pierādījums.
  const emptyCfla: CflaData = { byWinner: {}, projects: {}, partners: {}, plan: {} };
  let cflaData: CflaData = emptyCfla;
  { const p = join(dataDir, 'cfla.json'); if (existsSync(p)) { const d = JSON.parse(readFileSync(p, 'utf8')); cflaData = { byWinner: d.byWinner ?? {}, projects: d.projects ?? {}, partners: d.partners ?? {}, plan: d.plan ?? {} }; } }

  // ── EIS pretendentu dati (piedāvājumu atvēršana) ── reālie pretendenti (arī zaudētāji) + skaits pa eisId.
  // To IUB datos NAV. Atļauj rādīt, KAS tiešām piedalījās, un ĪSTU karteļa analīzi (pretendentu tīkli).
  type EisProc = { bidders: { reg: string; name: string | null; country: string | null }[]; n: number; cpv: string | null; buyerReg: string | null };
  let eisData: Record<string, EisProc> = {};
  { const p = join(dataDir, 'eis.json'); if (existsSync(p)) eisData = JSON.parse(readFileSync(p, 'utf8')); }
  const eisFor = (l: Lot): EisProc | null => (l.eisId ? (eisData[l.eisId] ?? null) : null);

  // ── "Mājas priekšrocība" ── piegādātājs, kas pie VIENA pasūtītāja uzvar krasi biežāk nekā citur.
  // Balstīts uz EIS reālo dalību konkursos ar konkurenci (≥2 pretendenti). Favorītisma pazīme.
  // Kontrole pret viltus pozitīviem: prasa ≥4 dalības gan "mājās", gan citur; kontrast ≥40 p.p.
  const eisWinReg = new Map<string, Set<string>>();
  for (const l of lots) if (l.eisId && l.winnerId) (eisWinReg.get(l.eisId) ?? eisWinReg.set(l.eisId, new Set<string>()).get(l.eisId)!).add(l.winnerId);
  const buyerNm = new Map<string, string | null>();
  for (const l of lots) if (l.buyerId && !buyerNm.has(l.buyerId)) buyerNm.set(l.buyerId, l.buyerName ?? null);
  const supTot = new Map<string, { parts: number; wins: number }>();
  const supByBuyer = new Map<string, Map<string, { parts: number; wins: number }>>();
  for (const [eid, info] of Object.entries(eisData)) {
    const br = info.buyerReg; if (!br) continue;
    const regs = [...new Set(info.bidders.map((b) => b.reg))];
    if (regs.length < 2) continue; // tikai reāla konkurence
    const wins = eisWinReg.get(eid) ?? new Set<string>();
    for (const reg of regs) {
      const t = supTot.get(reg) ?? { parts: 0, wins: 0 }; t.parts++; if (wins.has(reg)) t.wins++; supTot.set(reg, t);
      const bm = supByBuyer.get(reg) ?? new Map<string, { parts: number; wins: number }>();
      const c = bm.get(br) ?? { parts: 0, wins: 0 }; c.parts++; if (wins.has(reg)) c.wins++; bm.set(br, c); supByBuyer.set(reg, bm);
    }
  }
  const homeAdvFor = (reg: string): { buyerId: string; buyerName: string | null; partsThere: number; winRateThere: number; partsElse: number; winRateElse: number } | null => {
    const bm = supByBuyer.get(reg), t = supTot.get(reg); if (!bm || !t) return null;
    let best: { buyerId: string; buyerName: string | null; partsThere: number; winRateThere: number; partsElse: number; winRateElse: number; d: number } | null = null;
    for (const [br, c] of bm) {
      const partsElse = t.parts - c.parts, winsElse = t.wins - c.wins;
      if (c.parts < 4 || partsElse < 4) continue;
      const rThere = c.wins / c.parts, rElse = winsElse / partsElse;
      if (rThere >= 0.75 && rElse <= 0.4 && rThere - rElse >= 0.4 && (!best || rThere - rElse > best.d))
        best = { buyerId: br, buyerName: buyerNm.get(br) ?? null, partsThere: c.parts, winRateThere: Math.round(rThere * 100) / 100, partsElse, winRateElse: Math.round(rElse * 100) / 100, d: rThere - rElse };
    }
    if (!best) return null; const { d: _d, ...rest } = best; return rest;
  };

  // ── "Fēnikss" ── jauna firma (nesen reģistrēta), kas dala personu/adresi ar VECĀKU uzvarētāju
  // un turpina uzvarēt pie TĀ PAŠA pasūtītāja. Iespējama reputācijas/parādu "pārdzimšana".
  const buyersByWinner = new Map<string, Set<string>>();
  for (const l of lots) if (l.winnerId && l.buyerId && l.winnerChosen) (buyersByWinner.get(l.winnerId) ?? buyersByWinner.set(l.winnerId, new Set<string>()).get(l.winnerId)!).add(l.buyerId);
  const regMs = (reg: string) => { const r = regInfo[reg]?.registered; return r ? Date.parse(r) : NaN; };
  const winnerRegList = winners.map((w) => w.winnerId);
  const COVER_END_MS = Date.parse('2026-06-17');
  const NEW_MS = 30 * 30.44 * 86400000; // ~30 mēneši
  const phoenixFor = (reg: string): { predecessorReg: string; predecessorName: string | null; predecessorFileId: string | null; via: string; buyerId: string; buyerName: string | null; registered: string | null } | null => {
    const rd = regMs(reg); if (isNaN(rd) || (COVER_END_MS - rd) > NEW_MS) return null; // tikai jaunas firmas
    const myBuyers = buyersByWinner.get(reg); if (!myBuyers || !myBuyers.size) return null;
    const myPersons = new Set((regPersonKeys.get(reg) ?? []).map((k) => k.pk));
    const myAddr = regInfo[reg]?.addressId;
    if (!myPersons.size && !myAddr) return null;
    for (const other of winnerRegList) {
      if (other === reg) continue;
      const od = regMs(other); if (isNaN(od) || od >= rd) continue; // priekštecim jābūt vecākam
      let via: string | null = null;
      if (myPersons.size && (regPersonKeys.get(other) ?? []).some((k) => myPersons.has(k.pk))) via = 'kopīga persona';
      else if (myAddr && regInfo[other]?.addressId === myAddr && (regInfo[reg]?.addrTotal ?? 99) <= 8) via = 'kopīga adrese';
      if (!via) continue;
      const ob = buyersByWinner.get(other); if (!ob) continue;
      const shared = [...myBuyers].find((b) => ob.has(b));
      if (shared) return { predecessorReg: other, predecessorName: winnerByReg.get(other)?.name ?? other, predecessorFileId: fileIdByWinner.get(other) ?? null, via, buyerId: shared, buyerName: buyerNm.get(shared) ?? null, registered: regInfo[reg]?.registered ?? null };
    }
    return null;
  };

  // ── Kopā-pretendenti pa piegādātājiem (EIS) ── citas firmas, kas bieži piedalās tajos pašos konkursos.
  // Vajadzīgs piegādātāja profila tīklam. Skaita arī, cik reižu uzvarēja katrs (we/they).
  const eisWinEarly = new Map<string, Set<string>>();
  for (const l of lots) { if (l.eisId && l.winnerId) (eisWinEarly.get(l.eisId) ?? eisWinEarly.set(l.eisId, new Set<string>()).get(l.eisId)!).add(l.winnerId); }
  const coBidByReg = new Map<string, Map<string, { n: number; theyWon: number; weWon: number; name: string | null }>>();
  for (const [eid, info] of Object.entries(eisData)) {
    const regs = [...new Set(info.bidders.map((b) => b.reg))];
    if (regs.length < 2) continue;
    const wins = eisWinEarly.get(eid) ?? new Set<string>();
    const nameOf = new Map(info.bidders.map((b) => [b.reg, b.name] as const));
    for (const a of regs) {
      if (!fileIdByWinner.has(a)) continue; // tikai mūsu uzvarētāji (citiem nav profila)
      const m = coBidByReg.get(a) ?? coBidByReg.set(a, new Map()).get(a)!;
      for (const b of regs) {
        if (b === a) continue;
        const e = m.get(b) ?? { n: 0, theyWon: 0, weWon: 0, name: nameOf.get(b) ?? null };
        e.n++; if (wins.has(b)) e.theyWon++; if (wins.has(a)) e.weWon++;
        if (!e.name) e.name = nameOf.get(b) ?? null;
        m.set(b, e);
      }
    }
  }
  // Vai kopā-pretendents ir SAISTĪTS ar mūsu piegādātāju (kopīga persona vai holdings) — fiktīvas
  // konkurences pazīme. Adresi te neizmantojam (biroju centri dod viltus pozitīvus). winnerAnc/regPersonKeys
  // pieejami izsaukuma brīdī (winner detail būvē pēc to definēšanas).
  const coRelated = (a: string, b: string): 'persona' | 'holdings' | null => {
    const bk = new Set((regPersonKeys.get(b) ?? []).map((k) => k.pk));
    if ((regPersonKeys.get(a) ?? []).some((k) => bk.has(k.pk))) return 'persona';
    const ah = winnerAnc.get(a), bh = winnerAnc.get(b);
    if (ah && bh) for (const x of ah) if (bh.has(x)) return 'holdings';
    return null;
  };
  const cobiddersFor = (reg: string) => {
    const m = coBidByReg.get(reg);
    if (!m) return [];
    return [...m.entries()].filter(([, e]) => e.n >= 2).sort((x, y) => y[1].n - x[1].n).slice(0, 8)
      .map(([oreg, e]) => ({ reg: oreg, name: e.name, fileId: fileIdByWinner.get(oreg) ?? null, coBids: e.n, theyWon: e.theyWon, weWon: e.weWon, related: coRelated(reg, oreg) }));
  };
  // Projekts → tajā strādājošie MŪSU uzvarētāji (līgumu izpildītāji); uzvarētājs → tā projekti.
  const projectContractors = new Map<string, Set<string>>();
  const winnerProjects = new Map<string, Set<string>>();
  // Lota sasaistei: regNr+procNr un regNr+datums → {project, fund} (ES tags konkrētam IUB iepirkumam).
  const cflaByProc = new Map<string, { project: string | null; fund: string | null }>();
  const cflaByDate = new Map<string, { project: string | null; fund: string | null }>();
  for (const [reg, list] of Object.entries(cflaData.byWinner)) {
    for (const c of list) {
      if (c.project) {
        (projectContractors.get(c.project) ?? projectContractors.set(c.project, new Set()).get(c.project)!).add(reg);
        (winnerProjects.get(reg) ?? winnerProjects.set(reg, new Set()).get(reg)!).add(c.project);
      }
      if (c.procNr) cflaByProc.set(reg + '|' + c.procNr.trim(), { project: c.project, fund: c.fund });
      if (c.date) cflaByDate.set(reg + '|' + c.date, { project: c.project, fund: c.fund });
    }
  }
  // ES tags konkrētam IUB lotam (ja izpildītājs+procNr/datums sakrīt ar CFLA līgumu).
  const euFundOfLot = (l: Lot): { project: string | null; fund: string | null } | null => {
    if (!l.winnerId) return null;
    if (l.subjectRef) { const m = cflaByProc.get(l.winnerId + '|' + l.subjectRef.trim()); if (m) return m; }
    if (l.noticeDate) { const m = cflaByDate.get(l.winnerId + '|' + l.noticeDate.slice(0, 10)); if (m) return m; }
    return null;
  };
  const cflaFor = (reg: string) => {
    const list = cflaData.byWinner[reg];
    if (!list || !list.length) return null;
    const value = list.reduce((s, c) => s + c.value, 0);
    const below = list.filter((c) => c.below);
    const belowValue = below.reduce((s, c) => s + c.value, 0);
    // Fondu sadalījums (ERAF/ESF/KF/AF…).
    const fundVal = new Map<string, number>();
    for (const c of list) { const f = c.fund ?? '—'; fundVal.set(f, (fundVal.get(f) ?? 0) + c.value); }
    const funds = [...fundVal.entries()].filter(([f]) => f !== '—').map(([fund, v]) => ({ fund, value: Math.round(v) })).sort((a, b) => b.value - a.value);
    // Grupē pa projektiem (sadalīšanas pazīmei + plāns pret faktu).
    const byProj = new Map<string, { name: string | null; count: number; value: number; below: number; belowValue: number }>();
    for (const c of list) {
      const k = c.project ?? '—';
      const e = byProj.get(k) ?? { name: c.projectName, count: 0, value: 0, below: 0, belowValue: 0 };
      e.count++; e.value += c.value; if (c.below) { e.below++; e.belowValue += c.value; }
      if (!e.name && c.projectName) e.name = c.projectName;
      byProj.set(k, e);
    }
    const projects = [...byProj.entries()].map(([project, e]) => ({
      project, name: e.name, count: e.count, value: Math.round(e.value), below: e.below, belowValue: Math.round(e.belowValue),
      planned: cflaData.plan[project] ?? null,
    })).sort((a, b) => b.value - a.value);
    // Sadalīšanas norāde: viens projekts ar ≥3 zemsliekšņa līgumiem tam pašam piegādātājam.
    const split = projects.filter((p) => p.below >= 3).sort((a, b) => b.below - a.below)[0] ?? null;
    const splitSignal = split ? `ES projektā “${split.name ?? split.project}” ${split.below} zemsliekšņa līgumi šim piegādātājam (${split.belowValue.toLocaleString('lv-LV')} €) — iespējama sadalīšana` : null;
    // Saistība caur ES projektiem: citi MŪSU uzvarētāji + reģistrētie sadarbības partneri tajos pašos projektos.
    const relSeen = new Set<string>();
    const related: { fileId: string | null; name: string | null; reg: string; project: string; projectName: string | null; relation: 'izpildītājs' | 'partneris' }[] = [];
    for (const proj of winnerProjects.get(reg) ?? []) {
      const pName = cflaData.projects[proj]?.name ?? null;
      for (const other of projectContractors.get(proj) ?? []) {
        if (other === reg || relSeen.has(other)) continue; relSeen.add(other);
        related.push({ fileId: fileIdByWinner.get(other) ?? null, name: winnerByReg.get(other)?.name ?? other, reg: other, project: proj, projectName: pName, relation: 'izpildītājs' });
      }
      for (const p of cflaData.partners[proj] ?? []) {
        if (p.reg === reg || relSeen.has(p.reg)) continue; relSeen.add(p.reg);
        related.push({ fileId: fileIdByWinner.get(p.reg) ?? null, name: p.name, reg: p.reg, project: proj, projectName: pName, relation: 'partneris' });
      }
    }
    return {
      contracts: list.length, value: Math.round(value),
      belowCount: below.length, belowValue: Math.round(belowValue),
      funds, projects: projects.slice(0, 10), splitSignal,
      splitMax: split ? split.below : 0, splitProject: split ? (split.name ?? split.project) : null,
      related: related.slice(0, 20),
      list: list.slice(0, 30).map((c) => ({ project: c.project, projectName: c.projectName, fund: c.fund, procNr: c.procNr, veids: c.veids, date: c.date, value: Math.round(c.value), below: c.below })),
    };
  };

  // ── Iepirkuma priekšmets + kontaktpersona (laika ziņā precīzi, no paziņojuma) pēc lotId. ──
  // Privātuma labad rādām tikai kontaktpersonas vārdu (ne e-pastu/tālruni).
  const lotMetaById = new Map<string, { subjectName: string | null; subjectRef: string | null; contactName: string | null; euFunded?: boolean; bidders?: { name: string | null; fileId: string | null }[]; bidderCount?: number }>();
  for (const l of lots) {
    const eu = !!euFundOfLot(l);
    const eis = eisFor(l);
    if (l.subjectName || l.contactName || eu || eis) {
      lotMetaById.set(l.id, {
        subjectName: l.subjectName ?? null, subjectRef: l.subjectRef ?? null, contactName: l.contactName ?? null, euFunded: eu || undefined,
        bidderCount: eis ? eis.n : undefined,
        bidders: eis ? eis.bidders.slice(0, 12).map((b) => ({ name: b.name ?? b.reg, fileId: fileIdByWinner.get(b.reg) ?? null })) : undefined,
      });
    }
  }
  const isPartnership = (name: string | null) => /pilnsabiedr|personu apvien|^PS\s|^PS"|^KS\s/i.test(name ?? '');
  // Frontes pazīme: kapitālsabiedrība (ne partnerība) ar maz darbiniekiem (≤3), mikro apgrozījumu un ≥€500k līgumiem.
  // Atgriež darbinieku skaitu (lai frontends var filtrēt pēc ≤1/≤2/≤3), vai null.
  const lowCapEmpFor = (reg: string, value: number, name: string | null): number | null => {
    const f = finData[reg]; if (!f) return null;
    if (isPartnership(name) || value < 500000 || f.employees == null || f.employees > 3 || f.turnover == null || f.turnover >= 100000) return null;
    return f.employees;
  };
  // Mazs apgrozījums + lieli līgumi: kapitālsabiedrība (ne partnerība) ar apgrozījumu <€1M un ≥€500k līgumiem.
  // Atgriež apgrozījumu (lai frontends var filtrēt pēc <€100k/<€500k/<€1M), vai null.
  const loTurnFor = (reg: string, value: number, name: string | null): number | null => {
    const f = finData[reg]; if (!f) return null;
    if (isPartnership(name) || value < 500000 || f.turnover == null || f.turnover < 0 || f.turnover >= 1000000) return null;
    return Math.round(f.turnover);
  };

  writeFileSync(join(dataDir, 'winners-index.json'), JSON.stringify({
    meta,
    winners: winners.map((w, i) => ({
      winnerId: w.winnerId, fileId: fileIds[i], winnerName: w.winnerName, contracts: w.contracts, value: w.awardedValue,
      buyers: w.buyers, singleBidRate: w.singleBidRate, topBuyerShare: w.topBuyerShare,
      sectorCpv2: w.sectorCpv2, sectorLabel: w.sectorLabel,
      sharedAddr: (aidWinners.get(regInfo[w.winnerId]?.addressId ?? '') ?? []).length > 1 ? 1 : undefined,
      lowCapEmp: lowCapEmpFor(w.winnerId, w.awardedValue, w.winnerName) ?? undefined,
      loTurn: loTurnFor(w.winnerId, w.awardedValue, w.winnerName) ?? undefined,
      cfla: cflaData.byWinner[w.winnerId] ? 1 : undefined, // ES fondu līgumi (CFLA) — filtram piegādātāju sarakstā
      offshore: offshoreFor(w.winnerId)?.tier, // 'offshore' | 'grey' | undefined — ofšora PLG filtram
      homeAdv: homeAdvFor(w.winnerId) ? 1 : undefined, // "mājas priekšrocība" pie viena pasūtītāja
      phoenix: phoenixFor(w.winnerId) ? 1 : undefined, // "fēnikss" — jauna firma pārmanto veca priekšteci
    })),
  }));

  // ── cfla-index.json ── atsevišķa "ES fondi (CFLA)" cilne: meklēšana + kārtošana pa piegādātājiem.
  // Kompakts kopsavilkums (bez pilniem līgumiem — tos ielādē piegādātāja profilā). Tikai ar CFLA līgumiem.
  // Piegādātāja IUB konteksts: cik AUGSTA/VIDĒJA riska pasūtītāju (kombinētais risks = A/B1/B2/C/D/G)
  // šis piegādātājs ir apkalpojis. Tā ir saikne uz pasūtītāju-līmeņa indikatoriem (piegādātājam pašam to nav).
  const buyerLevelById = new Map(output.buyers.map((b) => [b.buyerId, b.combinedLevel]));
  const winnerBuyerSet = new Map<string, Set<string>>();
  for (const l of lots) {
    if (!l.winnerChosen || !l.winnerId || !l.buyerId) continue;
    (winnerBuyerSet.get(l.winnerId) ?? winnerBuyerSet.set(l.winnerId, new Set<string>()).get(l.winnerId)!).add(l.buyerId);
  }
  const iubBuyerRisk = (reg: string) => {
    let red = 0, yellow = 0;
    for (const bid of winnerBuyerSet.get(reg) ?? []) { const lv = buyerLevelById.get(bid); if (lv === 'red') red++; else if (lv === 'yellow') yellow++; }
    return { red, yellow };
  };
  const cflaIndex = winners.map((w, i) => {
    const s = cflaFor(w.winnerId);
    if (!s) return null;
    // IUB riska pazīmes (piegādātāja līmenī) — tās pašas, ko rāda SupplierProfile. Savieno CFLA ar IUB pusi.
    // CFLA datos riska score nav iespējams (nav pretendentu/CPV/pasūtītāja), bet ja piegādātājs ir arī IUB
    // uzvarētājs, tā IUB pazīmes (jau izrēķinātas) ir vērtīgs konteksts. Karogs nav pierādījums.
    const enough = w.contracts >= 5;
    const shell = lowCapEmpFor(w.winnerId, w.awardedValue, w.winnerName) != null;
    const iubFlags: string[] = [];
    if (enough && w.singleBidRate >= 0.7) iubFlags.push('bieži vienīgais pretendents');
    if (enough && w.topBuyerShare >= 0.8 && w.buyers <= 2) iubFlags.push('atkarīgs no 1 pasūtītāja');
    if (shell) iubFlags.push('maz resursu lieliem līgumiem');
    else if (loTurnFor(w.winnerId, w.awardedValue, w.winnerName) != null) iubFlags.push('mazs apgrozījums, lieli līgumi');
    if ((aidWinners.get(regInfo[w.winnerId]?.addressId ?? '') ?? []).length > 1) iubFlags.push('kopīga juridiskā adrese');
    const iubLevel: 'high' | 'med' | null =
      (shell || (enough && w.singleBidRate >= 0.7)) ? 'high' : iubFlags.length ? 'med' : null;
    return {
      fileId: fileIds[i], winnerId: w.winnerId, name: w.winnerName,
      sectorLabel: w.sectorLabel,
      contracts: s.contracts, value: s.value, belowCount: s.belowCount,
      splitMax: s.splitMax,
      splitProject: s.splitProject,
      funds: s.funds.slice(0, 3),
      projects: s.projects.slice(0, 4).map((p) => ({ name: p.name ?? p.project, count: p.count, below: p.below })),
      iubContracts: w.contracts, iubSingleBidRate: Math.round(w.singleBidRate * 100) / 100,
      iubFlags, iubLevel,
      iubRedBuyers: iubBuyerRisk(w.winnerId).red, iubYellowBuyers: iubBuyerRisk(w.winnerId).yellow,
      offshore: offshoreFor(w.winnerId)?.tier, // 'offshore' | 'grey' | undefined — ES nauda × nepārbaudāmi īpašnieki
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.splitMax - a.splitMax || b.belowCount - a.belowCount || b.value - a.value);
  writeFileSync(join(dataDir, 'cfla-index.json'), JSON.stringify({
    meta,
    totals: { suppliers: cflaIndex.length, below: cflaIndex.reduce((s, r) => s + r.belowCount, 0), withSplit: cflaIndex.filter((r) => r.splitMax >= 3).length, withIubRisk: cflaIndex.filter((r) => r.iubLevel != null).length },
    suppliers: cflaIndex,
  }));

  // ── Holdinga ķēdes (SIA dalībnieki) ── kam pieder uzvarētājs un kuri uzvarētāji ir vienā holdingā.
  let ownersOf = new Map<string, { owners: { kind: 'company' | 'person' | 'foreign'; reg: string | null; name: string; shares: number }[]; total: number }>();
  { const mp = join(dataDir, 'members.csv'); if (existsSync(mp)) ownersOf = parseMembers(readFileSync(mp, 'utf8')); }
  const regName = new Map<string, string>();
  for (const w of winners) if (w.winnerName) regName.set(w.winnerId, w.winnerName);
  for (const e of ownersOf.values()) for (const o of e.owners) if (o.kind === 'company' && o.reg && o.name && !regName.has(o.reg)) regName.set(o.reg, o.name);
  const winnerAnc = new Map<string, Set<string>>();
  const ancToWinners = new Map<string, Set<string>>();
  for (const w of winners) {
    const anc = ancestorCompanies(w.winnerId, ownersOf);
    if (!anc.size) continue;
    winnerAnc.set(w.winnerId, anc);
    for (const p of anc) (ancToWinners.get(p) ?? ancToWinners.set(p, new Set<string>()).get(p)!).add(w.winnerId);
  }
  const ownershipFor = (reg: string) => {
    const direct = ownersOf.get(reg); const anc = winnerAnc.get(reg);
    if (!direct && !anc) return null;
    const owners = direct ? [...direct.owners].filter((o) => o.shares > 0 && o.reg !== reg)
      .map((o) => ({ kind: o.kind, name: o.name, reg: o.kind === 'company' ? o.reg : null, sharePct: direct.total > 0 ? Math.round((o.shares / direct.total) * 100) : 0 }))
      .filter((o) => o.sharePct >= 1).sort((a, b) => b.sharePct - a.sharePct).slice(0, 8) : [];
    const ultimate = anc ? [...anc].filter((p) => { const e = ownersOf.get(p); return !e || !e.owners.some((o) => o.kind === 'company' && o.reg); })
      .map((p) => ({ reg: p, name: regName.get(p) ?? p })).slice(0, 5) : [];
    const siblings: { fileId: string | null; name: string | null; via: string }[] = [];
    const seen = new Set<string>();
    if (anc) for (const p of anc) for (const other of ancToWinners.get(p) ?? []) {
      if (other === reg || seen.has(other)) continue; seen.add(other);
      siblings.push({ fileId: fileIdByWinner.get(other) ?? null, name: regName.get(other) ?? other, via: regName.get(p) ?? p });
    }
    if (!owners.length && !ultimate.length && !siblings.length) return null;
    return { owners, ultimate, siblings: siblings.slice(0, 15) };
  };

  for (let i = 0; i < winners.length; i++) {
    const reg = winners[i].winnerId;
    const persons = regPersons.get(reg) ?? [];
    const offshore = offshoreFor(reg);
    writeFileSync(join(winnersDir, `${fileIds[i]}.json`), JSON.stringify({
      ...winners[i], fileId: fileIds[i],
      beneficialOwners: persons.filter((p) => p.role === 'PLG').map((p) => ({ name: p.name, id: p.id, nat: p.nat, res: p.res ?? null })),
      officers: persons.filter((p) => p.role !== 'PLG').map((p) => ({ name: p.name, id: p.id, role: p.role })),
      offshore,
      relatedWinners: relatedWinnersFor(reg),
      ownership: ownershipFor(reg),
      sameAddress: sameAddressFor(reg),
      financials: finData[reg] ?? null,
      lowCapacity: lowCapEmpFor(reg, winners[i].awardedValue, winners[i].winnerName) != null,
      cfla: cflaFor(reg),
      coBidders: cobiddersFor(reg),
      homeAdvantage: homeAdvFor(reg),
      phoenix: phoenixFor(reg),
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
  const closedMarkets = computeClosedMarkets(lots, 4, 10, (l) => b1.appliesTo(l)).slice(0, 120);
  writeFileSync(join(dataDir, 'markets.json'), JSON.stringify({
    meta, national: output.national, markets: closedMarkets,
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
    const e = fAgg.get(l.buyerId) ?? { name: l.buyerName ?? null, val: 0, sup: new Map() };
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

  // Jaunākie karogi: nesen piešķirti līgumi ar skaidru riska pazīmi, jaunākie pirmie.
  const redMktCpv = new Set(closedMarkets.filter((m) => m.level === 'red').map((m) => m.cpv));
  const cFlagged = new Map<string, number>(); // lotId → z (C cenu/vērtības novirze)
  for (const b of output.buyers) for (const f of b.c?.detail?.priceFlags ?? []) if (f.z >= 2.5) cFlagged.set(f.lotId, f.z);
  const recentFlags: { date: string; buyerId: string; buyerName: string | null; winnerName: string | null; winnerFileId: string | null; value: number; sector: string | null; reasons: string[]; sourceUrl: string | null; subjectName: string | null; contactName: string | null; euFunded: boolean }[] = [];
  for (const l of lots) {
    if (!l.winnerChosen || l.dupValue || !l.noticeDate || l.noticeDate.length < 7) continue;
    if (!l.sourceUrl) continue; // tikai ar tiešo EIS saiti — katram karogam jābūt saitei uz konkrēto iepirkumu
    const v = l.awardValue ?? 0;
    const cpv4 = (l.cpv ?? '').replace(/[^0-9]/g, '').slice(0, 4);
    const reasons: string[] = [];
    const z = cFlagged.get(l.id);
    if (z != null) reasons.push(`neparasti augsta vērtība nozarē (z≈${z.toFixed(1)})`);
    if (l.receivedBids === 1 && v >= 100000) reasons.push('viens pretendents');
    if (redMktCpv.has(cpv4) && (l.receivedBids ?? 99) <= 1) reasons.push('slēgts tirgus');
    if (!reasons.length) continue;
    recentFlags.push({ date: l.noticeDate.slice(0, 10), buyerId: l.buyerId, buyerName: l.buyerName ?? null, winnerName: l.winnerName ?? null, winnerFileId: l.winnerId ? (fileIdByWinner.get(l.winnerId) ?? null) : null, value: Math.round(v), sector: cpv4 ? sectorLabel(cpv4.slice(0, 2)) : null, reasons, sourceUrl: l.sourceUrl ?? null, subjectName: l.subjectName ?? null, contactName: l.contactName ?? null, euFunded: !!euFundOfLot(l) });
  }
  recentFlags.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.value - a.value));

  // Lojalitātes pāri: pasūtītājs, kas gadiem ilgi lielāko daļu tēriņa novirza vienam piegādātājam.
  const buyerNameById = new Map(output.buyers.map((b) => [b.buyerId, b.buyerName]));
  const loyaltyPairs: { buyerId: string; buyerName: string | null; fileId: string | null; supplier: string | null; value: number; contracts: number; years: number; from: string | null; to: string | null; share: number; singleBidRate: number }[] = [];
  for (const [buyerId, sm] of buyerSup) {
    const total = enr.get(buyerId)?.value ?? 0;
    for (const [winnerId, s] of sm) {
      if (s.years.size < 2 || s.contracts < 6 || s.value < 500_000) continue;
      const share = total > 0 ? s.value / total : 0;
      if (share < 0.3) continue; // ≥30% no pasūtītāja kopējā tēriņa vienam piegādātājam
      const years = [...s.years].sort();
      loyaltyPairs.push({ buyerId, buyerName: buyerNameById.get(buyerId) ?? null, fileId: fileIdByWinner.get(winnerId) ?? null, supplier: s.name, value: Math.round(s.value), contracts: s.contracts, years: years.length, from: years[0], to: years[years.length - 1], share: Math.round(share * 100) / 100, singleBidRate: s.contracts > 0 ? Math.round((s.singleBid / s.contracts) * 100) / 100 : 0 });
    }
  }
  loyaltyPairs.sort((a, b) => b.value - a.value);

  writeFileSync(join(dataDir, 'overview.json'), JSON.stringify({
    meta, national: output.national,
    totals: { procurements: lots.length, awardedValue: Math.round(totalValue), buyers: output.buyers.length, suppliers: winners.length },
    riskDistribution: { red, yellow, green, none },
    topSectors: sectorStats.slice(0, 6).map((s) => ({ cpv2: s.cpv2, label: s.label, singleBidRate: s.singleBidRate, contracts: s.contracts })),
    topRiskBuyers, regions, topFlows,
    recentFlags: recentFlags.slice(0, 40),
    loyaltyPairs: loyaltyPairs.slice(0, 25),
    timeline,
  }));

  // buyers/<id>.json — pilnas detaļas (ielādē atverot profilu) + top piegādātāji ("kur aiziet nauda").
  for (const b of output.buyers) {
    const sm = buyerSup.get(b.buyerId);
    const buyerTotal = enr.get(b.buyerId)?.value ?? 0;
    const loyaltyOf = (s: Sup): 'high' | 'med' | null => {
      const share = buyerTotal > 0 ? s.value / buyerTotal : 0;
      if (s.years.size >= 2 && s.contracts >= 5 && share >= 0.5) return 'high';
      if (s.years.size >= 2 && s.contracts >= 4 && share >= 0.3) return 'med';
      return null;
    };
    const topSuppliers = sm ? [...sm.entries()]
      .map(([winnerId, s]) => { const years = [...s.years].sort(); return { winnerId, fileId: fileIdByWinner.get(winnerId) ?? null, name: s.name, value: Math.round(s.value), contracts: s.contracts, singleBidRate: s.contracts > 0 ? Math.round((s.singleBid / s.contracts) * 100) / 100 : 0, share: buyerTotal > 0 ? Math.round((s.value / buyerTotal) * 100) / 100 : 0, years: years.length, from: years[0] ?? null, to: years[years.length - 1] ?? null, loyalty: loyaltyOf(s) }; })
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
    const flagged = b.flaggedLots.slice(0, 50);
    const lotMeta: Record<string, { subjectName: string | null; subjectRef: string | null; contactName: string | null }> = {};
    for (const fl of flagged) { const id = fl.lotId; if (id && lotMetaById.has(id)) lotMeta[id] = lotMetaById.get(id)!; }
    writeFileSync(join(buyersDir, `${b.buyerId}.json`), JSON.stringify({
      ...b, flaggedLots: flagged, topSuppliers, sharedOwnerGroups, singleBidTrend: trendOf(b.buyerId),
      bunching: bunchingFor(b.buyerId),
      ppi: ppiData[b.buyerId] ?? null, lotMeta, meta,
    }));
  }

  // ── Personu analīzes papild-dati ──
  // Per-uzvarētāju agregāti no lots: pasūtītāji (vērtība), CPV4 tirgi, sektors.
  type WEnr = { buyers: Map<string, { name: string | null; value: number }>; cpv4: Set<string> };
  const wEnr = new Map<string, WEnr>();
  const procWinners = new Map<string, Set<string>>(); // procedūra → uzvarētāju kopa (vienas procedūras karogs)
  for (const l of lots) {
    if (!l.winnerChosen || !l.winnerId || l.dupValue) continue;
    const e = wEnr.get(l.winnerId) ?? wEnr.set(l.winnerId, { buyers: new Map(), cpv4: new Set() }).get(l.winnerId)!;
    if (l.buyerId) { const b = e.buyers.get(l.buyerId) ?? { name: l.buyerName ?? null, value: 0 }; b.value += l.awardValue ?? 0; if (!b.name && l.buyerName) b.name = l.buyerName; e.buyers.set(l.buyerId, b); }
    if (l.cpv) { const c = l.cpv.replace(/[^0-9]/g, '').slice(0, 4); if (c.length === 4) e.cpv4.add(c); }
    if (l.procedureId) (procWinners.get(l.procedureId) ?? procWinners.set(l.procedureId, new Set()).get(l.procedureId)!).add(l.winnerId);
  }
  const wSector = new Map(winners.map((w) => [w.winnerId, { cpv2: w.sectorCpv2, label: w.sectorLabel }]));
  // Slēgtā tirgus (B2) topUzvarētāji: reg → tirgi, kuros tas ir starp dominējošajiem.
  const regClosedMarkets = new Map<string, { cpv: string; label: string; level: string | null }[]>();
  for (const mkt of closedMarkets) for (const tw of mkt.topWinners) {
    (regClosedMarkets.get(tw.id) ?? regClosedMarkets.set(tw.id, []).get(tw.id)!).push({ cpv: mkt.cpv, label: mkt.label, level: mkt.level });
  }

  // ── Iespējamas politiski nozīmīgas personas (PEP) ──
  // Daļējs saraksts no CVK atvērtajiem vēlēšanu datiem (data/pep-list.json). Sasaiste TIKAI pēc vārda un
  // uzvārda (bez personas koda), tāpēc tā ir norāde pārbaudei, ne apstiprinājums. Verifikācija — VID PNP reģistrā.
  // Defises/apostrofus aizstāj ar atstarpi (dubultuzvārdi: "Kalniņa-Lukaševica" = "Kalniņa Lukaševica").
  const pepNorm = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’'`\-–]/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  // PUBLISKI atzīmējam TIKAI ievēlētas amatpersonas (Saeimas un EP deputātus). Vēlēšanu kandidāts nav
  // politiski nozīmīga persona un tam nav varas pār iepirkumiem — to publiski nemarķējam.
  const pepPublicTiers = new Set(['Ministru prezidents', 'ministrs', 'Saeimas deputāts', 'EP deputāts']);
  const pepMap = new Map<string, { tier: string; source: string }>();
  let pepSource = '';
  { const pp = join(dataDir, 'pep-list.json'); if (existsSync(pp)) {
      const pl = JSON.parse(readFileSync(pp, 'utf8')); pepSource = pl.source ?? '';
      for (const e of pl.persons ?? []) { if (!pepPublicTiers.has(e.tier)) continue; const k = pepNorm(e.name); if (k && !pepMap.has(k)) pepMap.set(k, { tier: e.tier, source: pl.source ?? '' }); }
    } }
  // Vārdamāsu risks: cik personu iepirkumu datos dalās vienu un to pašu normalizēto vārdu.
  const nameCounts = new Map<string, number>();
  for (const pw of personWinners.values()) { const k = pepNorm(pw.name); nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1); }

  // persons-index.json — meklēšanai pēc personas: katra persona ar tās uzvarētājiem-uzņēmumiem.
  const personsIndex = [...personWinners.values()].map((pw) => {
    const regs = [...pw.regs];
    const companies = regs.map((reg) => {
      const w = winnerByReg.get(reg); const e = wEnr.get(reg); const sec = wSector.get(reg);
      const topBuyers = e ? [...e.buyers.values()].sort((a, b) => b.value - a.value).slice(0, 3).map((b) => ({ name: b.name, value: Math.round(b.value) })) : [];
      return { fileId: w?.fileId ?? null, name: w?.name ?? reg, value: w?.value ?? 0, contracts: w?.contracts ?? 0, role: pw.roleByReg.get(reg) ?? '', sector: sec?.label ?? null, buyers: topBuyers };
    }).sort((x, y) => y.value - x.value);

    // Signāli (tikai daudzfirmu personām — saikne nozīmīga, ja firmas pārklājas).
    const signals: string[] = [];
    const signalTypes: string[] = [];
    let level: 'high' | 'med' | null = null;
    if (regs.length >= 2) {
      // Kopīgs CPV4 tirgus starp ≥2 firmām.
      const cpv4Count = new Map<string, number>();
      for (const reg of regs) for (const c of wEnr.get(reg)?.cpv4 ?? []) cpv4Count.set(c, (cpv4Count.get(c) ?? 0) + 1);
      const sharedCpv = [...cpv4Count.entries()].filter(([, n]) => n >= 2);
      // Kopīgs pasūtītājs starp ≥2 firmām.
      const buyerCount = new Map<string, { name: string | null; n: number }>();
      for (const reg of regs) for (const [bid, b] of wEnr.get(reg)?.buyers ?? []) { const x = buyerCount.get(bid) ?? { name: b.name, n: 0 }; x.n++; buyerCount.set(bid, x); }
      const sharedBuyers = [...buyerCount.values()].filter((x) => x.n >= 2);
      // Vienā procedūrā ≥2 firmas (visspēcīgākais).
      let sameProc = 0;
      for (const s of procWinners.values()) { let c = 0; for (const reg of regs) if (s.has(reg)) c++; if (c >= 2) sameProc++; }
      // Dominē slēgtā tirgū (B2): ≥2 firmas starp viena augsta-HHI tirgus topUzvarētājiem.
      const redMarkets = new Map<string, { label: string; n: number; level: string | null }>();
      for (const reg of regs) for (const m of regClosedMarkets.get(reg) ?? []) { const x = redMarkets.get(m.cpv) ?? { label: m.label, n: 0, level: m.level }; x.n++; redMarkets.set(m.cpv, x); }
      const sharedMarketDom = [...redMarkets.values()].filter((x) => x.n >= 2);

      if (sameProc > 0) { signals.push(`${sameProc > 1 ? sameProc + ' ' : ''}vienā procedūrā uzvar ≥2 saistītas firmas`); signalTypes.push('proc'); level = 'high'; }
      if (sharedMarketDom.length) { signals.push(`dominē slēgtā tirgū: ${sharedMarketDom[0].label}`); signalTypes.push('market'); level = 'high'; }
      if (sharedCpv.length) { signals.push(`${sharedCpv.length} kopīg${sharedCpv.length === 1 ? 's tirgus' : 'i tirgi'} (≥2 firmas konkurē vienā CPV4 nišā)`); signalTypes.push('cpv'); if (!level) level = 'med'; }
      if (sharedBuyers.length) { signals.push(`${sharedBuyers.length} kopīg${sharedBuyers.length === 1 ? 's pasūtītājs' : 'i pasūtītāji'} (≥2 firmas)`); signalTypes.push('buyer'); if (!level) level = 'med'; }
    }

    const pk = pepNorm(pw.name);
    const pepHit = pepMap.get(pk);
    const pep = pepHit ? { tier: pepHit.tier, source: pepHit.source, ambiguous: (nameCounts.get(pk) ?? 1) > 1 } : undefined;

    return { name: pw.name, id: pw.id, companyCount: companies.length, totalValue: companies.reduce((s, c) => s + c.value, 0), totalContracts: companies.reduce((s, c) => s + c.contracts, 0), roles: [...new Set(companies.map((c) => c.role))], sectors: [...new Set(companies.map((c) => c.sector).filter(Boolean))].slice(0, 5), riskLevel: level, signals, signalTypes, pep, companies: companies.slice(0, 40) };
  }).sort((x, y) => y.companyCount - x.companyCount || y.totalValue - x.totalValue);
  const pepCount = personsIndex.filter((p) => p.pep).length;
  if (pepSource) console.log(`Iespējamas PEP (sakritība ar ${pepSource.split('—')[0].trim()}): ${pepCount}`);
  writeFileSync(join(dataDir, 'persons-index.json'), JSON.stringify({ meta, persons: personsIndex }));

  // search-index.json — SLANK indekss globālajai meklēšanai (tikai vārds/id/skaits), lai meklēšanai
  // nav jālādē pilnie winners-index (1MB) + persons-index (3,3MB). Lielākais mobilā ātruma ieguvums.
  writeFileSync(join(dataDir, 'search-index.json'), JSON.stringify({
    meta,
    winners: winners.map((w, i) => ({ winnerId: w.winnerId, fileId: fileIds[i], winnerName: w.winnerName, contracts: w.contracts, cfla: cflaData.byWinner[w.winnerId] ? 1 : undefined })),
    persons: personsIndex.map((p) => ({ name: p.name, companyCount: p.companyCount })),
  }));

  // ── Kontaktpersonu indekss ── meklēšanai pēc iepirkuma kontaktpersonas + procesa signāli:
  // vai vienas personas vadītajos iepirkumos dominē viens/saistīts uzvarētājs vai viens pretendents.
  const cNorm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/["'.,]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
  const cOrgKw = /\bsia\b|\bas\b|pašvald|dome|ministr|departament|nodaļ|iestād|centrs|speciālist|komisij|pārvald|aģentūr|birojs|skola|slimnīc|universitāt|valsts|kapitāl|grupa|projekt|padome|fonds|dienest|biedrīb|nodibinā|apvienīb|savienīb|asociācij|banka|institūt|koledža|teātr|muzej|bibliotēk/i;
  // Personai līdzīgs vārds: 2-3 tokeni, katrs sākas ar lielo burtu un satur mazo (izslēdz "biedrība", akronīmus SIA/VAS).
  const cIsName = (t: string) => /^[\p{Lu}][\p{L}'’-]*$/u.test(t) && /\p{Ll}/u.test(t);
  const personLike = (s: string) => { const t = s.trim().split(/\s+/); return t.length >= 2 && t.length <= 3 && t.every(cIsName) && !cOrgKw.test(s); };
  const supPersonNames = new Set<string>();
  for (const pw of personWinners.values()) supPersonNames.add(cNorm(pw.name));
  // Grupē pēc kontaktpersonas VĀRDS + ORGANIZĀCIJA (pasūtītājs). Privātuma labad NEGLABĀ e-pastu/tālruni.
  // SVARĪGI: iepirkumus skaita PA PROCEDŪRĀM (eisId/procedureId), ne atsevišķiem izsaukumiem — ietvarlīgumu/
  // vispārīgo vienošanos izsaukumi (viena procedūra, daudzi līgumi) sablīvēti vienā iepirkumā ar apakšizsaukumiem.
  type CRaw = { procKey: string; eisId: string | null; lotId: string; subjectName: string | null; winnerId: string | null; winnerName: string | null; value: number; bids: number | null; date: string | null; sourceUrl: string | null };
  type CAcc = { name: string; buyerId: string; organization: string | null; raw: CRaw[] };
  const contacts = new Map<string, CAcc>();
  for (const l of lots) {
    if (!l.winnerChosen || l.dupValue || !l.contactName || !l.buyerId) continue;
    if (!personLike(l.contactName)) continue; // tikai personām līdzīgi kontaktpunkti (ne iestādes/nodaļas)
    const key = cNorm(l.contactName) + '|' + l.buyerId;
    const a = contacts.get(key) ?? { name: l.contactName, buyerId: l.buyerId, organization: l.buyerName ?? null, raw: [] };
    const procKey = l.eisId ? 'eis' + l.eisId : (l.procedureId ? 'proc' + l.procedureId : 'lot' + l.id);
    a.raw.push({ procKey, eisId: l.eisId ?? null, lotId: l.id, subjectName: l.subjectName ?? null, winnerId: l.winnerId ?? null, winnerName: l.winnerName ?? null, value: l.awardValue ?? 0, bids: l.receivedBids ?? null, date: l.noticeDate ?? null, sourceUrl: l.sourceUrl ?? null });
    contacts.set(key, a);
  }
  const eisProcUrl = (eisId: string) => `https://www.eis.gov.lv/EKEIS/Supplier/Procurement/${eisId}`;
  const contactsIndex = [...contacts.values()].map((a) => {
    // Sablīvē izsaukumus pa procedūrām → iepirkumi (ietvarlīgums = viens iepirkums + N izsaukumi).
    const byProc = new Map<string, CRaw[]>();
    for (const r of a.raw) (byProc.get(r.procKey) ?? byProc.set(r.procKey, []).get(r.procKey)!).push(r);
    const procs = [...byProc.values()].map((rs) => {
      rs.sort((x, y) => y.value - x.value);
      const value = rs.reduce((s, r) => s + r.value, 0);
      const singleBid = rs.every((r) => r.bids === 1); // visi izsaukumi ar 1 pretendentu → viena-pretendenta iepirkums
      const dates = rs.map((r) => r.date).filter(Boolean).sort() as string[];
      const wv = new Map<string, { name: string | null; value: number }>();
      for (const r of rs) if (r.winnerId) { const w = wv.get(r.winnerId) ?? { name: r.winnerName, value: 0 }; w.value += r.value; wv.set(r.winnerId, w); }
      const topW = [...wv.entries()].sort((x, y) => y[1].value - x[1].value)[0];
      const eisId = rs.find((r) => r.eisId)?.eisId ?? null;
      return {
        subjectName: rs.find((r) => r.subjectName)?.subjectName ?? null,
        winnerId: topW?.[0] ?? null, winnerName: topW?.[1].name ?? rs[0].winnerName ?? null,
        winnerFileId: topW ? (fileIdByWinner.get(topW[0]) ?? null) : null,
        value: Math.round(value), callOffs: rs.length, singleBid,
        from: dates[0] ?? null, to: dates[dates.length - 1] ?? null,
        sourceUrl: eisId ? eisProcUrl(eisId) : rs[0].sourceUrl,
        lots: rs.slice(0, 30).map((r) => ({ winnerName: r.winnerName, winnerFileId: r.winnerId ? (fileIdByWinner.get(r.winnerId) ?? null) : null, value: Math.round(r.value), subjectName: r.subjectName, singleBid: r.bids === 1, date: r.date, sourceUrl: r.sourceUrl })),
      };
    }).sort((x, y) => y.value - x.value).slice(0, 50);
    const n = procs.length;
    const value = procs.reduce((s, p) => s + p.value, 0);
    const sbValue = procs.filter((p) => p.singleBid).reduce((s, p) => s + p.value, 0);
    const singleBidValueShare = value > 0 ? Math.round((sbValue / value) * 100) / 100 : 0;
    const singleBidRate = n > 0 ? Math.round((procs.filter((p) => p.singleBid).length / n) * 100) / 100 : 0;
    const wmap = new Map<string, { name: string | null; value: number; n: number }>();
    for (const p of procs) if (p.winnerId) { const w = wmap.get(p.winnerId) ?? { name: p.winnerName, value: 0, n: 0 }; w.value += p.value; w.n++; wmap.set(p.winnerId, w); }
    const winners = [...wmap.entries()].map(([reg, w]) => ({ fileId: fileIdByWinner.get(reg) ?? null, name: w.name, value: Math.round(w.value), contracts: w.n })).sort((x, y) => y.value - x.value);
    const distinctWinners = winners.length;
    const topWinnerShare = value > 0 ? Math.round(((winners[0]?.value ?? 0) / value) * 100) / 100 : 0;
    const relatedWinner = supPersonNames.has(cNorm(a.name));
    const signals: string[] = [];
    if (relatedWinner) signals.push('kontaktpersonas vārds sakrīt ar kāda uzvarētāja īpašnieku/valdi');
    if (n >= 2 && distinctWinners <= 2 && topWinnerShare >= 0.6 && value >= 300000) signals.push(`viens uzvarētājs iegūst ${Math.round(topWinnerShare * 100)}% no vērtības (${winners[0]?.name ?? ''})`);
    if (value >= 300000 && singleBidValueShare >= 0.6) signals.push(`${Math.round(singleBidValueShare * 100)}% tēriņa viena pretendenta iepirkumos`);
    const level: 'high' | 'med' | null =
      (relatedWinner && n >= 2) || (value >= 500000 && singleBidValueShare >= 0.7 && distinctWinners <= 2) ? 'high'
      : signals.length ? 'med' : null;
    return { name: a.name, organization: a.organization, procurements: n, callOffs: a.raw.length, value: Math.round(value), distinctWinners, topWinnerShare, singleBidRate, singleBidValueShare, winners: winners.slice(0, 8), signals, level, procs };
  }).sort((x, y) => ((y.level === 'high' ? 2 : y.level === 'med' ? 1 : 0) - (x.level === 'high' ? 2 : x.level === 'med' ? 1 : 0)) || y.value - x.value);
  writeFileSync(join(dataDir, 'contacts-index.json'), JSON.stringify({ meta, contacts: contactsIndex }));

  // ── Karteļa pazīmes uz REĀLIEM pretendentu tīkliem (EIS piedāvājumu atvēršanas dati) ──
  // Pretendentu PĀRI, kas bieži piedalās KOPĀ un EKSKLUZĪVI (bieži konkursā tikai viņi divi).
  // Konservatīvi: ≥5 kopā-dalības, ≥50% gadījumu tikai šie divi (izfiltrē likumīgos oligopolus —
  // apdrošinātāji/mazumtirgotāji piedalās visur ar zemu ekskluzivitāti). Klasificē: ROTĀCIJA
  // (uzvaras sadalītas ~līdzsvaroti) vs SEGUMS (viens vienmēr uzvar, otrs ~nekad). Saikni (related)
  // pastiprina kopīgs īpašnieks/adrese/persona. KAROGS NAV PIERĀDĪJUMS — bieži tas ir reāls 2-firmu tirgus.
  const eisWinBy = new Map<string, Set<string>>();
  const eisUrlBy = new Map<string, string>();
  for (const l of lots) {
    if (!l.eisId) continue;
    if (l.winnerId) (eisWinBy.get(l.eisId) ?? eisWinBy.set(l.eisId, new Set<string>()).get(l.eisId)!).add(l.winnerId);
    if (l.sourceUrl && !eisUrlBy.has(l.eisId)) eisUrlBy.set(l.eisId, l.sourceUrl);
  }
  type Pair = { n: number; aw: number; bw: number; duo: number; url: string | null };
  const pairs = new Map<string, Pair>();
  const bidderName = new Map<string, string | null>();
  for (const [eid, info] of Object.entries(eisData)) {
    const regs = [...new Set(info.bidders.map((b) => b.reg))].sort();
    if (regs.length < 2) continue;
    const wins = eisWinBy.get(eid) ?? new Set<string>();
    for (const b of info.bidders) if (!bidderName.has(b.reg)) bidderName.set(b.reg, b.name);
    const isduo = regs.length === 2;
    const url = eisUrlBy.get(eid) ?? null;
    for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) {
      const key = regs[i] + '|' + regs[j];
      const p = pairs.get(key) ?? { n: 0, aw: 0, bw: 0, duo: 0, url };
      p.n++; if (wins.has(regs[i])) p.aw++; if (wins.has(regs[j])) p.bw++; if (isduo) p.duo++;
      if (!p.url) p.url = url;
      pairs.set(key, p);
    }
  }
  // Saikne starp diviem pretendentiem: kopīga juridiskā adrese, holdinga ķēde vai kopīga persona.
  const relatedPair = (a: string, b: string): boolean => {
    const aa = regInfo[a]?.addressId, ba = regInfo[b]?.addressId;
    if (aa && ba && aa === ba) return true;
    const ah = winnerAnc.get(a), bh = winnerAnc.get(b);
    if (ah && bh) for (const x of ah) if (bh.has(x)) return true;
    const bk = new Set((regPersonKeys.get(b) ?? []).map((k) => k.pk));
    return (regPersonKeys.get(a) ?? []).some((k) => bk.has(k.pk));
  };
  type Ring = { a: { reg: string; name: string | null; fileId: string | null }; b: { reg: string; name: string | null; fileId: string | null }; coBids: number; duoShare: number; aWins: number; bWins: number; type: 'rotation' | 'cover'; related: boolean; sampleUrl: string | null };
  const ringList: Ring[] = [];
  for (const [key, p] of pairs) {
    if (p.n < 5) continue;
    const duoShare = p.duo / p.n;
    if (duoShare < 0.5) continue;
    const tot = p.aw + p.bw; if (tot < 2) continue;
    const [a, b] = key.split('|');
    let type: 'rotation' | 'cover' | null = null;
    if ((p.aw >= 5 && p.bw === 0) || (p.bw >= 5 && p.aw === 0)) type = 'cover';
    else if (p.aw / tot >= 0.3 && p.aw / tot <= 0.7) type = 'rotation';
    if (!type) continue;
    ringList.push({
      a: { reg: a, name: bidderName.get(a) ?? null, fileId: fileIdByWinner.get(a) ?? null },
      b: { reg: b, name: bidderName.get(b) ?? null, fileId: fileIdByWinner.get(b) ?? null },
      coBids: p.n, duoShare: Math.round(duoShare * 100) / 100, aWins: p.aw, bWins: p.bw,
      type, related: relatedPair(a, b), sampleUrl: p.url,
    });
  }
  ringList.sort((x, y) => (Number(y.related) - Number(x.related)) || (y.duoShare - x.duoShare) || (y.coBids - x.coBids));

  // Katram pārim — VISI kopīgie iepirkumi (ne tikai viens piemērs). Info no IUB lotiem pa eisId.
  const eisInfo = new Map<string, { buyer: string | null; subject: string | null; value: number; date: string | null; winners: Set<string>; url: string | null }>();
  for (const l of lots) {
    if (!l.eisId || !l.winnerChosen) continue;
    const e = eisInfo.get(l.eisId) ?? { buyer: l.buyerName ?? null, subject: l.subjectName ?? null, value: 0, date: l.noticeDate?.slice(0, 10) ?? null, winners: new Set<string>(), url: l.sourceUrl ?? null };
    if (!l.dupValue) e.value += l.awardValue ?? 0;
    if (l.winnerId) e.winners.add(l.winnerId);
    if (!e.buyer && l.buyerName) e.buyer = l.buyerName;
    if (!e.subject && l.subjectName) e.subject = l.subjectName;
    if (!e.url && l.sourceUrl) e.url = l.sourceUrl;
    eisInfo.set(l.eisId, e);
  }
  // ── Saistīti pretendenti VIENĀ iepirkumā ──
  // Divi "konkurenti" vienā piedāvājumu atvēršanā ar kopīgu personu/holdingu/adresi — fiktīvas
  // konkurences pazīme (un PIL izslēgšanas pamats). Rangs: persona > holdings > adrese (adrese tikai maza, ne biroju centrs).
  const relationKind = (a: string, b: string): 'persona' | 'holdings' | 'adrese' | null => {
    const bk = new Set((regPersonKeys.get(b) ?? []).map((k) => k.pk));
    if ((regPersonKeys.get(a) ?? []).some((k) => bk.has(k.pk))) return 'persona';
    const ah = winnerAnc.get(a), bh = winnerAnc.get(b);
    if (ah && bh) for (const x of ah) if (bh.has(x)) return 'holdings';
    const aa = regInfo[a]?.addressId, ba = regInfo[b]?.addressId;
    if (aa && ba && aa === ba && (regInfo[a]?.addrTotal ?? 99) <= 8) return 'adrese';
    return null;
  };
  const relatedInProc: { eid: string; buyer: string | null; subject: string | null; value: number; date: string | null; url: string | null; bidders: number; winnerReg: string | null; pairs: { a: { reg: string; name: string | null; fileId: string | null }; b: { reg: string; name: string | null; fileId: string | null }; kind: string }[] }[] = [];
  for (const [eid, info] of Object.entries(eisData)) {
    const regs = [...new Set(info.bidders.map((b) => b.reg))];
    if (regs.length < 2) continue;
    const nm = new Map(info.bidders.map((b) => [b.reg, b.name] as const));
    const rel: { a: { reg: string; name: string | null; fileId: string | null }; b: { reg: string; name: string | null; fileId: string | null }; kind: string }[] = [];
    for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) {
      const k = relationKind(regs[i], regs[j]);
      if (k) rel.push({
        a: { reg: regs[i], name: nm.get(regs[i]) ?? bidderName.get(regs[i]) ?? null, fileId: fileIdByWinner.get(regs[i]) ?? null },
        b: { reg: regs[j], name: nm.get(regs[j]) ?? bidderName.get(regs[j]) ?? null, fileId: fileIdByWinner.get(regs[j]) ?? null },
        kind: k,
      });
    }
    if (!rel.length) continue;
    const e = eisInfo.get(eid);
    relatedInProc.push({
      eid, buyer: e?.buyer ?? null, subject: e?.subject ?? null, value: Math.round(e?.value ?? 0),
      date: e?.date ?? null, url: e?.url ?? eisUrlBy.get(eid) ?? null,
      bidders: regs.length, winnerReg: e ? ([...e.winners][0] ?? null) : null, pairs: rel,
    });
  }
  // Rangs: persona pirms holdings pirms adreses; tad pēc vērtības.
  const kindRank = (r: typeof relatedInProc[number]) => Math.max(...r.pairs.map((p) => p.kind === 'persona' ? 3 : p.kind === 'holdings' ? 2 : 1));
  relatedInProc.sort((x, y) => kindRank(y) - kindRank(x) || y.value - x.value);
  const relatedTop = relatedInProc.slice(0, 200);

  const top = ringList.slice(0, 80);
  const ringKeys = new Set(top.map((r) => r.a.reg + '|' + r.b.reg));
  const pairEis = new Map<string, string[]>();
  for (const [eid, info] of Object.entries(eisData)) {
    const regs = [...new Set(info.bidders.map((b) => b.reg))].sort();
    if (regs.length < 2) continue;
    for (let i = 0; i < regs.length; i++) for (let j = i + 1; j < regs.length; j++) {
      const key = regs[i] + '|' + regs[j];
      if (ringKeys.has(key)) (pairEis.get(key) ?? pairEis.set(key, []).get(key)!).push(eid);
    }
  }
  const ringOut = top.map((r) => {
    const eids = pairEis.get(r.a.reg + '|' + r.b.reg) ?? [];
    const procs = eids.map((eid) => {
      const e = eisInfo.get(eid);
      if (!e) return null;
      const won: 'a' | 'b' | 'other' = e.winners.has(r.a.reg) ? 'a' : e.winners.has(r.b.reg) ? 'b' : 'other';
      return { buyer: e.buyer, subject: e.subject, value: Math.round(e.value), date: e.date, won, url: e.url };
    }).filter((x): x is NonNullable<typeof x> => x !== null).sort((x, y) => y.value - x.value).slice(0, 50);
    return { ...r, procs };
  });
  writeFileSync(join(dataDir, 'cartel-index.json'), JSON.stringify({
    meta,
    totals: {
      procurementsWithBidders: Object.values(eisData).filter((e) => e.n >= 2).length,
      pairs: ringList.length,
      rotation: ringList.filter((r) => r.type === 'rotation').length,
      cover: ringList.filter((r) => r.type === 'cover').length,
      related: ringList.filter((r) => r.related).length,
      relatedProcurements: relatedInProc.length,
    },
    pairs: ringOut,
    relatedInProc: relatedTop,
  }));

  // lots.json — pilni dati (datu kopa / atkārtotai apstrādei), nelasa frontend.
  writeFileSync(join(dataDir, 'lots.json'), JSON.stringify(lots));
  return meta;
}
