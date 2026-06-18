import type { Lot } from '../../engine/src/types.ts';

// ── eForms → lots parsētājs ──
// Balstīts uz REĀLO IUB atvērto datu struktūru (open.iub.gov.lv), pārbaudītu pret
// publiskā datu lauka aprakstu (publiskie_iepirkumi_metadata.json) un reāliem dienas failiem.
//
// Svarīga reālā formāta atziņa: saņemto piedāvājumu skaits NAV tieši "BT-759",
// bet atrodas šeit:  lots[].tenderingProcess.receivedSubmissionsStatistics.receivedNumberOfOffers
// Uzvarētāja statuss:  lots[].result.winnerSelectionStatus  ('selec-w' = izvēlēts, 'clos-nw' = bez uzvarētāja)

export const IUB_NOTICE_BASE_URL = 'https://info.iub.gov.lv/lv/eforms/';

const WINNER_SELECTED = 'selec-w'; // BT-142: uzvarētājs izvēlēts

type AnyObj = Record<string, any>;

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x === null || x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}

// Atrod pasūtītāju no organizationData (var būt dict vai saraksts; lomas: buyer / cpb-*).
function pickBuyer(notice: AnyObj): { id: string | null; name: string | null; client: string | null } {
  const orgs = asArray<AnyObj>(notice.organizationData);
  if (orgs.length === 0) return { id: null, name: null, client: null };
  const buyer =
    orgs.find((o) => o?.role === 'buyer') ??
    orgs.find((o) => typeof o?.role === 'string' && o.role.startsWith('cpb')) ??
    orgs[0];
  const client = typeof buyer?.websiteURIClient === 'string' && buyer.websiteURIClient.includes('eis.gov.lv')
    ? buyer.websiteURIClient : null;
  return { id: buyer?.identifier ?? null, name: buyer?.name ?? null, client };
}

