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
  sectorCpv2?: string | null;
  sectorLabel?: string | null;
  region?: string | null;
  levels: Record<IndKey, RiskLevel>;
  scores: Record<IndKey, number | null>;
};

// ── Piegādātāji (uzvarētāji) ──
export type WinnerIndexEntry = {
  winnerId: string; fileId: string; winnerName: string | null;
  contracts: number; value: number; buyers: number;
  singleBidRate: number; topBuyerShare: number;
  sectorCpv2: string | null; sectorLabel: string | null;
};
export type WinnersIndex = { meta?: { coverage?: string }; winners: WinnerIndexEntry[] };

export type WinnerLot = {
  lotId: string; buyerId: string; buyerName: string | null; value: number | null;
  date: string | null; receivedBids: number | null; singleBid: boolean; cpv: string | null; sourceUrl: string | null;
};
export type WinnerByBuyer = {
  buyerId: string; buyerName: string | null; contracts: number; value: number; singleBid: number; lots: WinnerLot[];
};
export type WinnerDetail = {
  winnerId: string; fileId: string; winnerName: string | null;
  contracts: number; awardedValue: number; buyers: number;
  singleBidLots: number; singleBidRate: number;
  topBuyerId: string | null; topBuyerName: string | null; topBuyerShare: number;
  sectorCpv2: string | null; sectorLabel: string | null;
  byBuyer: WinnerByBuyer[];
  meta?: { coverage?: string };
};
export type IndexData = {
  meta?: { coverage?: string; source?: string; generatedAt?: string; lots?: number; buyers?: number };
  national: { singleBidLots: number; winnerChosenLots: number; singleBidRate: number };
  buyers: IndexBuyer[];
};

export type SectorStat = {
  cpv2: string; label: string; contracts: number; singleBid: number;
  singleBidRate: number; awardedValue: number; buyers: number;
};
export type SectorsData = {
  meta?: { coverage?: string };
  national: { singleBidRate: number };
  sectors: SectorStat[];
};

// Pilnās pasūtītāja detaļas (buyers/<id>.json) — kā BuyerSummary.
export type BuyerDetail = BuyerSummary & { meta?: { coverage?: string } };

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
