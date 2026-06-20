export function MethodologyView() {
  return (
    <div className="card method">
      <h2 style={{ marginTop: 0 }}>Metodoloģija</h2>
      <p>
        Platforma analizē Latvijas publisko un pašvaldību iepirkumu atvērtos datus un identificē
        statistiskas pazīmes, kas literatūrā un praksē korelē ar paaugstinātu korupcijas vai negodprātīgas
        rīcības risku. Mērķis ir <strong>prioritizēt izpēti, ne pierādīt pārkāpumu</strong>.
      </p>

      <h3 className="section-title">Datu avoti</h3>
      <ul className="m-list">
        <li><strong>Iepirkumu uzraudzības birojs (IUB)</strong> — e-veidlapu atvērtie dati (open.iub.gov.lv): paziņojumi, līgumi, summas, uzvarētāji, CPV, saņemto piedāvājumu skaits.</li>
        <li><strong>Uzņēmumu reģistrs (UR)</strong> — uzņēmumu reģistrācijas datumi (D indikatoram).</li>
        <li>Aptvertais periods redzams sākumlapā; pabeigtie (ar rezultātu) iepirkumi tiek vērtēti, notiekošie konkursi rādīti atsevišķi.</li>
      </ul>

      <h3 className="section-title">Par līgumvērtībām</h3>
      <p>
        Vērtības ņemtas no līguma datiem. Lielos ietvara/bloka iepirkumos IUB datos viena un tā pati summa
        bieži atkārtojas daudzos “lots”, mākslīgi uzpūšot kopvērtību — tāpēc <strong>atkārtotas vērtības vienā
        procedūrā kopsummās neieskaitām</strong> (skaitļi un riska indikatori netiek skarti). Ietvara līgumiem ar
        vairākiem līdzuzvarētājiem IUB nesniedz vērtības sadalījumu pa piegādātājiem, tāpēc <strong>šāda kopējā
        summa piegādātāja vērtībā netiek ieskaitīta</strong> (labāk iztrūkst, nekā nepareizi attiecināts). Tādēļ
        atsevišķu piegādātāju vērtības var būt nedaudz nenovērtētas.
      </p>

      <h3 className="section-title">Indikatori</h3>
      <div className="m-ind"><span className="tag">B1</span><strong>Viena pretendenta īpatsvars.</strong> Cik % pasūtītāja iepirkumu (atklātā/slēgtā procedūrā ar izvēlētu uzvarētāju) saņēma tikai vienu piedāvājumu. Attiecināts pret nacionālo vidējo (~24–26%). Dzeltens no 1,3×, sarkans no 1,7× virs vidējā.</div>
      <div className="m-ind"><span className="tag">B2</span><strong>Uzvarētāju koncentrācija.</strong> Cik koncentrēti līgumi (pēc vērtības) nonāk pie nedaudziem uzvarētājiem — Herfindāla–Hiršmana indekss (HHI) + lielākā uzvarētāja daļa.</div>
      <div className="m-ind"><span className="tag">A</span><strong>Iepirkumu sadalīšana.</strong> Vairāki tuvu-slieksnim līgumi vienā CPV grupā īsā laika logā (90 dienas), kas katrs paliek zem procedūras sliekšņa (preces/pakalpojumi 42 000 €, būvdarbi 170 000 €), bet kopā to pārsniedz. Sarkans, ja ≥4 līgumi, viens uzvarētājs vai kopsumma &gt;1,5× slieksnis.</div>
      <div className="m-ind"><span className="tag">C</span><strong>Cenu/vērtības novirze.</strong> Līgumvērtības logaritmiskais z-score pret nacionālo sadalījumu tajā pašā CPV (≥5 salīdzināmi līgumi). <em>Mēra vērtības, ne vienības cenas novirzi</em> — augsta vērtība var nozīmēt arī lielāku iepirkumu.</div>
      <div className="m-ind"><span className="tag">E</span><strong>Procedūras integritāte.</strong> Sarunu procedūras bez iepriekšējas konkurences izsludināšanas (neg-wo-call) īpatsvars — valstī tas ir reti (~2%), tāpēc augsts īpatsvars izceļas.</div>
      <div className="m-ind"><span className="tag">D</span><strong>Saistītās puses.</strong> Uzvarētāji, kas reģistrēti īsi (&lt;6 mēneši) pirms līguma iegūšanas — klasisks saistīto pušu / fiktīva pretendenta signāls (UR reģistrācijas dati).</div>
      <div className="m-ind"><span className="tag">G</span><strong>Līguma grozījumi (pēc uzvaras).</strong> Cik liela pasūtītāja līgumu daļa pēc uzvaras tiek grozīta ar <em>papildu darbiem/piegādēm</em> (add-wss) vai <em>izpildītāja maiņu</em> (mod-repl) — klasiska „uzvar lēti, pēc tam uzpūš ar papildu vienošanos" shēma (IUB cont-modif paziņojumi, PIL 61. p.). Daudzi grozījumi ir likumīgi (termiņa pagarinājums, indeksācija) — tāpēc skaita tikai būtiskos un tikai īpatsvaru. Grozījuma summa nav tīrs pieaugums, tāpēc to nerāda kā %.</div>

      <h3 className="section-title">Kopējais svērtais risks</h3>
      <p>
        Kopējais rādītājs ir slāņu svērta kombinācija: B 26% (max no B1/B2), A 22%, C 17%, G 15%, D 12%, E 8%.
        Trūkstošs slānis dod 0 ieguldījumu — tā <strong>augstu risku rada vairāku signālu sakritība</strong>,
        ne viens izolēts rādītājs. Krāsas: zaļš 0–29, dzeltens 30–59, sarkans 60–100.
      </p>

      <h3 className="section-title">Slēgtie tirgi (vāja konkurence tirgū)</h3>
      <p>
        Tirgus (CPV) līmenī: augsta uzvarētāju koncentrācija (HHI) + augsta viena-pretendenta likme.
        Tā ir tikai <strong>netieša</strong> pazīme par vāju konkurenci vai iespējami saskaņotām darbībām — IUB nepublicē
        zaudējušos pretendentus, tāpēc to pierādīt nevar. Izceļ tirgus, ko, iespējams, vērts aplūkot tuvāk.
      </p>

      <h3 className="section-title">Uz kā balstās metodoloģija</h3>
      <p>Indikatori un sliekšņi nav izdomāti — tie pārņemti no starptautiski validētiem iepirkumu integritātes ietvariem:</p>
      <div className="m-ind"><strong>OCP “Red Flags for Integrity” (Open Contracting Partnership).</strong> Starptautiska atvērto iepirkumu iniciatīva. Tās “sarkano karogu” katalogs definē tipiskās riska pazīmes (viens pretendents, sliekšņa tuvums, īsi termiņi) un pamatprincipu: karogs <strong>prioritizē izpēti, nepierāda pārkāpumu</strong>. No tā ņemtas indikatoru definīcijas. <a href="https://www.open-contracting.org/" target="_blank" rel="noopener noreferrer">open-contracting.org</a></div>
      <div className="m-ind"><strong>Cardinal (OCP).</strong> Atvērtā koda dzinējs, kas rēķina šos karogus uz OCDS datu standarta — kalpo kā gatavu formulu atsauce.</div>
      <div className="m-ind"><strong>Fazekas / DIGIWHIST / Opentender.</strong> Pētnieka Mihály Fazekas akadēmiskais darbs un ES projekts DIGIWHIST izveidoja Korupcijas riska indeksu (CRI) no “elementārajiem” integritātes indikatoriem. Galvenās atziņas, ko izmantojam: <strong>viena pretendenta īpatsvars ir visplašāk validētais proxy</strong>, un kompozītu indeksu bieži veido ar <strong>vienādiem/caurspīdīgiem svariem</strong>; indikators jāvērtē pret reālo nacionālo bāzi, ne ideālu nulli. Platforma <a href="https://opentender.eu/" target="_blank" rel="noopener noreferrer">opentender.eu</a> aptver ES, t.sk. Latviju.</div>
      <div className="m-ind"><strong>Pasaules Banka / GI-ACE.</strong> Pētījumos viena pretendenta gadījumi (“single bidding”) validēti kā galvenais korupcijas riska proxy 40+ valstīs — pamats nacionālās bāzes pieejai (B1).</div>
      <div className="m-ind"><strong>DOZORRO / Prozorro (Ukraina).</strong> Viena no pasaulē attīstītākajām sistēmām. No tās pārņemta <strong>modulārā arhitektūra</strong> (katrs indikators = atsevišķa, testējama klase) un princips, ka precīzos sliekšņus periodiski pārkalibrē un nepublicē tā, lai tie kļūtu par apiešanas instrukciju.</div>
      <p>Kā tas savienojas šajā rīkā: <strong>B1/B2</strong> = konkurences indikatori (Fazekas CRI kodols), <strong>A</strong> = sliekšņa apiešana/sadalīšana (OCP), <strong>C</strong> = cenu/vērtības novirze (statistiska z-score pieeja), <strong>E</strong> = procedūras integritāte, <strong>D</strong> = saistītās puses, <strong>G</strong> = līguma grozījumi pēc uzvaras (scope creep). <strong>Kopējais risks</strong> ir to svērta kombinācija, jo pētījumi rāda, ka atsevišķi karogi ir vāji, bet to sakritība — spēcīga.</p>

      <h3 className="section-title">Ierobežojumi</h3>
      <ul className="m-list">
        <li>IUB <strong>atvērtajā datu plūsmā</strong> (ko izmanto šī platforma) ir tikai uzvarētājs un piedāvājumu skaits. Pretendentu saraksts ar cenām gan ir publisks katra iepirkuma <strong>atvēršanas protokolā</strong> (EIS pasūtītāja profilā), taču ne kā strukturēti atvērti dati — tāpēc to nevar masveidā analizēt, un saskaņotas darbības šobrīd pierādīt nevar.</li>
        <li>Dati satur līgumu <strong>kopsummas</strong>, ne vienības cenas → C mēra vērtības, ne tīru pārmaksu.</li>
        <li>Sliekšņi un svari ir <strong>sākotnēji ieteikumi</strong>, kalibrējami uz reāliem datiem; pārkalibrējami administratorā.</li>
        <li>Pilnvērtīgi strukturēti dati pieejami no 2023. gada; retākās CPV kategorijās salīdzināmo datu bāze ir plānāka.</li>
      </ul>

      <h3 className="section-title">Juridiskie principi</h3>
      <ul className="m-list">
        <li>Visi dati ir publiski pieejami atvērtie dati; sistēma tos tikai apkopo un analizē.</li>
        <li>Karogs nav apsūdzība — vienmēr redzama atruna par statistisku novirzi.</li>
        <li>Katra karoga aprēķins ir izsekojams; pie katra ir saite uz IUB oriģinālu pārbaudei.</li>
        <li>Metodoloģija balstīta uz OCP “Red Flags for Integrity” un Fazekas/DIGIWHIST integritātes indikatoriem.</li>
      </ul>
    </div>
  );
}
