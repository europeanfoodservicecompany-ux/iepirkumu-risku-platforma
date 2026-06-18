# Publisko iepirkumu risku analīzes platforma

Publisks, automātiski atjaunināms rīks, kas analizē Latvijas publisko un pašvaldību iepirkumu
datus un identificē augsta riska “sarkano karogu” gadījumus. Mērķis ir **prioritizēt izpēti, ne
pierādīt pārkāpumu**.

Šis ir MVP karkass ar **visiem sešiem metodoloģijas indikatoriem: B1 (viena pretendenta īpatsvars), B2 (uzvarētāju koncentrācija), A (iepirkumu sadalīšana), C (cenu/vērtības novirze), E (procedūras integritāte) un D (saistītās puses)**.
Tas darbojas uz **reāliem IUB atvērtajiem datiem** (open.iub.gov.lv).

## Kas jau strādā

- **Indikatoru dzinējs** (DOZORRO modulārais klašu modelis) ar indikatoriem **B1**, **B2** (HHI + top uzvarētāja daļa) un **A** (sadalīšana ar slīdošo logu un konfigurējamiem sliekšņiem).
- **Reāla IUB datu ievākšana** no `open.iub.gov.lv` (eForms JSON) un parsētājs uz normalizētiem `lots`.
- **Pilna plūsma**: ievākšana → parsēšana → aprēķins → izvade, palaižama ar vienu komandu.
- **Publisks frontend** (React + Vite, latviski): pasūtītāju rangs un riska profili.
- **Testi** dzinējam (35) un parsētājam (4), t.sk. nacionālās bāzes paškontrole.

**Validācija uz reāliem datiem:** uz ~3 mēnešu reāliem datiem (2025-01 … 2025-04) aprēķinātā
nacionālā viena-pretendenta bāze ir **26,1%** — gandrīz precīzi zināmie ~26% no literatūras.

## Struktūra

```
packages/
  engine/   Indikatoru dzinējs (TS). Bāzes klase + IndicatorB1 + agregāti. Testi.
  ingest/   IUB datu ievākšana (fetch.ts), eForms→lots parsēšana (parse.ts), pipeline (run.ts).
  web/      React + Vite frontend (latviski): rangs + pasūtītāja profils.
supabase/   schema.sql — datu modelis (lots, risk_results, raw_notices, config).
data/       Ģenerētā izvade (engine_output.json, lots.json) — lasa frontend.
```

## Palaišana

Prasība: Node ≥ 22.6 (dzinējs un ievākšana izpildās bez kompilācijas, izmantojot Node native TS).

```bash
# 1) Dzinēja + parsētāja testi
node --test packages/engine/test/*.test.ts
node --test packages/ingest/test/*.test.ts

# 2) Plūsma uz pievienotajiem 3 mēnešu reālajiem datiem (offline)
node packages/ingest/src/run.ts

# 3) Plūsma uz SVAIGIEM reāliem IUB datiem par diapazonu (tīkls)
node packages/ingest/src/run.ts 2025-01-01 2025-04-04

# 4) Frontend (kopē datus no data/ un palaiž Vite)
cd packages/web && npm install && npm run dev      # http://localhost:5173
npm run build                                      # produkcijas build → dist/
```

## Datu avots

- **IUB atvērto datu serviss:** `https://open.iub.gov.lv/data/notice/YYYY/MM/DD-MM-YYYY.json`
  (eForms JSON, no 2023-10-25, bez autorizācijas, atjaunots reizi dienā 04:00 EET).
- **Lauku apraksts:** `https://open.iub.gov.lv/data/publiskie_iepirkumi_metadata.json`.
- Paziņojuma publiskā lapa: `https://info.iub.gov.lv/lv/eforms/<identifier>`.

### Svarīga reālā formāta atziņa
Specifikācijā minētais “BT-759 Received Submissions Count” reālajos IUB datos atrodas šeit:
`lots[].tenderingProcess.receivedSubmissionsStatistics.receivedNumberOfOffers` (BT-760 grupa).
Uzvarētāja statuss: `lots[].result.winnerSelectionStatus` (`selec-w` = izvēlēts, `clos-nw` = bez uzvarētāja).
Pasūtītājs: `organizationData` (loma `buyer`/`cpb-*`), reģ. nr. laukā `identifier` (BT-501).

## Kā pievienot nākamo indikatoru (B2, A, C, D, E)

1. Izveido jaunu klasi `packages/engine/src/indicators/<ID>.ts`, kas manto `BaseTenderRiskRule`.
2. Implementē `processLot()` un/vai `processBuyer()`, atgriežot standartizētu `RiskResult`.
3. Pievieno to `packages/engine/src/indicators/registry.ts`.
4. Dzinējs to automātiski pielieto visiem iepirkumiem. Pievieno testus.

## Konfigurācija un sliekšņi

Sliekšņi un svari glabājas konfigurācijā (`supabase/config` tabula; dzinējā `DEFAULT_B1_CONFIG`),
nevis kodā cieti iešūti — atbilstoši DOZORRO principam (periodiska pārkalibrēšana, robežas nepublisko
tā, lai tās kļūtu par apiešanas instrukciju). Sliekšņi ir sākotnēji ieteikumi, kalibrējami uz reāliem datiem.

## Izvietošana

- **Frontend → Vercel:** `vercel.json` saknē (build `npm run web:build`, izvade `packages/web/dist`).
- **Dati/glabāšana → Supabase:** `supabase/schema.sql` (PostgreSQL). `.env.example` satur savienojuma mainīgos.

## Juridiskie principi

Karogs nav apsūdzība. Visi dati ir publiski atvērtie dati; sistēma tos tikai apkopo un analizē.
Katra karoga aprēķins ir izsekojams, un pie katra ir saite uz IUB oriģinālu pārbaudei.

## Statuss

Pabeigts: B1 (viena pretendenta īpatsvars), B2 (uzvarētāju koncentrācija) un A (iepirkumu sadalīšana) — pilns dzinējs, reāla ievākšana ar uzvarētāju un summu datiem, frontend ar visiem sešiem indikatoriem + skaidrojumu paneli, 39 testi. Visi metodoloģijas slāņi pabeigti.
Nākamie soļi (nevis jauni indikatori): automātiska ikdienas datu atjaunošana, svaru kalibrēšana uz reāliem datiem, kopējā svērtā riska rādītāja ieviešana.

Izvietots: Cloudflare Pages. A sliekšņi (konfigurējami): preces/pakalpojumi 42 000 EUR, būvdarbi 170 000 EUR (aktuālie LV sliekšņi; reforma tos paaugstinās). Pilnu jaudu A sasniedz, kad pieejami zemsliekšņa līgumi (reforma tos sāk publicēt).

E: sarunu procedūra bez konkurences (neg-wo-call) — īpatsvars pa pasūtītāju (valstī ~2%).
D: nesen reģistrēts uzvarētājs (UR reģistrācijas datums vs līguma datums; noklusējums <6 mēn.).

C piezīme: IUB dati satur līgumu kopsummas, ne vienības cenas, tāpēc C mēra VĒRTĪBAS (ne tīru cenu) novirzi (log z-score pa CPV) — augsta vērtība var nozīmēt arī lielāku iepirkumu. Tikai norāde izpētei.
