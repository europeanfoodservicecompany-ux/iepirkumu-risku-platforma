export function MethodologyView() {
  return (
    <div className="card method">
      <h2 style={{ marginTop: 0 }}>Metodoloģija</h2>
      <p>
        Platforma analizē Latvijas publisko un pašvaldību iepirkumu atvērtos datus un identificē
        statistiskas pazīmes, kas literatūrā un praksē korelē ar paaugstinātu korupcijas vai negodprātīgas
        rīcības risku. Mērķis ir <strong>palīdzēt noteikt prioritātes turpmākai izpētei, nevis pierādīt pārkāpumu</strong>.
      </p>

      <h3 className="section-title">Kā lietot platformu</h3>
      <ul className="m-list">
        <li><strong>Pārskats</strong> — sākumlapa ar kopainu: galvenie skaitļi, riska sadalījums, vājākās nozares, Latvijas karte un sadaļa <strong>„Jaunākie karogi“</strong> (nesen piešķirti līgumi ar riska pazīmi). Ieteicams sākt šeit.</li>
        <li><strong>Pasūtītāji</strong> — meklējiet konkrētu iestādi vai pārlūkojiet sarakstu pēc kopējā riska līmeņa. Atverot profilu, redzami visi septiņi indikatori, konkrētie līgumi un sadaļa „kur aiziet nauda“ (galvenie piegādātāji).</li>
        <li><strong>Piegādātāji</strong> — skatījums no piegādātāja puses: visi tā līgumi pie visiem pasūtītājiem, atkarība no viena pasūtītāja, īpašnieki (patiesā labuma guvēji, valde) un saistītie uzņēmumi.</li>
        <li><strong>Personas</strong> — meklējiet pēc personas (patiesā labuma guvēja vai valdes locekļa) un skatiet visus ar to saistītos uzvarētājus. Filtri: nozare, vērtība, līgumu skaits, saiknes veids. Poga „Parādīt saikņu tīklu“ attēlo diagrammu persona → uzņēmumi → pasūtītāji.</li>
        <li><strong>Nozares un slēgtie tirgi</strong> — konkurence pa CPV nozarēm un tirgi ar augstu koncentrāciju.</li>
        <li><strong>Aktuālie konkursi</strong> — vēl notiekoši (nepabeigti) iepirkumi ar brīdinājuma pazīmēm pirms rezultāta.</li>
        <li><strong>Analīze</strong> — vizuāli pārskati (indikatoru siltuma karte, izkliede, sezonalitāte, slēgtie tirgi).</li>
      </ul>
      <p className="muted small">
        Visā platformā tiek lietots vienots krāsu apzīmējums: zaļš — zems risks, dzeltens — vidējs risks,
        sarkans — augsts risks. Gandrīz visas rindas ir spiežamas un ved uz profilu vai EIS oriģinālu.
        Kur pieejama tieša EIS saite, tā pievienota pārbaudei.
      </p>

      <h3 className="section-title">Datu avoti</h3>
      <ul className="m-list">
        <li><strong>Iepirkumu uzraudzības birojs (IUB)</strong> — e-veidlapu atvērtie dati (open.iub.gov.lv): paziņojumi, līgumi, summas, uzvarētāji, CPV, saņemto piedāvājumu skaits, <strong>iepirkuma priekšmeta nosaukums un kontaktpersona</strong> (tikai vārds un iestāde, kurā iepirkums veikts — bez e-pasta/tālruņa; tie ir no paša paziņojuma, tātad atbilst iepirkuma rīkošanas laikam).</li>
        <li><strong>Publisko personu un iestāžu saraksts (UR)</strong> — pasūtītāja konteksts: iestādes tips (ministrija/pašvaldība/tiesa u.c.), augstākā (mātes) iestāde un oficiālais e-pasts. Šie ir <strong>aktuālie</strong> dati (UR uztur tikai pašreizējo stāvokli, ne vēsturi pa datumiem), tāpēc tie var atšķirties no iepirkuma rīkošanas laika. Reģistrā nav iestādes vadītāja vārda.</li>
        <li><strong>Uzņēmumu reģistrs (UR)</strong> — atvērtie dati: uzņēmumu reģistrācijas datumi (D indikatoram), <strong>patiesā labuma guvēji un valde</strong> (personu saiknēm) un <strong>SIA dalībnieki (kapitāldaļu turētāji)</strong> (holdinga ķēdēm — kam pieder uzvarētājs un kuri uzvarētāji ir vienā holdingā), <strong>juridiskā adrese</strong> (uzvarētāji vienā adresē) un <strong>gada pārskatu finanšu dati</strong> (apgrozījums, darbinieku skaits — “frontes firmas” pazīme: ļoti maz resursu lieliem līgumiem). Latvijā šie dati ir publiski pieejami, kas ļauj identificēt savstarpēji saistītus pretendentus.</li>
        <li>Aptvertais periods redzams sākumlapā; pabeigtie (ar rezultātu) iepirkumi tiek vērtēti, notiekošie konkursi rādīti atsevišķi.</li>
      </ul>

      <h3 className="section-title">Par līgumvērtībām</h3>
      <p>
        Vērtības ņemtas no līguma datiem. Lielos ietvara iepirkumos IUB datos viena un tā pati summa
        bieži atkārtojas daudzās pozīcijās (angļu val. „lots“), mākslīgi uzpūšot kopvērtību — tāpēc <strong>atkārtotas
        vērtības vienā procedūrā kopsummās neieskaitām</strong> (skaitļi un riska indikatori netiek skarti). Ietvara
        līgumiem ar vairākiem līdzuzvarētājiem IUB nesniedz vērtības sadalījumu pa piegādātājiem, tāpēc <strong>šāda
        kopējā summa piegādātāja vērtībā netiek ieskaitīta</strong> (labāk neiekļaut datus, nekā tos attiecināt nepareizi).
        Tādēļ atsevišķu piegādātāju vērtības var būt nedaudz nenovērtētas.
      </p>

      <h3 className="section-title">Indikatori</h3>
      <div className="m-ind"><span className="tag">B1</span><strong>Viena pretendenta īpatsvars.</strong> Cik no pasūtītāja iepirkumiem (atklātā vai slēgtā procedūrā ar izvēlētu uzvarētāju) saņēma tikai vienu piedāvājumu. Salīdzināts nevis ar vienu valsts vidējo, bet ar <strong>attiecīgo nozaru (CPV) sagaidāmo līmeni</strong> (Fazekas ieteikums — nozares dabiski atšķiras, piem. IT daudz biežāk viens pretendents), un <strong>svērts pēc līgumu vērtības</strong> (liels viena-pretendenta līgums sver vairāk nekā daudzi sīki). Dzeltens no 1,3×, sarkans no 1,7× virs nozarei sagaidāmā.</div>
      <div className="m-ind"><span className="tag">B2</span><strong>Uzvarētāju koncentrācija.</strong> Cik koncentrēti līgumi (pēc vērtības) nonāk pie nedaudziem uzvarētājiem — Herfindāla–Hiršmana indekss (HHI) un lielākā uzvarētāja daļa.</div>
      <div className="m-ind"><span className="tag">A</span><strong>Iepirkumu sadalīšana.</strong> Vairāki slieksnim tuvi līgumi vienā CPV grupā īsā laika logā (90 dienas), kas katrs paliek zem procedūras sliekšņa (preces un pakalpojumi 42 000 €, būvdarbi 170 000 €), bet kopā to pārsniedz. Sarkans, ja ir ≥4 līgumi, viens uzvarētājs vai kopsumma &gt;1,5× slieksnis.</div>
      <div className="m-ind"><span className="tag">C</span><strong>Cenas vai vērtības novirze.</strong> Līgumvērtības logaritmiskā novirze (z-vērtība) no valsts sadalījuma tajā pašā CPV (≥5 salīdzināmi līgumi). <em>Mēra vērtības, nevis vienības cenas novirzi</em> — augsta vērtība var nozīmēt arī apjomīgāku iepirkumu.</div>
      <div className="m-ind"><span className="tag">E</span><strong>Procedūras integritāte.</strong> Sarunu procedūru bez iepriekšējas konkurences izsludināšanas īpatsvars — valstī tas ir reti (~2%), tāpēc augsts īpatsvars izceļas.</div>
      <div className="m-ind"><span className="tag">D</span><strong>Saistītās puses.</strong> Uzvarētāji, kas reģistrēti neilgi pirms līguma iegūšanas (mazāk nekā 6 mēnešus iepriekš) — klasiska saistīto pušu vai fiktīva pretendenta pazīme (UR reģistrācijas dati).</div>
      <div className="m-ind"><span className="tag">G</span><strong>Līguma grozījumi pēc uzvaras.</strong> Cik liela pasūtītāja līgumu daļa pēc uzvaras tiek grozīta ar <em>papildu darbiem vai piegādēm</em> (add-wss) vai <em>izpildītāja maiņu</em> (mod-repl) — klasiska shēma „uzvar lēti, pēc tam summu uzpūš ar papildu vienošanos“ (IUB grozījumu paziņojumi, PIL 61. p.). Daudzi grozījumi ir likumīgi (termiņa pagarinājums, indeksācija) — tāpēc skaita tikai būtiskos un tikai īpatsvaru. Grozījuma summa nav tīrs pieaugums, tāpēc to nerāda procentos.</div>

      <h3 className="section-title">Kopējais svērtais risks</h3>
      <p>
        Kopējais rādītājs ir slāņu svērta kombinācija: B 26% (lielākā no B1 un B2), A 22%, C 17%, G 15%, D 12%, E 8%.
        Vidējo rēķina <strong>tikai pār tiem slāņiem, kuriem ir pietiekami dati</strong> (trūkstošs slānis netiek pieskaitīts kā nulle).
        Lai izvairītos no maldinošiem secinājumiem ar maz datu, ir uzticamības kāpnes: kombinēto rādītāju rēķina tikai tad, ja
        novērtējami <strong>vismaz 2 slāņi</strong>, un <strong>sarkans</strong> iespējams tikai ar <strong>vismaz 3 sakrītošiem signāliem</strong> —
        tādējādi augstu risku rada vairāku pazīmju sakritība, nevis viens atsevišķs rādītājs. Krāsas: zaļš 0–29, dzeltens 30–59, sarkans 60–100.
      </p>

      <h3 className="section-title">Slēgtie tirgi (vāja konkurence tirgū)</h3>
      <p>
        Tirgus (CPV) līmenī: augsta uzvarētāju koncentrācija (HHI) un augsts viena pretendenta īpatsvars.
        Tā ir <strong>netieša</strong> pazīme par vāju konkurenci, balstīta uz uzvarētāju koncentrāciju.
        Tiešāku pretendentu analīzi sk. sadaļā «Karteļa pazīmes».
      </p>

      <h3 className="section-title">Karteļa pazīmes (reāli pretendentu tīkli)</h3>
      <p>
        Atšķirībā no slēgtajiem tirgiem, šī sadaļa balstās uz <strong>reāliem pretendentiem</strong> (arī zaudētājiem) no EIS
        piedāvājumu atvēršanas atvērtajiem datiem. Rāda pretendentu pārus, kas bieži piedalās <strong>kopā un ekskluzīvi</strong>
        (vismaz 5 reizes, ≥50% gadījumu konkursā tikai viņi divi), un šķiro tos: <strong>rotācija</strong> (uzvaras sadalītas
        līdzsvaroti) vai <strong>segums</strong> (viens vienmēr uzvar, otrs nekad). Konservatīvi sliekšņi izfiltrē likumīgos
        oligopolus (apdrošinātāji, mazumtirgotāji). <strong>Karogs nav pierādījums</strong> — visbiežāk tas ir reāls divu firmu
        (duopola) tirgus; aizdomas pastiprina kopīgs īpašnieks vai adrese. Segums attiecas tikai uz iepirkumiem, kas rīkoti caur EIS.
      </p>

      <h3 className="section-title">Personu saiknes (īpašnieki un vadība)</h3>
      <p>
        Sasaistot iepirkumu uzvarētājus ar Uzņēmumu reģistra atvērtajiem datiem (patiesā labuma guvēji, valde),
        var redzēt, kad vairāki „konkurējoši“ pretendenti patiesībā pieder vai tiek vadīti no vieniem un tiem pašiem cilvēkiem.
        Personas ieraksti tiek apvienoti pēc normalizēta vārda un personas koda; <strong>publiski rādīti tikai pirmie četri
        personas koda cipari</strong>. Saiknes stiprumu vērtējam pēc tā, cik uzņēmumu <em>pārklājas</em>:
      </p>
      <ul className="m-list">
        <li><strong>Vienā procedūrā</strong> — vienas personas ≥2 uzņēmumi uzvar tajā pašā iepirkumā (spēcīgākā pazīme).</li>
        <li><strong>Dominē slēgtā tirgū</strong> — ≥2 uzņēmumi ir starp viena augstas koncentrācijas tirgus lielākajiem uzvarētājiem.</li>
        <li><strong>Kopīgs tirgus</strong> — ≥2 uzņēmumi konkurē vienā CPV4 nišā.</li>
        <li><strong>Kopīgs pasūtītājs</strong> — ≥2 uzņēmumi uzvar pie viena pasūtītāja.</li>
      </ul>
      <p>
        Šādas saiknes <strong>nav pārkāpums</strong> — liela uzņēmumu grupa likumīgi var turēt vairākus uzņēmumus. Tā ir tikai
        norāde uz iespējami vāju konkurenci vai interešu konfliktu, ko līdz šim nebija viegli publiski redzēt.
      </p>

      <h3 className="section-title">Vārda sakritība ar Saeimas deputātu</h3>
      <p>
        Pie personas var parādīties atzīme <em>„vārda sakritība: Saeimas deputāts“</em>. Tā nozīmē, ka personas vārds un
        uzvārds sakrīt ar kādu no 14. Saeimas <strong>ievēlētajiem</strong> deputātiem (avots: Centrālās vēlēšanu komisijas
        atvērtie 2022. gada vēlēšanu dati, licence CC0). Mērķis ir palīdzēt pamanīt, kad publiskie līgumi varētu būt saistīti
        ar politiski nozīmīgām personām.
      </p>
      <ul className="m-list">
        <li><strong>Tikai ievēlētie deputāti.</strong> Vēlēšanu kandidātus, kas netika ievēlēti, <strong>neatzīmējam</strong> — kandidāts nav politiski nozīmīga persona un tam nav ietekmes uz iepirkumiem.</li>
        <li><strong>Sasaiste ir tikai pēc vārda un uzvārda, bez personas koda.</strong> Tāpēc atzīme var attiekties uz <strong>citu personu ar tādu pašu vārdu</strong>. Tā ir norāde pārbaudei, ne apstiprinājums, un neietver pieņēmumu par pārkāpumu.</li>
        <li><strong>Saraksts ir daļējs un novecojošs.</strong> Tas balstās tikai uz vienu vēlēšanu sarakstu; ministri, pašvaldību deputāti, kapitālsabiedrību vadītāji un ģimenes locekļi nav iekļauti. Atzīmes neesamība nenozīmē, ka persona nav politiski nozīmīga.</li>
        <li><strong>Kāpēc nevaram pārbaudīt automātiski.</strong> Pilnai pārbaudei vajadzīgs personas kods, taču mūsu maskētais kods rāda tikai dienu un mēnesi, savukārt vēlēšanu dati satur tikai dzimšanas gadu — kopīga lauka nav. Autoritatīvo pārbaudi (ar personas kodu) nodrošina Valsts ieņēmumu dienesta politiski nozīmīgu personu reģistrs.</li>
      </ul>
      <p>
        Ja atzīme attiecas uz citu personu, lūdzam par to ziņot — kļūdu izlabosim. Šī pazīme ir daļēja demonstrācija; pilnvērtīga
        būtu iespējama, ja politiski nozīmīgu personu reģistrs būtu pieejams mašīnlasāmā atvērto datu formātā.
      </p>

      <h3 className="section-title">„Jaunākie karogi“</h3>
      <p>
        Sākumlapas plūsma rāda nesen piešķirtus līgumus, kuriem ir skaidra riska pazīme, jaunākos pirmos: <strong>viens
        pretendents</strong> (līgumā ≥100 tūkst. €), <strong>slēgts tirgus</strong> (augstas koncentrācijas CPV nozarē ar vienu
        pretendentu) vai <strong>neparasta vērtība</strong> (C cenas vai vērtības novirze). Tas ir ērts veids, kā sekot līdzi
        notiekošajam — katrs ieraksts ved uz pasūtītāja vai piegādātāja profilu un EIS oriģinālu.
      </p>

      <h3 className="section-title">Uz kā balstās metodoloģija</h3>
      <p>Indikatori un sliekšņi nav izdomāti — tie pārņemti no starptautiski validētiem iepirkumu integritātes ietvariem:</p>
      <div className="m-ind"><strong>OCP „Red Flags for Integrity“ (Open Contracting Partnership).</strong> Starptautiska atvērto iepirkumu iniciatīva. Tās „sarkano karogu“ katalogs definē tipiskās riska pazīmes (viens pretendents, sliekšņa tuvums, īsi termiņi) un pamatprincipu: karogs <strong>palīdz noteikt izpētes prioritātes, taču pats par sevi nepierāda pārkāpumu</strong>. No tā ņemtas indikatoru definīcijas. <a href="https://www.open-contracting.org/" target="_blank" rel="noopener noreferrer">open-contracting.org</a></div>
      <div className="m-ind"><strong>Cardinal (OCP).</strong> Atvērtā koda dzinējs, kas aprēķina šos karogus uz OCDS datu standarta — kalpo kā gatavu formulu atsauce.</div>
      <div className="m-ind"><strong>Fazekas / DIGIWHIST / Opentender.</strong> Pētnieka Mihály Fazekas akadēmiskais darbs un ES projekts DIGIWHIST izveidoja Korupcijas riska indeksu (CRI) no „elementārajiem“ integritātes indikatoriem. Galvenās atziņas, ko izmantojam: <strong>viena pretendenta īpatsvars ir visplašāk validētā riska pazīme</strong>, un kopējo indeksu bieži veido ar <strong>vienādiem un caurskatāmiem svariem</strong>; indikators jāvērtē pret reālo valsts bāzi, nevis ideālu nulli. Platforma <a href="https://opentender.eu/" target="_blank" rel="noopener noreferrer">opentender.eu</a> aptver ES, t. sk. Latviju.</div>
      <div className="m-ind"><strong>Pasaules Banka / GI-ACE.</strong> Pētījumos viena pretendenta gadījumi (angļu val. „single bidding“) validēti kā galvenā korupcijas riska pazīme 40+ valstīs — pamats valsts bāzes pieejai (B1).</div>
      <div className="m-ind"><strong>DOZORRO / Prozorro (Ukraina).</strong> Viena no pasaulē attīstītākajām sistēmām. No tās pārņemta <strong>modulārā arhitektūra</strong> (katrs indikators ir atsevišķa, testējama klase) un princips, ka precīzos sliekšņus periodiski pārkalibrē un nepublicē tā, lai tie kļūtu par apiešanas pamācību.</div>
      <p>Kā tas savienojas šajā rīkā: <strong>B1 un B2</strong> — konkurences indikatori (Fazekas CRI kodols), <strong>A</strong> — sliekšņa apiešana jeb sadalīšana (OCP), <strong>C</strong> — cenas vai vērtības novirze (statistiska vērtību novirzes / z-vērtības pieeja), <strong>E</strong> — procedūras integritāte, <strong>D</strong> — saistītās puses, <strong>G</strong> — līguma grozījumi pēc uzvaras (apjoma izplešanās, angļu val. „scope creep“). <strong>Kopējais risks</strong> ir to svērta kombinācija, jo pētījumi rāda, ka atsevišķi karogi ir vāji, bet to sakritība — spēcīga.</p>

      <h3 className="section-title">Ierobežojumi</h3>
      <ul className="m-list">
        <li>IUB atvērtajā datu plūsmā ir tikai uzvarētājs un piedāvājumu skaits. <strong>Pretendentu identitātes</strong> (arī zaudētāju) platforma iegūst no EIS <strong>piedāvājumu atvēršanas atvērtajiem datiem</strong> un izmanto karteļa pazīmju sadaļā. Tās gan sedz tikai caur EIS rīkotos iepirkumus (liela, bet ne pilnīga daļa), un satur, <strong>kas</strong> piedalījās, ne katra <strong>piedāvāto cenu</strong> — tāpēc saskaņotu rīcību joprojām var tikai iezīmēt izpētei, ne pierādīt automātiski.</li>
        <li>Dati satur līgumu <strong>kopsummas</strong>, nevis vienības cenas, tāpēc C mēra vērtības, nevis tīru pārmaksu.</li>
        <li>IUB avota datos vērtības mēdz būt <strong>kļūdainas</strong>: viens uzvarētājs reizēm ierakstīts vienā līgumā divreiz ar nobīdītu komatu (piem., 178&nbsp;573,54 un 17&nbsp;857&nbsp;354 — tā pati summa ×100), un atsevišķi paziņojumi tiek <strong>atkārtoti publicēti</strong>. Platforma tos automātiski koriģē — atmet desmitkārtīgos komata dublikātus, bet patiesi atšķirīgas līguma daļas saglabā un saskaita, kā arī apvieno atkārtoti publicētos paziņojumus. Tāpēc kopvērtības ir <strong>aptuvenas (≈)</strong>, un atsevišķi ļoti lieli skaitļi (ietvara griesti, lielprojekti) var atspoguļot pašas IUB ievadītās vērtības.</li>
        <li>Sliekšņi un svari ir <strong>sākotnēji ieteikumi</strong>, kalibrējami uz reāliem datiem; pārkalibrējami administratorā.</li>
        <li>Pilnvērtīgi strukturēti dati pieejami no 2023. gada; retākās CPV kategorijās salīdzināmo datu bāze ir plānāka.</li>
      </ul>

      <h3 className="section-title">Zināmās IUB datu kvalitātes problēmas</h3>
      <p>
        Veidojot šo platformu, atklājās virkne sistēmisku problēmu pašos IUB atvērtajos datos. Tās nav mūsu kļūdas —
        tās ir avota datu trūkumi, kurus šeit dokumentējam caurskatāmības labad un kuri būtu jārisina datu publicētājam.
      </p>
      <ul className="m-list">
        <li><strong>Dublikāti (~11%).</strong> No 75 492 apstrādātajiem ierakstiem 8 081 (11%) bija dublikāti — viens un tas pats iepirkums vairākos paziņojumos vai ar dažādiem iekšējiem identifikatoriem. Piem., EIS 113795: viens 87 980 € līgums ierakstīts divreiz.</li>
        <li><strong>Komata vai mērvienības kļūdas.</strong> Vairāk nekā 50 līgumos summa ierakstīta ×100 par lielu (nobīdīts komats), kopā vairāk nekā 1 miljards € mākslīgi uzpūstas vērtības. Piem., autoceļš P124: 4,4 milj. € ierakstīts kā 440 milj. €; Allažu bērnu centrs: 2,1 milj. € kā 209 milj. €; Arbor Medical: 178 573,54 € arī kā 17 857 354 €.</li>
        <li><strong>Iekšēji pretrunīgi dati.</strong> Vienai procedūrai (d4634f79) pašas IUB lauks <code>noticeContractValue</code> divos paziņojumos atšķiras: 4,4 miljardi € pret 438 miljoniem €.</li>
        <li><strong>Trūkstošas vērtības (~3,7%).</strong> 1 930 piešķirtiem līgumiem IUB vispār nepublicē vērtību — ne kopsummu, ne sadalījumu, ne aplēsi. To skaitā daudzpiegādātāju ietvariem.</li>
        <li><strong>Trūkstošas saites (~26%).</strong> 17 535 ierakstiem nav tiešās EIS saites uz konkrēto iepirkumu — tikai pasūtītāja profils vai nekā.</li>
        <li><strong>Nestrukturēti dati par pretendentiem.</strong> Atvērtajos datos ir tikai uzvarētājs un piedāvājumu skaits; zaudējušo pretendentu saraksts ar cenām pieejams tikai katra iepirkuma atvēršanas protokolā (EIS), nevis strukturēti — tāpēc saskaņotu rīcību masveidā pierādīt nevar.</li>
      </ul>
      <p>
        Ja šie dati būtu publicēti tīri un pilnīgi (unikāli identifikatori, pārbaudītas vērtības, tiešas saites, strukturēti
        dati par pretendentiem), šāda analīze būtu daudz precīzāka, un sabiedrība varētu efektīvāk uzraudzīt publisko līdzekļu izlietojumu.
      </p>

      <h3 className="section-title">Juridiskie principi</h3>
      <ul className="m-list">
        <li>Visi dati ir publiski pieejami atvērtie dati; sistēma tos tikai apkopo un analizē.</li>
        <li>Neviens karogs nav uzskatāms par apsūdzību — vienmēr redzama atruna par statistisku novirzi.</li>
        <li>Katra karoga aprēķins ir izsekojams; kur EIS publicē tiešo saiti uz konkrēto iepirkumu, tā ir pievienota pārbaudei (daļai vecāku ierakstu EIS sniedz tikai pasūtītāja profila saiti, nevis tiešo — tādos gadījumos saiti nerādām, lai neaizvestu uz sākumskatu).</li>
        <li>Metodoloģija balstīta uz OCP „Red Flags for Integrity“ un Fazekas / DIGIWHIST integritātes indikatoriem.</li>
      </ul>
    </div>
  );
}
