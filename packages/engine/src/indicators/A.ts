import type { Lot, RiskResult, EngineContext, AConfig } from '../types.ts';
import { BaseTenderRiskRule, riskFound, riskNotFound, noData, clamp } from '../base.ts';

// Indikators A — Iepirkumu sadalīšana ("contract splitting").
// Loģika (OCP metodoloģija): viens pasūtītājs īsā laika logā slēdz vairākus līdzīgus līgumus
// (viens CPV), no kuriem KATRS atsevišķi paliek zem procedūras sliekšņa S, bet KOPĀ to pārsniedz.
//
// Piezīme par datiem: pilnu jaudu indikators sasniedz, kad pieejami arī zemsliekšņa līgumi
// (iepirkumu reforma tos sāk publicēt). Uz publicētajiem paziņojumiem tas atrod kopas, kur
// vairāki zemsliekšņa līgumi vienā CPV sakrājas pāri slieksnim.

type Cluster = {
  cpv4: string;
  members: { id: string; value: number | null; date: string | null; winnerId: string | null; winnerName: string | null; sourceUrl: string | null }[];
  count: number;
  sum: number;
  threshold: number;
  sumRatio: number;       // sum / S
  sameWinner: boolean;
  nearThreshold: number;  // cik līgumu ir "tuvu slieksnim" joslā
  from: string | null;
  to: string | null;
  level: 'yellow' | 'red';
};

function thresholdFor(cpv: string | null | undefined, cfg: AConfig): number {
  return (cpv ?? '').startsWith('45') ? cfg.thresholdWorks : cfg.thresholdGoods;
}
function cpv4(cpv: string | null | undefined): string {
  return (cpv ?? '').replace(/[^0-9]/g, '').slice(0, 4) || '????';
}
function ts(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : t;
}

export class IndicatorA extends BaseTenderRiskRule {
  override identifier = 'A';
  override name = 'Iepirkumu sadalīšana';
  override layer = 'A';
  override legalBasis = 'PIL sliekšņu apiešanas aizliegums';
  override procedureTypes = null; // visi tipi (sadalīšana izmanto zemsliekšņa procedūras)

