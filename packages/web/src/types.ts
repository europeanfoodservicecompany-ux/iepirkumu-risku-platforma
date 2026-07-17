export type RiskStatus = 'RiskFound' | 'RiskNotFound' | 'NoData' | 'NotApplicable';
export type RiskLevel = 'yellow' | 'red' | null;

export type RiskResult = {
  indicator: string;
  scope: 'lot' | 'buyer';
  lotId?: string | null;
  buyerId: string;
  status: RiskStatus;
  level: RiskLevel;
  score: number | null;
  detail?: {
    buyerName?: string | null;
    winnerChosenLots?: number;
    singleBidLots?: number;
    nationalAvg?: number;
    singleBidRate?: number;
    singleBidValueRate?: number;
    expectedRate?: number;
    relativeRatio?: number;
    flaggedLotIds?: string[];
    receivedBids?: number | null;
    sourceUrl?: string | null;
    reason?: string;
    // B2 (uzvarētāju koncentrācija)
    hhi?: number;
    topWinnerShare?: number;
    topWinnerId?: string;
    topWinnerName?: string | null;
    distinctWinners?: number;
    awardedLots?: number;
    totalAwardValue?: number | null;
    basis?: string;
    // A (sadalīšana)
    clusterCount?: number;
    usableLots?: number;
    clusters?: {
      cpv4: string; count: number; sum: number; threshold: number;
      members: { id: string; value: number | null; date: string | null; winnerId: string | null; winnerName: string | null; sourceUrl: string | null }[];
      sumRatio: number; sameWinner: boolean; nearThreshold: number;
      from: string | null; to: string | null; level: 'yellow' | 'red';
    }[];
    // C (cenu/vērtības novirze)
    maxZ?: number;
    evaluatedLots?: number;
    priceFlags?: { lotId: string; value: number; cpv: string | null; z: number; obs: number; sourceUrl: string | null }[];
    // E (procedūras integritāte)
    nonCompetitiveLots?: number;
    nonCompetitiveShare?: number;
    // D (saistītās puses)
    evaluableAwards?: number;
    newWinnerAwards?: number;
    veryNewAwards?: number;
    newWinners?: { lotId: string; winnerId: string; winnerName: string | null; registered: string; ageMonths: number; value: number | null; veryNew: boolean; sourceUrl: string | null }[];
    // G (līguma grozījumi / scope creep)
    contracts?: number;
    modifiedContracts?: number;
    substantiveContracts?: number;
    substantiveRate?: number;
    byReasonCode?: Record<string, number>;
    modifications?: { procedureId: string | null; reasonCode: string | null; reasonDescription: string | null; description: string | null; value: number | null; winnerName: string | null; sourceUrl: string | null; name: string | null }[];
  };
};

export type BuyerSummary = {
  buyerId: string;
  buyerName: string | null;
  riskScore: number | null;  // augstākais starp indikatoriem
  combinedScore: number | null; // svērtais kopējais risks
  combinedLevel: 'red' | 'yellow' | 'green' | null;
  layerScores: { A: number | null; B: number | null; C: number | null; D: number | null; E: number | null; G: number | null };
  result: RiskResult;        // B1
  b2: RiskResult;            // B2 — uzvarētāju koncentrācija
  a: RiskResult;             // A — iepirkumu sadalīšana
  c: RiskResult;             // C — cenu/vērtības novirze
  e: RiskResult;             // E — procedūras integritāte
  d: RiskResult;             // D — saistītās puses
  g: RiskResult;             // G — līguma grozījumi (scope creep)
  flaggedLots: RiskResult[];
  topSuppliers?: { winnerId: string; fileId: string | null; name: string | null; value: number; contracts: number; singleBidRate: number; share?: number; years?: number; from?: string | null; to?: string | null; loyalty?: 'high' | 'med' | null }[];
  sharedOwnerGroups?: { person: string; winners: { fileId: string | null; name: string | null; value: number; contracts: number }[] }[];
  singleBidTrend?: { recent: number; prior: number; dir: 'up' | 'down' | 'flat'; recentN: number; priorN: number } | null;
  bunching?: { rate: number; below: number; n: number; natRate: number } | null; // sablīvēšanās zem sliekšņa
};

export type EngineOutput = {
  computedAt: string;
  national: { singleBidLots: number; winnerChosenLots: number; singleBidRate: number };
  lotResults: RiskResult[];
  buyers: BuyerSummary[];
  meta?: { coverage?: string; source?: string; generatedAt?: string; lots?: number; buyers?: number };
};

