// Kopējie tipi indikatoru dzinējam.
// Lot = viena normalizēta iepirkuma daļa (LotResult līmenis IUB e-veidlapās).

export type Lot = {
  id: string;                  // lot.id
  noticeId: string;            // notice.identifier (BT-04)
  procedureId?: string | null; // notice.procurementProcedureIdentifier
  buyerId: string;             // pasūtītāja reģ. nr. (organizationData.identifier, BT-501)
  buyerName?: string | null;   // organizationData.name (BT-500)
  cpv?: string | null;         // notice.cpvType (BT-262)
  receivedBids: number | null; // BT-760: receivedSubmissionsStatistics.receivedNumberOfOffers
  winnerChosen: boolean;       // BT-142: lot.result.winnerSelectionStatus === 'selec-w'
  awardValue?: number | null;  // BT-720 (ja pieejams)
  winnerId?: string | null;    // uzvarētāja reģ. nr. (contracts.winners.winnerBusinessParties.companyId)
  winnerName?: string | null;  // uzvarētāja nosaukums
  procedureType?: string | null; // BT-105: tenderingProcess.procedureType
  noticeDate?: string | null;  // ISO datums (no lot.result.decisionDate)
  sourceUrl?: string | null;   // saite uz IUB oriģinālu
  nutsCode?: string | null;    // pasūtītāja reģions (organizationData.nutsCode, NUTS3)
  dupValue?: boolean;          // vērtība atkārtojas tajā pašā procedūrā (ietvara/bloka dublikāts) — neieskaita summās
};

export type RiskStatus = 'RiskFound' | 'RiskNotFound' | 'NoData' | 'NotApplicable';
export type RiskLevel = 'yellow' | 'red';

// Standartizēts indikatora rezultāts (DOZORRO paraugs: viens skaidrs rezultāts).
export type RiskResult = {
  indicator: string;            // piem. 'B1'
  scope: 'lot' | 'buyer';
  lotId?: string | null;
  buyerId: string;
  status: RiskStatus;
  level: RiskLevel | null;
  score: number | null;         // 0..100 vai null ('nepietiek datu')
  detail?: Record<string, unknown>;
};

export type B1Config = {
  minSample: number;        // minimālais daļu skaits pasūtītāja agregātam
  buyerYellowRatio: number; // relatīvā attiecība, no kuras dzeltens
  buyerRedRatio: number;    // relatīvā attiecība, no kuras sarkans
  scoreSlope: number;       // B1_score = clamp((ratio-1)*slope,0,100)
};

// Piezīme par slīpumu: specifikācijas 5.2 formula minēja slope=50 (ratio 2.0→50),
// taču tā paša punkta krāsu tabula definē sarkanu pie 1.7× un dzeltenu pie 1.3×.
// Šīs divas definīcijas savā starpā nesakrīt. Ar slope=100 tās tiek saskaņotas:
//   ratio 1.3 → score 30 (dzeltena josla), ratio 1.7 → score 70 (sarkana josla).
// Tā krāsa pēc score joslām un krāsa pēc relatīvās attiecības ir identiskas.
export const DEFAULT_B1_CONFIG: B1Config = {
  minSample: 10,
  buyerYellowRatio: 1.3,
  buyerRedRatio: 1.7,
  scoreSlope: 100,
};

// Konteksts, ko dzinējs nodod indikatoriem (piem. nacionālā bāze agregātiem).
export type B2Config = {
  minSample: number;     // minimālais iepirkumu skaits ar uzvarētāju
  yellowHhi: number;     // HHI, no kura dzeltens
  redHhi: number;        // HHI, no kura sarkans
  yellowTopShare: number;// top uzvarētāja daļa, no kuras vismaz dzeltens
  redTopShare: number;   // top uzvarētāja daļa, no kuras sarkans
};

// HHI joslas: <0.15 nekoncentrēts, 0.15–0.25 mērens, >0.25 augsts (DOJ vadlīniju analogs).
// score saskaņots ar krāsu joslām: yellowHhi→30, redHhi→70 (tāpat kā B1).
export const DEFAULT_B2_CONFIG: B2Config = {
  minSample: 10,
  yellowHhi: 0.25,
  redHhi: 0.45,
  yellowTopShare: 0.5,
  redTopShare: 0.7,
};

export type AConfig = {
  windowDays: number;        // slīdošais laika logs T (dienas)
  thresholdWorks: number;    // procedūras slieksnis būvdarbiem (CPV 45*), EUR
  thresholdGoods: number;    // procedūras slieksnis precēm/pakalpojumiem, EUR
  nearThresholdRatio: number;// "tuvu slieksnim" josla (0.5 = līgumi ≥50% no S; tikai tie skaitās par sadalīšanu)
  redSumRatio: number;       // kopsumma > redSumRatio × S → sarkans
  redCount: number;          // līgumu skaits kopā ≥ redCount → sarkans
};

// Aktuālie LV sliekšņi (virs kuriem jārīko atklāta procedūra): preces/pakalpojumi 42 000 EUR,
// būvdarbi 170 000 EUR. Reforma tos krasi paaugstinās — tāpēc tie ir KONFIGURĒJAMI parametri.
export const DEFAULT_A_CONFIG: AConfig = {
  windowDays: 90,
  thresholdWorks: 170000,
  thresholdGoods: 42000,
  nearThresholdRatio: 0.5,
  redSumRatio: 1.5,
  redCount: 4,
};