  override processBuyer(buyerId: string, lots: Lot[], ctx: EngineContext): RiskResult {
    const cfg = ctx.a;
    const buyerName = lots.find((l) => l.buyerName)?.buyerName ?? null;
    // Tikai līgumi ar summu, CPV un datumu.
    const usable0 = lots.filter((l) => l.winnerChosen && l.awardValue != null && l.cpv && ts(l.noticeDate) !== null);
    // Sablīvē pa procedūru: vairāki VIENA iepirkuma loti NAV sadalīšana (tā ir viena procedūra ar
    // vairākiem lotiem, kas ir pilnīgi likumīgi). Apvienojam tos vienā ierakstā (summējam vērtības,
    // ņemam agrāko datumu), lai A skaita atsevišķas PROCEDŪRAS, ne lotus. Sadalīšana = vairākas
    // ATSEVIŠĶAS procedūras, ne viens daudzlotu iepirkums.
    // Iepirkuma identitāte: priekšroka EIS iepirkuma numuram (sourceUrl .../Procurement/<id>), jo
    // viens EIS iepirkums mēdz parādīties vairākos paziņojumos ar dažādiem iekšējiem procedureId.
    const procKey = (l: Lot): string | null => {
      const m = (l.sourceUrl ?? '').match(/Procurement\/(\d+)/);
      return m ? `eis${m[1]}` : (l.procedureId ?? null);
    };
    const byProc = new Map<string, Lot[]>();
    const usable: Lot[] = [];
    for (const l of usable0) {
      const pk = procKey(l);
      if (pk) { (byProc.get(pk) ?? byProc.set(pk, []).get(pk)!).push(l); }
      else usable.push(l);
    }
    for (const arr of byProc.values()) {
      if (arr.length === 1) { usable.push(arr[0]); continue; }
      const sum = arr.reduce((s, l) => s + (l.awardValue ?? 0), 0);
      const winners = new Set(arr.map((l) => l.winnerId).filter(Boolean));
      const earliest = arr.reduce((a, b) => (ts(a.noticeDate)! <= ts(b.noticeDate)! ? a : b));
      usable.push({ ...earliest, awardValue: sum, winnerId: winners.size === 1 ? [...winners][0]! : earliest.winnerId });
    }
    if (usable.length < 2) {
      return noData('A', 'buyer', buyerId, { detail: { buyerName, usableLots: usable.length, reason: 'nepietiek datu' } });
    }

    // Grupē pa CPV4.
    const groups = new Map<string, Lot[]>();
    for (const l of usable) {
      const k = cpv4(l.cpv);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
    }

    const windowMs = cfg.windowDays * 86400000;
    const clusters: Cluster[] = [];

    for (const [k, arr] of groups) {
      const S = thresholdFor(arr[0].cpv, cfg);
      // Tikai zemsliekšņa līgumi (katrs < S) ir sadalīšanas kandidāti.
      const cand = arr.filter((l) => (l.awardValue ?? 0) < S).sort((a, b) => ts(a.noticeDate)! - ts(b.noticeDate)!);
      let i = 0;
      while (i < cand.length) {
        // maksimālais logs no i
        let j = i;
        while (j + 1 < cand.length && ts(cand[j + 1].noticeDate)! - ts(cand[i].noticeDate)! <= windowMs) j++;
        const window = cand.slice(i, j + 1);
        const sum = window.reduce((s, l) => s + (l.awardValue ?? 0), 0);
        const near = window.filter((l) => (l.awardValue ?? 0) >= cfg.nearThresholdRatio * S).length;
        // Sadalīšanas pazīme (OCP): vismaz 2 līgumi TUVU slieksnim, kopā pāri S.
        // Sīki atkārtoti pirkumi (zem tuvuma joslas) NETIEK karogoti, lai mazinātu viltus pozitīvos.
        if (window.length >= 2 && sum > S && near >= 2) {
          const winners = new Set(window.map((l) => l.winnerId).filter(Boolean));
          const sameWinner = winners.size === 1;
          // Sarkans TIKAI pie spēcīga signāla: viens un tas pats uzvarētājs (sadalīšana par labu
          // vienam piegādātājam) VAI daudz fragmentu (≥redCount). Tikai liela kopsumma ar DAŽĀDIEM
          // uzvarētājiem nav sarkans — tās var būt arī divas atšķirīgas vajadzības tajā pašā CPV grupā.
          const red = sameWinner || near >= cfg.redCount;
          clusters.push({
            cpv4: k,
            members: window.map((l) => ({ id: l.id, value: l.awardValue ?? null, date: l.noticeDate ?? null, winnerId: l.winnerId ?? null, winnerName: l.winnerName ?? null, sourceUrl: l.sourceUrl ?? null })),
            count: window.length, sum: round(sum, 2),
            threshold: S, sumRatio: round(sum / S, 2), sameWinner, nearThreshold: near,
            from: window[0].noticeDate ?? null, to: window[window.length - 1].noticeDate ?? null,
            level: red ? 'red' : 'yellow',
          });
          i = j + 1; // negrēķina pārklājošās kopas
        } else {
          i++;
        }
      }
    }

    const detail = { buyerName, usableLots: usable.length, clusterCount: clusters.length, clusters };

    if (clusters.length === 0) {
      return riskNotFound('A', 'buyer', buyerId, 0, { detail });
    }

    // Score no smagākās kopas + neliels pieaugums par kopu skaitu.
    let best = 0;
    for (const c of clusters) {
      let cs = 30;                                   // dzeltens bāze
      if (c.count >= cfg.redCount) cs += 25;
      if (c.sameWinner) cs += 25;
      if (c.sumRatio > cfg.redSumRatio) cs += 20;
      if (c.level === 'red') cs = Math.max(cs, 70);  // garantēti sarkana josla
      best = Math.max(best, cs);
    }
    const score = Math.round(clamp(best + Math.min(15, (clusters.length - 1) * 5), 0, 100));
    const level = clusters.some((c) => c.level === 'red') || score >= 70 ? 'red'
      : score >= 30 ? 'yellow' : null;
    if (level) return riskFound('A', 'buyer', buyerId, level, score, { detail });
    return riskNotFound('A', 'buyer', buyerId, score, { detail });
  }
}

function round(x: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(x * f) / f;
}
