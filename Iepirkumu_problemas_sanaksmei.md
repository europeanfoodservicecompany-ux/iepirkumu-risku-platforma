# Publisko iepirkumu datu kvalitāte un konkurences trūkums

**Kopsavilkums sarunai Finanšu ministrijā**
Pamatā: visa IUB atvērto datu vēsture (2023-10-25 … 2026-06-17), ~67 400 iepirkumu, 916 pasūtītāji.
Avots un pārbaude: https://main.iepirkumu-risku-platforma.pages.dev

---

## Galvenās atziņas (3 punkti)

1. **IT iepirkumi gandrīz nav konkurences.** IT pakalpojumos vienīgais pretendents uzvar 57% gadījumu (programmatūrā 52%), pret 25% valstī. Turklāt IT līgumi ~6× biežāk nekā vidēji iet pavisam bez konkursa (sarunu procedūra bez paziņojuma).
2. **IUB atvērtie dati ir sistēmiski nepilnīgi.** Dublikāti (~11%), komata kļūdas (>€1 mljrd. fantoma vērtības), trūkstošas vērtības (~3,7%) un saites (~26%).
3. **Sekas:** sabiedrība un uzraugi nevar efektīvi sekot līdzi publisko līdzekļu tērēšanai, jo dati nav ne tīri, ne pilnīgi.

---

## 1. IT un programmēšanas iepirkumi — konkurences trūkums

| Rādītājs | IT pakalpojumi (CPV 72) | Programmatūra (CPV 48) | Valstī vidēji |
|---|---|---|---|
| Viena pretendenta īpatsvars | **57%** | **52%** | 25% |
| "Sarunu procedūra bez konkursa" | **13%** | — | 2,3% |

Detalizētā IT pakalpojumu izlasē (1 071 līgums): **63% uzvar vienīgais pretendents**, un **138 līgumi (€52,3M) noslēgti pavisam bez konkursa** ("neg-wo-call" — sarunu procedūra bez iepriekšēja paziņojuma).

**"Mistiskā procedūra"** ir tieši šī — *sarunu procedūra bez iepriekšēja paziņojuma*. Tā likumīgi atļauta tikai izņēmuma gadījumos (piem., kad ir viens vienīgais iespējamais piegādātājs), bet IT to izmanto nesamērīgi bieži. Tipiskais modelis — **programmatūras uzturēšana un licences pie sākotnējā piegādātāja (vendor lock-in):**

- Ģeogrāfiskās informācijas sistēmas uzturēšana — €400 000 (bez konkursa)
- ESRI / ArcGIS programmatūras uzturēšana — €256 000 → SIA "Envirotech"
- IS "Ārsta Birojs" licences — €880 286 → SIA "Meditec AB"
- Ugunsgrēku atklāšanas sistēma — €876 350 → SIA "DATI Group"
- DocLogix sistēmas uzturēšana — €47 700 → UAB DocLogix

**Programmēšanas stundas bez konkursa.** Papildus uzturēšanai, izstrādes darbu/stundu iepirkšana bieži notiek caur **ietvara līgumiem**: pasūtītājs vienreiz noslēdz ietvaru, pēc tam pasūta atsevišķas stundas/darba uzdevumus bez jauna konkursa. Šie pasūtījumi IUB atvērtajos datos bieži **vispār neparādās** kā atsevišķi iepirkumi — tātad reālais konkurences trūkums ir vēl lielāks, nekā redzams datos.

> **Jautājums ministrijai:** vai būtu jāierobežo sarunu procedūras bez konkursa izmantošana IT uzturēšanā un jāprasa ietvara līgumu izsaukumu (programmēšanas stundu) publiskošana?

---

## 2. IUB datu kvalitātes problēmas

Veidojot platformu, atklājās virkne sistēmisku problēmu pašos IUB atvērtajos datos. Tās nav analīzes kļūdas — tās ir **avota datu trūkumi**, kas apgrūtina jebkādu uzraudzību.

### 2.1. Dublikāti (~11%)
No 75 492 parsētajiem ierakstiem **8 081 (11%) bija dublikāti** — viens un tas pats iepirkums vairākos paziņojumos vai ar dažādiem iekšējiem ID.
*Piemērs:* EIS iepirkums 113795 — viens €87 980 līgums ierakstīts divreiz ar atšķirīgiem iekšējiem ID.

### 2.2. Komata / mērvienības kļūdas (>€1 miljards)
Vairāk nekā 50 līgumos summa ierakstīta **×100 par lielu** (nobīdīts komats), kopā vairāk nekā **€1 miljards fantoma vērtības**.
*Piemēri:*
- Valsts autoceļš P124 (Ventspils–Kolka): īstā vērtība €4 409 391, ierakstīta kā **€440 939 136**
- Allažu bērnu un ģimenes atbalsta centrs: €2 096 383 ierakstīta kā **€209 638 300**
- Arbor Medical (radiogrāfijas iekārta): €178 573,54 ierakstīta arī kā **€17 857 354** vienā līgumā

### 2.3. Iekšēji pretrunīgi dati
*Piemērs:* vienai procedūrai (d4634f79) IUB pašas `noticeContractValue` divos paziņojumos atšķiras — **€4,4 miljardi pret €438 miljoniem**.

### 2.4. Trūkstošas vērtības (~3,7%)
**1 930 piešķirtiem līgumiem IUB vispār nepublicē vērtību** — ne kopsummu, ne sadalījumu, ne aplēsi. Pārbaudīts: šādiem ierakstiem nav arī `tenderPaymentValue`, `frameworkMaximumValue` vai `estimatedValue`.
*Piemērs:* "Baltijas (Latvijas & Lietuvas) paviljona ekspozīcija" (daudzpiegādātāju ietvars) — uzvarētāji ir vairākas firmas kopā, bet vērtības nav.

### 2.5. Trūkstošas saites (~26%)
**17 535 ierakstiem nav tiešās EIS saites** uz konkrēto iepirkumu — tikai pasūtītāja profila saite (ved uz sākumskatu) vai nekā.

### 2.6. Nestrukturēti pretendentu dati
Atvērtajos datos ir tikai **uzvarētājs un piedāvājumu skaits**. Zaudējušo pretendentu saraksts ar cenām pastāv tikai katra iepirkuma **atvēršanas protokolā** (EIS pasūtītāja profilā), ne strukturētā veidā — tāpēc saskaņotas darbības (karteļus, cenu rotāciju) masveidā pierādīt nevar.

---

## 3. Ieteikumi

1. **Datu kvalitāte:** ieviest validāciju IUB datu publicēšanā — unikāli iepirkumu ID, vērtību pārbaude (mērvienības, ārējās robežas), obligātas tiešās saites.
2. **Pretendentu dati:** publicēt atvēršanas protokolu datus (visi pretendenti + cenas) **strukturēti**, lai būtu iespējama konkurences un karteļu analīze.
3. **IT iepirkumi:** izvērtēt sarunu procedūru bez konkursa izmantošanu programmatūras uzturēšanā un prasīt ietvara līgumu izsaukumu (stundu) publiskošanu.
4. **Caurspīdība:** atvērtie dati ir labs sākums, bet pašreizējā kvalitāte ierobežo to lietderību sabiedriskai uzraudzībai.

---

*Sagatavots, balstoties uz publiskajiem IUB atvērtajiem datiem un Uzņēmumu reģistra datiem. Visi skaitļi un piemēri pārbaudāmi platformā. Karogs nav pierādījums — tās ir norādes izpētei.*
*Izstrādāja Jānis Rupeiks, Liepājā, 2026.*
