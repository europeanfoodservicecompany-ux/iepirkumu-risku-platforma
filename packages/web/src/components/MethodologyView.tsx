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

      <h3 className="section-title">Indikatori</h3>
      <div className="m-ind"><span className="tag">B1</span><strong>Viena pretendenta īpatsvars.</strong> Cik % pasūtītāja iepirkumu (atklātā/slēgtā procedūrā ar izvēlētu uzvarētāju) saņēma tikai vienu piedāvājumu. Attiecināts pret nacionālo vidējo (~24–26%). Dzeltens no 1,3×, sarkans no 1,7× virs vidējā.</div>
      <div className="m-ind"><span className="tag">B2</span><strong>Uzvarētāju koncentrācija.</strong> Cik koncentrēti līgumi (pēc vērtības) nonāk pie nedaudziem uzvarētājiem — Herfindāla–Hiršmana indekss (HHI) + lielākā uzvarētāja daļa.</div>
      <div className="m-ind"><span className="tag">A</span><strong>Iepirkumu sadalīšana.</strong> Vairāki tuvu-slieksnim līgumi vienā CPV grupā īsā laika logā (90 dienas), kas katrs paliek zem procedūras sliekšņa (preces/pakalpojumi 42 000 €, būvdarbi 170 000 €), bet kopā to pārsniedz. Sarkans, ja ≥4 līgumi, viens uzvarētājs vai kopsumma &gt;1,5× slieksnis.</div>
      <div className="m-ind"><span className="tag">C</span><strong>Cenu/vērtības novirze.</strong> Līgumvērtības logaritmiskais z-score pret nacionālo sadalījumu tajā pašā CPV (≥5 salīdzināmi līgumi). <em>Mēra vērtības, ne vienības cenas novirzi</em> — augsta vērtība var nozīmēt arī lielāku iepirkumu.</div>
      <div className="m-ind"><span className="tag">E</span><strong>Procedūras integritāte.</strong> Sarunu procedūras bez iepriekšējas konkurences izsludināšanas (neg-wo-call) īpatsvars — valstī tas ir reti (~2%), tāpēc augsts īpatsvars izceļas.</div>
      <div className="m-ind"><span className="tag">D</span><strong>Saistītās puses.</strong> Uzvarētāji, kas reģistrēti īsi (&lt;6 mēneši) pirms līguma iegūšanas — klasisks saistīto pušu / fiktīva pretendenta signāls (UR reģistrācijas dati).</div>

      <h3 className="section-title">Kopējais svērtais risks</h3>
      <p>
        Kopējais rādītājs ir slāņu svērta kombinācija: B 30% (max no B1/B2), A 25%, C 20%, D 15%, E 10%.
        Trūkstošs slānis dod 0 ieguldījumu — tā <strong>augstu risku rada vairāku signālu sakritība</strong>,
        ne viens izolēts rādītājs. Krāsas: zaļš 0–29, dzeltens 30–69, sarkans 70–100.
      </p>

      <h3 className="section-title">Slēgtie tirgi (karteļa netieša pazīme)</h3>
      <p>
        Tirgus (CPV) līmenī: augsta uzvarētāju koncentrācija (HHI) + augsta viena-pretendenta likme.
        Tā ir tikai <strong>netieša</strong> pazīme — IUB nepublicē zaudētāju identitātes, tāpēc saskaņotu
        rīcību (bid-rotation) nevar pierādīt. Izceļ tirgus, ko vērts nodot Konkurences padomei.
      </p>

      <h3 className="section-title">Ierobežojumi</h3>
      <ul className="m-list">
        <li>Pieejamas tikai <strong>uzvarētāju</strong>, ne zaudējušo pretendentu identitātes → karteļus nevar pierādīt.</li>
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
