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
  // `seen` — viena līguma ietvaros katra uzvarētāja (reģ.nr. kopas atslēga) jau ieskaitītās vērtības.
  // Divi gadījumi, kad VIENS uzvarētājs vienā līgumā parādās vairākkārt:
  //   1) IUB decimālpunkta/mērvienības kļūda: 178573.54 un 17857354 (= tā pati summa ×100) —
  //      NEDRĪKST summēt; paturam mazāko (īsto), izmetam ×10^k dublikātu.
  //   2) Reāli vairāki līguma posmi/daļas: 1 654 745,60 + 2 482 118,40 = 4 136 864 (1,5× attiecība) —
  //      tās ir atšķirīgas summas, kas JĀSUMMĒ.
  // Atšķiram pēc tā, vai lielākā vērtība ir mazākās tieša 10. pakāpes reizinājums (×10/×100/×1000).
  const isPow10Dup = (a: number, b: number): boolean => {
    const hi = Math.max(a, b), lo = Math.min(a, b);
    if (lo <= 0) return false;
    const r = hi / lo;
    for (const p of [10, 100, 1000, 10000]) if (Math.abs(r - p) < 1e-6 * p) return true;
    return false;
  };
  const consider = (winnersArr: any, partiesKey: string, companyKey: string, seen: Map<string, number[]>): boolean => {
    let added = false;
    let idx = 0;
    for (const w of asArray<AnyObj>(winnersArr)) {
      const v = num(w?.tenderValue?.amount ?? w?.tenderValue);
      const parties = asArray<AnyObj>(w?.[partiesKey]);
      const ids = parties.map((p) => p?.[companyKey] ?? p?.companyId).filter((id) => typeof id === 'string' && id.trim() !== '');
      const key = ids.length ? [...ids].sort().join('+') : `__noid_${idx++}`;
      if (v !== null) {
        const prevVals = seen.get(key) ?? [];
        // Vai šī vērtība ir kāda jau ieskaitīta ieraksta 10^k dublikāts?
        const dupIdx = prevVals.findIndex((pv) => isPow10Dup(pv, v));
        if (dupIdx >= 0) {
          // Dublikāts ar mērvienības kļūdu — paturam mazāko, izmetam lielāko.
          const prev = prevVals[dupIdx];
          if (v < prev) { total += (v - prev); prevVals[dupIdx] = v; }
          // ja v lielāks — ignorējam (paliek mazākā)
        } else {
          // Jauna, atšķirīga summa (vai pirmais ieraksts) — ieskaitām.
          total += v; hasValue = true; added = true; prevVals.push(v);
        }
        seen.set(key, prevVals);
      }
      for (const p of parties) {
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
    const seen = new Map<string, number[]>();
    const got = consider(c?.winners, 'winnerBusinessParties', 'companyId', seen);
    if (!got) consider(c?.actualWinners, 'actualWinnerBusinessParties', 'companyId', seen);
  }
  consider(lot.winners, 'winnerBusinessParties', 'companyId', new Map<string, number[]>());
  return { winnerId: bestId, winnerName: bestName, awardValue: hasValue ? total : null };
}

// EIS (Elektronisko iepirkumu sistēma) deep-link uz konkrēto iepirkumu — strādājoša publiska saite.
// Atrodas lot.contracts[].url (piem. https://www.eis.gov.lv/EKEIS/Supplier/Procurement/<id>).
// Atgriež TIKAI strādājošu dziļo saiti uz konkrēto iepirkumu EIS: .../Procurement/<id>.
// Citas saites (/Organizer/<id> = pasūtītāja profils, kails domēns, kropļotas) ved uz EIS
// sākumskatu, ne konkrēto iepirkumu — tās NEATGRIEŽAM (labāk nav saites nekā maldinoša saite).
function extractEisUrl(lot: AnyObj): string | null {
  const contracts = Array.isArray(lot.contracts) ? lot.contracts : asArray<AnyObj>(lot.contracts);
  const isProcurement = (u: unknown): u is string =>
    typeof u === 'string' && /\/Procurement\/\d{4,}(?:[/?#]|$)/i.test(u);
  // Vispirms meklē Procurement dziļo saiti jebkurā līgumā.
  for (const c of contracts) if (isProcurement(c?.url)) return c.url;
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

  // Piezīme: agrāk bija atkāpšanās uz buyer.client (EIS /Organizer/ saite), bet tā ved uz pasūtītāja
  // profilu / sākumskatu, ne konkrēto iepirkumu (maldinoši). Tagad rādām saiti TIKAI ja ir Procurement
  // dziļā saite; citādi sourceUrl=null un UI saiti nerāda.
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
      sourceUrl: eisUrl,
      nutsCode: buyer.nutsCode,
    });
  }
  return out;
}