export type CConfig = {
  cpvDigits: number; // CPV grupēšanas precizitāte (zīmju skaits)
  minObs: number;    // minimālais salīdzināmo līgumu skaits CPV grupā
  yellowZ: number;   // z (uz ln(vērtības)), no kura dzeltens
  redZ: number;      // z, no kura sarkans
};

// Cenu/vērtības novirze: salīdzina līgumvērtību ar nacionālo sadalījumu tajā pašā CPV.
// z rēķina uz ln(vērtības), jo līgumvērtības ir stipri labēji asimetriskas (log-normālas).
// Piezīme: bez daudzumiem tas mēra VĒRTĪBAS, ne vienības cenas novirzi (skat. atrunu).
export const DEFAULT_C_CONFIG: CConfig = {
  cpvDigits: 4,
  minObs: 5,
  yellowZ: 1,
  redZ: 2.5,
};

export type CpvStat = { mean: number; std: number; count: number };

export type EConfig = {
  nonCompetitiveTypes: string[]; // procedūru tipi bez iepriekšējas konkurences (piem. neg-wo-call)
  minSample: number;             // min iepirkumu skaits pasūtītāja agregātam
  yellowShare: number;           // ne-konkurences īpatsvars, no kura dzeltens
  redShare: number;              // ne-konkurences īpatsvars, no kura sarkans
};

// Sarunu procedūra bez iepriekšējas izsludināšanas (neg-wo-call) valstī ir reta (~2%),
// tāpēc augsts īpatsvars pie viena pasūtītāja ir integritātes signāls. Sliekšņi konfigurējami.
export const DEFAULT_E_CONFIG: EConfig = {
  nonCompetitiveTypes: ['neg-wo-call'],
  minSample: 15,
  yellowShare: 0.15,
  redShare: 0.35,
};

export type DConfig = {
  newCompanyMonths: number;  // uzvarētājs reģistrēts mazāk nekā X mēnešus pirms līguma → signāls
  veryNewMonths: number;     // ļoti jauns (stiprāks signāls)
  minAwards: number;         // min līgumu skaits ar zināmu uzvarētāja reģ. datumu
};

export const DEFAULT_D_CONFIG: DConfig = {
  newCompanyMonths: 6,
  veryNewMonths: 3,
  minAwards: 5,
};

export type CompanyInfo = { registered: string | null; type: string | null };

// Līguma grozījums pēc uzvaras (IUB cont-modif paziņojums).
export type Modification = {
  procedureId: string | null;  // sasaiste ar oriģinālo līgumu (procurementProcedureIdentifier)
  buyerId: string;             // pasūtītāja reģ. nr.
  buyerName: string | null;
  cpv: string | null;
  reasonCode: string | null;   // add-wss, mod-cir, mod-nons, mod-rev, mod-minv, mod-repl
  reasonDescription: string | null; // īsais iemesls
  description: string | null;  // garais pamatojums (saīsināts)
  value: number | null;        // grozījumā norādītā līgumvērtība (NB: ne tīrs pieaugums)
  winnerName: string | null;
  sourceUrl: string | null;
  date: string | null;
  name: string | null;         // līguma/iepirkuma nosaukums
};

export type GConfig = {
  substantiveCodes: string[];   // būtiskie grozījumu kodi (papildu darbi, izpildītāja maiņa)
  minContracts: number;         // min atšķirīgu līgumu skaits (saucējs)
  yellowRate: number;           // būtiski-grozīto līgumu īpatsvars → dzeltens
  redRate: number;              // → sarkans
  minSubstantiveYellow: number; // skaita aizsargs pret vienreizēju troksni
  minSubstantiveRed: number;
};

// Līguma grozījumi: papildu darbi (add-wss) un izpildītāja maiņa (mod-repl) ir būtiskākie
// "scope creep" signāli (uzvar ar zemu cenu → vēlāk uzpūš ar papildu darbiem). Sliekšņi balstīti
// reālā gada sadalījumā: papildu-darbu līmenis p95≈3,5%, p99≈9%. Skaita aizsargs filtrē 1/N troksni.
export const DEFAULT_G_CONFIG: GConfig = {
  substantiveCodes: ['add-wss', 'mod-repl'],
  minContracts: 10,
  yellowRate: 0.035,
  redRate: 0.09,
  minSubstantiveYellow: 2,
  minSubstantiveRed: 3,
};

// Slāņu svari kopējam riskam. B slānis = max(B1, B2). Sākotnēji metodoloģijas ieteiktie svari;
// akadēmiskā prakse (Fazekas) iesaka sākt ar vienādiem svariem — tāpēc tie ir KONFIGURĒJAMI.
export type Weights = { A: number; B: number; C: number; D: number; E: number; G: number };
export const DEFAULT_WEIGHTS: Weights = { A: 0.22, B: 0.26, C: 0.17, D: 0.12, E: 0.08, G: 0.15 };

export type EngineContext = {
  nationalAvg: number; // nacionālais viena-pretendenta īpatsvars (0..1)
  b1: B1Config;
  b2: B2Config;
  a: AConfig;
  c: CConfig;
  cpvStats: Map<string, CpvStat>; // CPV → ln(vērtības) vidējais/std/skaits
  e: EConfig;
  d: DConfig;
  g: GConfig;
  companyReg: Map<string, CompanyInfo>; // uzvarētāja reģ.nr. → UR reģistrācijas info
  modifications: Map<string, Modification[]>; // pasūtītāja reģ.nr. → līguma grozījumi
};
