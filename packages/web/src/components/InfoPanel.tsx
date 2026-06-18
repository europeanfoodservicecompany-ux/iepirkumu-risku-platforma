import { useState } from 'react';

const INDICATORS = [
  {
    tag: 'B1', name: 'Viena pretendenta īpatsvars',
    text: 'Cik bieži pasūtītāja iepirkumos piedalās tikai viens piegādātājs. Daudz “viena pretendenta” gadījumu liecina par vāju konkurenci.',
  },
  {
    tag: 'B2', name: 'Uzvarētāju koncentrācija',
    text: 'Cik liela līgumu (naudas) daļa nonāk pie viena un tā paša uzvarētāja. Augsta koncentrācija norāda uz “iecienītu” piegādātāju.',
  },
  {
    tag: 'A', name: 'Iepirkumu sadalīšana',
    text: 'Vai pasūtītājs sadala vienu lielu pirkumu vairākos mazākos īsā laikā, lai katrs paliktu zem sliekšņa un izvairītos no atklātas procedūras.',
  },
  {
    tag: 'C', name: 'Cenu/vērtības novirze',
    text: 'Vai līgumvērtība ir neparasti augsta salīdzinājumā ar līdzīgiem iepirkumiem tajā pašā kategorijā. Uzmanīgi: augsta vērtība var nozīmēt arī vienkārši lielāku iepirkumu.',
  },
  {
    tag: 'E', name: 'Procedūras integritāte',
    text: 'Cik bieži pasūtītājs izmanto sarunu procedūru bez iepriekšējas konkurences izsludināšanas — t.i. apiet atklātu konkursu.',
  },
  {
    tag: 'D', name: 'Saistītās puses',
    text: 'Vai līgumus iegūst tikko dibināti uzņēmumi (reģistrēti īsi pirms uzvaras). Avots: Uzņēmumu reģistrs. Var liecināt par fiktīvu pretendentu vai saistītām pusēm.',
  },
];

export function InfoPanel() {
  const [open, setOpen] = useState(true);
  return (
    <div className="card info">
      <button className="info-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>ℹ️ Kā lasīt šo platformu</span>
        <span className="muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="info-body">
          <p style={{ marginTop: 8 }}>
            Platforma analizē Latvijas publiskos iepirkumus un meklē pazīmes, kas <strong>var</strong> liecināt
            par paaugstinātu risku. Katram pasūtītājam aprēķina rādītāju no <strong>0 līdz 100</strong> —
            jo augstāks, jo vairāk iepirkumu ir vērts pārbaudīt. Tas <strong>nav pārkāpuma pierādījums</strong>,
            bet norāde, kur cilvēkam paskatīties tuvāk.
          </p>

          <div className="grid info-grid" style={{ marginTop: 6 }}>
            {INDICATORS.map((i) => (
              <div className="info-card" key={i.tag}>
                <div className="info-card-head"><span className="tag">{i.tag}</span> {i.name}</div>
                <div className="muted small">{i.text}</div>
              </div>
            ))}
          </div>

          <div className="legend">
            <span className="badge green"><span className="dot" />Zaļš 0–29 · zems</span>
            <span className="badge yellow"><span className="dot" />Dzeltens 30–69 · vērts pārbaudīt</span>
            <span className="badge red"><span className="dot" />Sarkans 70–100 · augsts</span>
            <span className="muted small">Kopējais “Risks” = augstākais no trim indikatoriem.</span>
          </div>
        </div>
      )}
    </div>
  );
}