// Noņem dublētus PIEŠĶĪRUMUS, kas atkārtojas dažādos paziņojumos (republikācija) vai vienā
// paziņojumā kā bloks. Tie ir viens un tas pats darījums ar atšķirīgu lot.id, tāpēc dedupeById tos
// nesaķer un tie 2–3× uzpūš gan SKAITĻUS, gan vērtības. Atslēga: procedūra|uzvarētājs|vērtība|datums|CPV.
// Skar tikai piešķirtos līgumus ar zināmu procedūru un uzvarētāju; pārējos atstāj neskartus.
// Republikācijas ar KOMATA kļūdu: tā pati procedūra + uzvarētājs + CPV + pretendentu skaits, bet
// vērtība atšķiras tieši ×10^k (piem. 4 409 391,36 → 440 939 136, vai 2 096 383 → 209 638 300).
// Tā ir VIENA UN TĀ PATI piešķiršana, kur vienā paziņojumā nobīdīts decimālpunkts. dedupeAwards to
// nesaķer, jo round(value) atšķiras. Paturam MAZĀKO (ticamāko) vērtību, izmetam uzpūstos dvīņus —
// konservatīvi (labāk nedaudz nenovērtēt nekā uzpūst). Tikai identiska paraksta gadījumā (CPV +
// pretendenti sakrīt), lai nesajauktu ar reāliem atsevišķiem tās pašas procedūras lotiem.
function dropDecimalTypoDuplicates(lots: Lot[]): Lot[] {
  const groups = new Map<string, Lot[]>();
  for (const l of lots) {
    if (!(l.winnerChosen && l.procedureId && l.winnerId && l.awardValue && l.awardValue > 0)) continue;
    const k = `${l.procedureId}|${l.winnerId}|${l.cpv ?? ''}|${l.receivedBids ?? -1}`;
    const a = groups.get(k); if (a) a.push(l); else groups.set(k, [l]);
  }
  const drop = new Set<Lot>();
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const min = Math.min(...arr.map((l) => l.awardValue as number));
    for (const l of arr) {
      const r = (l.awardValue as number) / min;
      if (r <= 1.0000001) continue;
      for (const p of [10, 100, 1000, 10000]) {
        if (Math.abs(r - p) < 1e-6 * p) { drop.add(l); break; }
      }
    }
  }
  return drop.size ? lots.filter((l) => !drop.has(l)) : lots;
}

// EIS iepirkuma numurs no sourceUrl (.../Procurement/<id>) — VIENS EIS iepirkums mēdz parādīties
// vairākos paziņojumos ar DAŽĀDIEM iekšējiem procedureId (oriģināls + republikācija/labojums).
export function eisProcurementId(l: Lot): string | null {
  const m = (l.sourceUrl ?? '').match(/Procurement\/(\d+)/);
  return m ? m[1] : null;
}

// Vispārīga dedublēšana: lotus ar vienādu (ne-null) atslēgu sablīvē vienā, paturot ierakstu ar
// LIELĀKO pretendentu skaitu (lai nejaušs dublikāts ar receivedBids=1 nerada viltus B1 karogu).
// Loti ar null atslēgu iziet cauri neskarti.
function dedupeBy(lots: Lot[], keyOf: (l: Lot) => string | null): Lot[] {
  const bestBids = new Map<string, number>();
  for (const l of lots) {
    const k = keyOf(l);
    if (k === null) continue;
    const b = l.receivedBids ?? -1;
    if (!bestBids.has(k) || b > bestBids.get(k)!) bestBids.set(k, b);
  }
  const used = new Set<string>();
  const out: Lot[] = [];
  for (const l of lots) {
    const k = keyOf(l);
    if (k !== null) {
      if (used.has(k)) continue;
      if ((l.receivedBids ?? -1) !== bestBids.get(k)) continue; // patur tikai grupas labāko ierakstu
      used.add(k);
    }
    out.push(l);
  }
  return out;
}

export function dedupeAwards(lots: Lot[]): Lot[] {
  // 1. caurlaide — pēc iekšējā procedureId (oriģinālā loģika).
  let out = dedupeBy(lots, (l) =>
    (l.winnerChosen && l.procedureId && l.winnerId)
      ? `${l.procedureId}|${l.winnerId}|${Math.round(l.awardValue ?? -1)}|${l.noticeDate ?? ''}|${l.cpv ?? ''}`
      : null);
  // 2. caurlaide — pēc EIS iepirkuma numura: ķer republikācijas, kur tas pats EIS iepirkums
  // parādās ar DAŽĀDIEM procedureId (piem. EIS 113795: €87 980 ×2). Tikai lotiem ar EIS numuru.
  out = dedupeBy(out, (l) => {
    if (!(l.winnerChosen && l.winnerId && l.awardValue)) return null;
    const eis = eisProcurementId(l);
    return eis ? `eis${eis}|${l.winnerId}|${Math.round(l.awardValue)}|${l.noticeDate ?? ''}|${l.cpv ?? ''}` : null;
  });
  return dropDecimalTypoDuplicates(out);
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
    // Aktuālajiem konkursiem documentsURL/submissionURL ir īstā tender saite; buyer.client (Organizer)
    // ved uz sākumskatu, tāpēc to vairs neizmantojam (labāk nav saites nekā maldinoša).
    const tenderUrl = eisUrl(n.tenderingProcess?.documentsURL) ?? eisUrl(n.tenderingTerms?.submissionURL) ?? null;
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
// Atrod EIS saiti objektā, dodot priekšroku strādājošai Procurement dziļajai saitei.
// /Organizer/ u.c. (ved uz sākumskatu) NEATGRIEŽAM — labāk nav saites nekā maldinoša.
function eisFrom(obj: AnyObj): string | null {
  const urls: string[] = [];
  const stack = [obj];
  while (stack.length) {
    const o = stack.pop();
    if (!o || typeof o !== 'object') continue;
    for (const v of Object.values(o)) {
      if (typeof v === 'string' && v.includes('eis.gov.lv') && v.startsWith('http')) urls.push(v);
      else if (v && typeof v === 'object') stack.push(v as AnyObj);
    }
  }
  return urls.find((u) => /\/Procurement\/\d{4,}(?:[/?#]|$)/i.test(u)) ?? null;
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
      sourceUrl: eisFrom(n),
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
