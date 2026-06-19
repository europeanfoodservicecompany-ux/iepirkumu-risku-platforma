import type { Lot, Modification } from '../../engine/src/types.ts';

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
function pickBuyer(notice: AnyObj): { id: string | null; name: string | null; client: string | null; nutsCode: string | null } {
  const orgs = asArray<AnyObj>(notice.organizationData);
  if (orgs.length === 0) return { id: null, name: null, client: null, nutsCode: null };
  const buyer =
    orgs.find((o) => o?.role === 'buyer') ??
    orgs.find((o) => typeof o?.role === 'string' && o.role.startsWith('cpb')) ??
    orgs[0];
  const client = typeof buyer?.websiteURIClient === 'string' && buyer.websiteURIClient.includes('eis.gov.lv')
    ? buyer.websiteURIClient : null;
  return { id: buyer?.identifier ?? null, name: buyer?.name ?? null, client, nutsCode: typeof buyer?.nutsCode === 'string' ? buyer.nutsCode : null };
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
  // Piezīme: ietvara līgumiem ar vairākiem līdzuzvarētājiem winner.tenderValue ir tukšs un
  // contract.tenderPaymentValue ir KOPĒJS bez sadalījuma — to nevar korekti attiecināt uz vienu
  // uzvarētāju (mūsu modelis: viens līgums = viens uzvarētājs), tāpēc šādu vērtību NEIESKAITĀM
  // (labāk iztrūkst, nekā nepareizi uzpūsts). Skaidrots metodoloģijā.
  // Atgriež true, ja pievienoja kādu vērtību (lai nedubultotu winners + actualWinners).
  const consider = (winnersArr: any, partiesKey: string, companyKey: string): boolean => {
    let added = false;
    for (const w of asArray<AnyObj>(winnersArr)) {
      const v = num(w?.tenderValue?.amount ?? w?.tenderValue);
      if (v !== null) { total += v; hasValue = true; added = true; }
      for (const p of asArray<AnyObj>(w?.[partiesKey])) {
        const id = p?.[companyKey] ?? p?.companyId;
        if (typeof id === 'string' && id.trim() !== '') {
          const weight = v ?? 0;
          if (weight > bestVal) { bestVal = weight; bestId = id; bestName = p?.name ?? null; }
        }
      }
    }
    return added;
  };
  // winners un actualWinners ir VIENS UN TAS PATS darījums (plānotā vs faktiskā vērtība) —
  // tos NEDRĪKST summēt. Izmantojam winners (sakrīt ar IUB noticeContractValue); ja tur nav
  // vērtības, krītam atpakaļ uz actualWinners.
  for (const c of contracts) {
    const got = consider(c?.winners, 'winnerBusinessParties', 'companyId');
    if (!got) consider(c?.actualWinners, 'actualWinnerBusinessParties', 'companyId');
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
      nutsCode: buyer.nutsCode,
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

// ── Līguma grozījumi no 'cont-modif' paziņojumiem ──
// Reālā formāta atziņa: iemesls — tenderResult.modificationReasonCode
//   (add-wss=papildu darbi/piegādes, mod-repl=izpildītāja maiņa, mod-cir=neparedzami apstākļi,
//    mod-nons=nebūtisks, mod-rev=pārskatīšanas klauzula, mod-minv=de minimis).
// Uzvarētājs/vērtība — draftContract.winners[]. Sasaiste ar oriģinālu — procurementProcedureIdentifier.
function eisFrom(obj: AnyObj): string | null {
  const stack = [obj];
  while (stack.length) {
    const o = stack.pop();
    if (!o || typeof o !== 'object') continue;
    for (const v of Object.values(o)) {
      if (typeof v === 'string' && v.includes('eis.gov.lv') && v.startsWith('http')) return v;
      if (v && typeof v === 'object') stack.push(v as AnyObj);
    }
  }
  return null;
}

export function parseModifications(notices: AnyObj[]): Modification[] {
  const out: Modification[] = [];
  for (const n of notices) {
    if (n?.formType !== 'cont-modif') continue;
    const buyer = pickBuyer(n);
    if (!buyer.id) continue;
    const tr = n.tenderResult ?? {};
    const winners = asArray<AnyObj>(n.draftContract?.winners);
    let value: number | null = null;
    let winnerName: string | null = null;
    let bestVal = -1;
    for (const w of winners) {
      const v = num(w?.tenderValue?.amount ?? w?.tenderValue);
      if (v !== null) value = (value ?? 0) + v;
      const party = asArray<AnyObj>(w?.businessParty)[0];
      const nm = party?.name;
      if ((v ?? 0) > bestVal && typeof nm === 'string' && nm) { bestVal = v ?? 0; winnerName = nm; }
    }
    const desc = typeof tr.modificationDescription === 'string' ? tr.modificationDescription.slice(0, 400) : null;
    out.push({
      procedureId: n.procurementProcedureIdentifier ?? null,
      buyerId: buyer.id,
      buyerName: buyer.name,
      cpv: n.cpvType ?? null,
      reasonCode: tr.modificationReasonCode ?? null,
      reasonDescription: typeof tr.modificationReasonDescription === 'string' ? tr.modificationReasonDescription : null,
      description: desc,
      value,
      winnerName,
      sourceUrl: eisFrom(n) ?? buyer.client,
      date: parseDate(n.tenderResult?.decisionDate ?? n.dispatchDate ?? null),
      name: n.name ?? n.procurementProject?.description ?? null,
    });
  }
  return out;
}

// Grupē grozījumus pēc pasūtītāja reģ. nr. (dzinēja kontekstam).
export function groupModificationsByBuyer(mods: Modification[]): Map<string, Modification[]> {
  const m = new Map<string, Modification[]>();
  for (const x of mods) {
    if (!m.has(x.buyerId)) m.set(x.buyerId, []);
    m.get(x.buyerId)!.push(x);
  }
  return m;
}

// Tikai vēl atvērtie (iesniegšanas termiņš nākotnē vai šodien).
export function filterOpenTenders(tenders: ActiveTender[], todayISO: string): ActiveTender[] {
  return tenders
    .filter((t) => t.deadline && t.deadline >= todayISO)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
}