// ── Indekss + detaļas pēc pieprasījuma ──
export type IndKey = 'B1' | 'B2' | 'A' | 'C' | 'E' | 'D' | 'G';
export type IndexBuyer = {
  buyerId: string;
  buyerName: string | null;
  combinedScore: number | null;
  combinedLevel: 'red' | 'yellow' | 'green' | null;
  layerScores: { A: number | null; B: number | null; C: number | null; D: number | null; E: number | null; G: number | null };
  value?: number;
  singleBidRate?: number | null;
  contracts?: number | null;
  sectorCpv2?: string | null;
  sectorLabel?: string | null;
  region?: string | null;
  levels: Record<IndKey, RiskLevel>;
  scores: Record<IndKey, number | null>;
  bunching?: number; // sablīvēšanās zem sliekšņa — 1, ja ir
};

// ── Piegādātāji (uzvarētāji) ──
export type WinnerIndexEntry = {
  winnerId: string; fileId: string; winnerName: string | null;
  contracts: number; value: number; buyers: number;
  singleBidRate: number; topBuyerShare: number;
  sectorCpv2: string | null; sectorLabel: string | null;
  sharedAddr?: number;
  lowCapEmp?: number;
  loTurn?: number;
  cfla?: number; // ES fondu līgumi (CFLA) — 1, ja ir
  offshore?: 'offshore' | 'grey'; // ofšoru/pelēkās zonas patiesā labuma guvējs
  homeAdv?: number; // "mājas priekšrocība" pie viena pasūtītāja — 1, ja ir
  phoenix?: number; // "fēnikss" — jauna firma pārmanto veca priekšteci — 1, ja ir
};
export type WinnersIndex = { meta?: { coverage?: string }; winners: WinnerIndexEntry[] };

// Slaids indekss globālajai meklēšanai (search-index.json) — tikai lauki, kas vajadzīgi meklēšanai.
export type SearchWinner = { winnerId: string; fileId: string; winnerName: string | null; contracts: number; cfla?: number };
export type SearchPerson = { name: string; companyCount: number };
export type SearchIndex = { meta?: { coverage?: string }; winners: SearchWinner[]; persons: SearchPerson[] };

// ── ES fondi (CFLA) cilne ── meklēšanai pa piegādātājiem ar ES fondu līgumiem.
export type CflaIndexEntry = {
  fileId: string; winnerId: string; name: string | null; sectorLabel: string | null;
  contracts: number; value: number; belowCount: number;
  splitMax: number; splitProject: string | null;
  funds: { fund: string; value: number }[];
  projects: { name: string; count: number; below: number }[];
  // IUB puses riska pazīmes (piegādātāja līmenī) — konteksts, ne pierādījums.
  iubContracts: number; iubSingleBidRate: number; iubFlags: string[]; iubLevel: 'high' | 'med' | null;
  // Cik augsta/vidēja riska pasūtītāju (kombinētais risks) šis piegādātājs apkalpojis (saikne uz A/B1/B2/C/D/G).
  iubRedBuyers: number; iubYellowBuyers: number;
  offshore?: 'offshore' | 'grey'; // ES nauda × nepārbaudāmi (ofšora/pelēkās zonas) īpašnieki
};
export type CflaIndexData = {
  meta?: { coverage?: string };
  totals: { suppliers: number; below: number; withSplit: number; withIubRisk: number };
  suppliers: CflaIndexEntry[];
};