// dd/mm/yyyy → ISO (yyyy-mm-dd); citādi null.
function parseDate(d: unknown): string | null {
  if (typeof d !== 'string') return null;
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const iso = d.match(/^\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : null;
}

function num(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string' && x.trim() !== '' && !Number.isNaN(Number(x))) return Number(x);
  return null;
}

// Izvelk uzvarētāju(s) un summu no lot.contracts[].winners[].winnerBusinessParties[].companyId.
// Atgriež primāro uzvarētāju (ar lielāko tenderValue) un kopējo piešķirto summu (BT-720).
function extractWinner(lot: AnyObj): { winnerId: string | null; winnerName: string | null; awardValue: number | null } {
  const contracts = Array.isArray(lot.contracts) ? lot.contracts : asArray<AnyObj>(lot.contracts);
  let total = 0; let hasValue = false;
  let bestId: string | null = null; let bestName: string | null = null; let bestVal = -1;
  const consider = (winnersArr: any, partiesKey: string, companyKey: string) => {
    for (const w of asArray<AnyObj>(winnersArr)) {
      const v = num(w?.tenderValue?.amount ?? w?.tenderValue);
      if (v !== null) { total += v; hasValue = true; }
      for (const p of asArray<AnyObj>(w?.[partiesKey])) {
        const id = p?.[companyKey] ?? p?.companyId;
        if (typeof id === 'string' && id.trim() !== '') {
          const weight = v ?? 0;
          if (weight > bestVal) { bestVal = weight; bestId = id; bestName = p?.name ?? null; }
        }
      }
    }
  };
  for (const c of contracts) {
    consider(c?.winners, 'winnerBusinessParties', 'companyId');
    consider(c?.actualWinners, 'actualWinnerBusinessParties', 'companyId');
  }
  consider(lot.winners, 'winnerBusinessParties', 'companyId');
  return { winnerId: bestId, winnerName: bestName, awardValue: hasValue ? total : null };
}

// EIS (Elektronisko iepirkumu sistēma) deep-link uz konkrēto iepirkumu — strādājoša publiska saite.
// Atrodas lot.contracts[].url (piem. https://www.eis.gov.lv/EKEIS/Supplier/Procurement/<id>).
function extractEisUrl(lot: AnyObj): string | null {
  const contracts = Array.isArray(lot.contracts) ? lot.contracts : asArray<AnyObj>(lot.contracts);
  for (const c of contracts) {
    if (c && typeof c.url === 'string' && c.url.startsWith('http')) return c.url;
  }
  return null;
}

// Parsē vienu paziņojumu uz lots masīvu. Apstrādā tikai 'result' veidlapas
// (tikai tajās ir rezultāts un saņemto piedāvājumu statistika).
export function parseNotice(notice: AnyObj, baseUrl = IUB_NOTICE_BASE_URL): Lot[] {
  if (notice?.formType !== 'result') return [];
  const buyer = pickBuyer(notice);
  if (!buyer.id) return [];

  const noticeId: string = notice.identifier ?? '';
  const procedureId: string | null = notice.procurementProcedureIdentifier ?? null;
  const cpv: string | null = notice.cpvType ?? null;
  const procedureType: string | null = notice.tenderingProcess?.procedureType ?? null;
  void baseUrl; // info.iub deep-links nedarbojas; izmantojam EIS saites

  const winner_clientFallback = buyer.client;
  const out: Lot[] = [];
  for (const lot of asArray<AnyObj>(notice.lots)) {
    const result = lot.result ?? {};
    const stats = lot.tenderingProcess?.receivedSubmissionsStatistics ?? {};
    const winner = extractWinner(lot);
    const eisUrl = extractEisUrl(lot);
    const lotId: string = String(lot.id ?? `${noticeId}:${lot.sequenceNumber ?? out.length}`);
    out.push({
      id: lotId,
      noticeId,
      procedureId,
      buyerId: buyer.id,
      buyerName: buyer.name,
      cpv,
      receivedBids: num(stats.receivedNumberOfOffers),
      winnerChosen: result.winnerSelectionStatus === WINNER_SELECTED,
      awardValue: winner.awardValue,
      winnerId: winner.winnerId,
      winnerName: winner.winnerName,
      procedureType,
      noticeDate: parseDate(result.decisionDate),
      sourceUrl: eisUrl ?? winner_clientFallback,
    });
  }
  return out;
}

// Parsē veselu paziņojumu masīvu (dienas fails) uz lots.
export function parseNotices(notices: AnyObj[], baseUrl = IUB_NOTICE_BASE_URL): Lot[] {
  const lots: Lot[] = [];
  for (const n of notices) lots.push(...parseNotice(n, baseUrl));
  return lots;
}

// ── Aktuālie (notiekošie) konkursi no 'competition' paziņojumiem ──
export type ActiveTender = {
  id: string; buyerId: string; buyerName: string | null;
  cpv: string | null; name: string | null; procedureType: string | null;
  deadline: string | null; deadlineTime: string | null;
  estimatedValue: number | null; sourceUrl: string | null; publishedDate: string | null;
};

export function parseActiveTenders(notices: AnyObj[], baseUrl = IUB_NOTICE_BASE_URL): ActiveTender[] {
  const out: ActiveTender[] = [];
  for (const n of notices) {
    if (n?.formType !== 'competition') continue;
    const buyer = pickBuyer(n);
    if (!buyer.id) continue;
    const lot0 = (Array.isArray(n.lots) ? n.lots[0] : null) ?? {};
    const tp = lot0.tenderingProcess ?? {};
    const eisUrl = (s: unknown) => (typeof s === 'string' && s.includes('eis.gov.lv') ? s : null);
    const tenderUrl = eisUrl(n.tenderingProcess?.documentsURL) ?? eisUrl(n.tenderingTerms?.submissionURL) ?? buyer.client ?? null;
    const estimated = num(lot0.additionalInformation?.estimatedValue ?? n.automaticallyCalculated?.statementValue?.estimatedValue?.sum);
    const noticeId: string = n.identifier ?? '';
    out.push({
      id: noticeId,
      buyerId: buyer.id, buyerName: buyer.name,
      cpv: n.cpvType ?? null, name: n.name ?? null,
      procedureType: n.tenderingProcess?.procedureType ?? null,
      deadline: parseDate(tp.deadlineReceiptTendersEndDate),
      deadlineTime: typeof tp.deadlineReceiptTendersEndTime === 'string' ? tp.deadlineReceiptTendersEndTime : null,
      estimatedValue: estimated,
      sourceUrl: tenderUrl,
      publishedDate: null,
    });
  }
  return out;
}

// Tikai vēl atvērtie (iesniegšanas termiņš nākotnē vai šodien).
export function filterOpenTenders(tenders: ActiveTender[], todayISO: string): ActiveTender[] {
  return tenders
    .filter((t) => t.deadline && t.deadline >= todayISO)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
}
