// "Par šo vietni" — kāpēc platforma pastāv, kas to veido, kā datus izmantot. Uzticības pamats pilsoniskam rīkam.
const REPORT_EMAIL = 'janis.rupeiks@inbox.lv';

export function AboutView() {
  return (
    <div className="section" style={{ maxWidth: 760 }}>
      <h2 style={{ marginTop: 0 }}>Par šo vietni</h2>

      <div className="card" style={{ marginBottom: 14 }}>
        <p style={{ marginTop: 0 }}>
          <strong>iepirkumurisks.lv</strong> ir neatkarīga, publiska platforma, kas analizē Latvijas publiskos iepirkumus un
          izceļ vājas konkurences un iespējama riska pazīmes. Mērķis ir vienkāršs: padarīt publisko naudu caurspīdīgāku
          un palīdzēt žurnālistiem, pētniekiem un pilsoņiem saprast, kur vērts ieskatīties dziļāk.
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Karogs nav pierādījums.</strong> Visi rādītāji ir statistiskas norādes izpētei, ne apsūdzības. Katram
          karogam ir saite uz oriģinālu, lai to varētu pārbaudīt patstāvīgi.
        </p>
      </div>

      <h3 className="section-title">Kas to veido</h3>
      <div className="card" style={{ marginBottom: 14 }}>
        <p style={{ margin: 0 }}>
          Šo vietni <strong>izveidojis, finansējis un uztur Jānis Rupeiks</strong>. Tā nav saistīta ne ar vienu iestādi,
          partiju vai uzņēmumu, un tai nav ārēja finansējuma — tas nozīmē, ka nav interešu, kam kalpot, izņemot
          caurspīdīgumu.
        </p>
      </div>

      <h3 className="section-title">No kā veidoti dati</h3>
      <div className="card" style={{ marginBottom: 14 }}>
        <p style={{ marginTop: 0 }}>Visi dati ir publiski pieejami atvērtie dati:</p>
        <ul style={{ margin: '0 0 0 18px', padding: 0, lineHeight: 1.7 }}>
          <li><strong>IUB</strong> — Iepirkumu uzraudzības biroja paziņojumi (pretendenti, uzvarētāji, vērtības, grozījumi).</li>
          <li><strong>Uzņēmumu reģistrs</strong> — patiesā labuma guvēji, valde, dalībnieki, finanšu pārskati.</li>
          <li><strong>EIS</strong> — piedāvājumu atvēršanas dati (reālie pretendenti).</li>
          <li><strong>CFLA</strong> — ES fondu līdzfinansētie iepirkumi.</li>
        </ul>
        <p className="muted small" style={{ marginBottom: 0 }}>Dati atjaunojas automātiski. Metodoloģija balstīta uz OCP „Red Flags” un Fazekas/DIGIWHIST integritātes indikatoriem.</p>
      </div>

      <h3 className="section-title">Kā izmantot</h3>
      <div className="card" style={{ marginBottom: 14 }}>
        <p style={{ marginTop: 0 }}>
          Datus un secinājumus drīkst brīvi izmantot, tostarp medijos — lūgums norādīt avotu <strong>iepirkumurisks.lv</strong>.
          Pirms publicēšanas iesakām pārbaudīt oriģinālus pa katra karoga saiti.
        </p>
        <p style={{ marginBottom: 0 }}>
          Pamanīji neprecizitāti vai ir jautājums?{' '}
          <a href={`mailto:${REPORT_EMAIL}?subject=iepirkumurisks.lv`}>{REPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}