export type WinnerLot = {
  lotId: string; buyerId: string; buyerName: string | null; value: number | null;
  date: string | null; receivedBids: number | null; singleBid: boolean; cpv: string | null; sourceUrl: string | null;
  subjectName?: string | null;
};
// PPI — publisko personu un iestāžu saraksts (pasūtītāja konteksts; aktuālais momentuzņēmums).
export type PpiInfo = {
  type: string | null; typeRaw: string | null; higherName: string | null; higherNr: string | null;
  email: string | null; status: string | null; removedOn: string | null;
};
export type LotMeta = { subjectName: string | null; subjectRef: string | null; contactName: string | null; euFunded?: boolean; bidderCount?: number; bidders?: { name: string | null; fileId: string | null }[] };
// Karteļa pazīmes — pretendentu pāri (EIS reālie pretendenti). Karogs nav pierādījums.
export type CartelProc = { buyer: string | null; subject: string | null; value: number; date: string | null; won: 'a' | 'b' | 'other'; url: string | null };
export type CartelPair = {
  a: { reg: string; name: string | null; fileId: string | null };
  b: { reg: string; name: string | null; fileId: string | null };
  coBids: number; duoShare: number; aWins: number; bWins: number;
  type: 'rotation' | 'cover'; related: boolean; sampleUrl: string | null;
  procs?: CartelProc[];
};
// Piegādātāja kopā-pretendenti (EIS) — citas firmas, kas bieži piedalās tajos pašos konkursos.
export type CoBidder = { reg: string; name: string | null; fileId: string | null; coBids: number; theyWon: number; weWon: number; related?: 'persona' | 'holdings' | null };
// Saistīti pretendenti VIENĀ iepirkumā (kopīga persona/holdings/adrese).
export type RelatedBidderPair = {
  a: { reg: string; name: string | null; fileId: string | null };
  b: { reg: string; name: string | null; fileId: string | null };
  kind: 'persona' | 'holdings' | 'adrese' | string;
};
export type RelatedInProc = {
  eid: string; buyer: string | null; subject: string | null; value: number; date: string | null;
  url: string | null; bidders: number; winnerReg: string | null; pairs: RelatedBidderPair[];
};
export type CartelIndexData = {
  meta?: { coverage?: string };
  totals: { procurementsWithBidders: number; pairs: number; rotation: number; cover: number; related: number; relatedProcurements?: number };
  pairs: CartelPair[];
  relatedInProc?: RelatedInProc[];
};
// Kontaktpersonu indekss — meklēšanai pēc iepirkuma kontaktpersonas + procesa signāli.
export type ContactLot = { winnerName: string | null; winnerFileId: string | null; value: number; subjectName: string | null; singleBid: boolean; date: string | null; sourceUrl: string | null };
export type ContactProc = {
  subjectName: string | null; winnerName: string | null; winnerFileId: string | null;
  value: number; callOffs: number; singleBid: boolean; from: string | null; to: string | null;
  sourceUrl: string | null; lots: ContactLot[];
};
export type ContactEntry = {
  name: string; organization: string | null; procurements: number; callOffs: number; value: number;
  distinctWinners: number; topWinnerShare: number; singleBidRate: number; singleBidValueShare: number;
  winners: { fileId: string | null; name: string | null; value: number; contracts: number }[];
  signals: string[]; level: 'high' | 'med' | null; procs: ContactProc[];
};
export type ContactsData = { meta?: { coverage?: string }; contacts: ContactEntry[] };
export type WinnerByBuyer = {
  buyerId: string; buyerName: string | null; contracts: number; value: number; singleBid: number; lots: WinnerLot[];
};
export type BeneficialOwner = { name: string; id: string; nat: string | null; res?: string | null };
// Ofšoru / noslēpumainības jurisdikciju patiesā labuma guvēji (caurspīdīguma pazīme, ne pierādījums).
export type OffshoreOwner = { name: string; country: string; label: string; tier: 'offshore' | 'grey' };
export type OffshoreInfo = { tier: 'offshore' | 'grey'; owners: OffshoreOwner[] };
export type Officer = { name: string; id: string; role: string };
export type RelatedWinner = { fileId: string | null; name: string | null; value: number; contracts: number; via: string; role?: string };
export type PersonCompany = { fileId: string | null; name: string | null; value: number; contracts: number; role: string; sector?: string | null; buyers?: { name: string | null; value: number }[] };
// Iespējama politiski nozīmīga persona — sakritība pēc vārda ar CVK vēlēšanu datiem. NAV apstiprinājums (bez personas koda).
export type PepFlag = { tier: string; source: string; ambiguous: boolean };
export type PersonEntry = { name: string; id: string; companyCount: number; totalValue: number; totalContracts: number; roles: string[]; sectors?: string[]; riskLevel?: 'high' | 'med' | null; signals?: string[]; signalTypes?: string[]; pep?: PepFlag; companies: PersonCompany[] };
export type PersonsData = { meta?: { coverage?: string }; persons: PersonEntry[] };
export type WinnerDetail = {
  winnerId: string; fileId: string; winnerName: string | null;
  contracts: number; awardedValue: number; buyers: number;
  singleBidLots: number; singleBidRate: number;
  topBuyerId: string | null; topBuyerName: string | null; topBuyerShare: number;
  sectorCpv2: string | null; sectorLabel: string | null;
  byBuyer: WinnerByBuyer[];
  beneficialOwners?: BeneficialOwner[];
  officers?: Officer[];
  relatedWinners?: RelatedWinner[];
  ownership?: {
    owners: { kind: string; name: string; reg: string | null; sharePct: number }[];
    ultimate: { reg: string; name: string }[];
    siblings: { fileId: string | null; name: string | null; via: string }[];
  } | null;
  sameAddress?: { address: string | null; addrTotal: number; winners: { fileId: string | null; name: string | null }[] } | null;
  financials?: { year: number; employees: number | null; turnover: number | null; profit: number | null } | null;
  lowCapacity?: boolean;
  cfla?: CflaSummary | null;
  coBidders?: CoBidder[];
  offshore?: OffshoreInfo | null;
  homeAdvantage?: HomeAdvantage | null;
  phoenix?: Phoenix | null;
  meta?: { coverage?: string };
};
// "Mājas priekšrocība" — uzvaras likme pie viena pasūtītāja krasi augstāka nekā citur (EIS dalība).
export type HomeAdvantage = { buyerId: string; buyerName: string | null; partsThere: number; winRateThere: number; partsElse: number; winRateElse: number };
// "Fēnikss" — jauna firma dala personu/adresi ar vecāku uzvarētāju un turpina uzvarēt pie tā paša pasūtītāja.
export type Phoenix = { predecessorReg: string; predecessorName: string | null; predecessorFileId: string | null; via: string; buyerId: string; buyerName: string | null; registered: string | null };
// CFLA — ES fondu projektu dati (līgumi + fonds + partneri + plāns; satur arī zemsliekšņa līgumus).
export type CflaContractRow = { project: string | null; projectName: string | null; fund: string | null; procNr: string | null; veids: string | null; date: string | null; value: number; below: boolean };
export type CflaRelated = { fileId: string | null; name: string | null; reg: string; project: string; projectName: string | null; relation: 'izpildītājs' | 'partneris' };
export type CflaSummary = {
  contracts: number; value: number; belowCount: number; belowValue: number;
  funds: { fund: string; value: number }[];
  projects: { project: string; name: string | null; count: number; value: number; below: number; belowValue: number; planned: number | null }[];
  splitSignal: string | null;
  related: CflaRelated[];
  list: CflaContractRow[];
};
export type IndexData = {
  meta?: { coverage?: string; source?: string; generatedAt?: string; lots?: number; buyers?: number };
  national: { singleBidLots: number; winnerChosenLots: number; singleBidRate: number };
  buyers: IndexBuyer[];
};

export type SectorEntity = {
  id: string; name: string | null; contracts: number; value: number; singleBidRate: number;
};
export type SectorStat = {
  cpv2: string; label: string; contracts: number; singleBid: number;
  singleBidRate: number; awardedValue: number; buyers: number;
  suppliers?: number;
  topBuyers?: SectorEntity[]; topSuppliers?: SectorEntity[];
};
export type SectorsData = {
  meta?: { coverage?: string };
  national: { singleBidRate: number };
  sectors: SectorStat[];
};

export type OverviewData = {
  meta?: { coverage?: string };
  national: { singleBidRate: number };
  totals: { procurements: number; awardedValue: number; buyers: number; suppliers: number };
  riskDistribution: { red: number; yellow: number; green: number; none: number };
  topSectors: { cpv2: string; label: string; singleBidRate: number; contracts: number }[];
  topRiskBuyers: { buyerId: string; buyerName: string | null; combinedScore: number | null; combinedLevel: string | null }[];
  regions?: { key: string; contracts: number; singleBidRate: number; value: number; buyers: number; red: number }[];
  topFlows?: { buyer: string; supplier: string; value: number }[];
  recentFlags?: { date: string; buyerId: string; buyerName: string | null; winnerName: string | null; winnerFileId: string | null; value: number; sector: string | null; reasons: string[]; sourceUrl: string | null; subjectName?: string | null; contactName?: string | null; euFunded?: boolean }[];
  loyaltyPairs?: { buyerId: string; buyerName: string | null; fileId: string | null; supplier: string | null; value: number; contracts: number; years: number; from: string | null; to: string | null; share: number; singleBidRate: number }[];
  timeline: { month: string; contracts: number; singleBidRate: number; value: number }[];
};

// Pilnās pasūtītāja detaļas (buyers/<id>.json) — kā BuyerSummary.
export type BuyerDetail = BuyerSummary & { meta?: { coverage?: string }; ppi?: PpiInfo | null; lotMeta?: Record<string, LotMeta> };

export type MarketStat = {
  cpv: string; label: string; contracts: number; distinctWinners: number;
  hhi: number; top1Share: number; top3Share: number; singleBidRate: number; awardedValue: number;
  topWinners: { id: string; name: string | null; contracts: number; value: number; share: number }[];
  score: number; level: 'red' | 'yellow' | null;
};
export type MarketsData = { meta?: { coverage?: string }; national: { singleBidRate: number }; markets: MarketStat[] };

export type ActiveTender = {
  id: string; buyerId: string; buyerName: string | null;
  cpv: string | null; name: string | null; procedureType: string | null;
  deadline: string | null; deadlineTime: string | null;
  estimatedValue: number | null; sourceUrl: string | null;
};
export type ActiveData = { meta?: { asOf?: string; count?: number }; tenders: ActiveTender[] };
