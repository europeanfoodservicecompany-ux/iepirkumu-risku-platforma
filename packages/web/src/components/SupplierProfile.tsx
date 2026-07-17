import type { WinnerDetail } from '../types.ts';
import { eur, pct, downloadCsv } from '../format.ts';
import { Disclaimer } from './Disclaimer.tsx';
import { CopyLink } from './CopyLink.tsx';
import { StarNet } from './BidderNet.tsx';

const ROLE: Record<string, string> = { PLG: 'patiesā labuma guvējs', valde: 'valdes loceklis', likvidators: 'likvidators', amatpersona: 'amatpersona' };
const roleLabel = (r: string) => ROLE[r] ?? r;

function Flag({ url, children }: { url?: string | null; children: React.ReactNode }) {
  return url
    ? <a className="lot row-link" href={url} target="_blank" rel="noopener noreferrer">{children}</a>
    : <div className="lot">{children}</div>;
}

export function SupplierProfile({ winner, onSelectBuyer }: { winner: WinnerDetail; onSelectBuyer: (id: string) => void }) {
  const w = winner;
  // Karogus rāda tikai ar pietiekamu paraugu (≥5 līgumi) — citādi 1 līgums = 100% maldina.
  const enough = w.contracts >= 5;
  const sbHigh = enough && w.singleBidRate >= 0.7;
  const depHigh = enough && w.topBuyerShare >= 0.8 && w.buyers <= 2;

  function exportCsv() {
    const rows: (string | number | null)[][] = [];
    for (const g of w.byBuyer) for (const l of g.lots)
      rows.push([g.buyerName ?? g.buyerId, l.value ?? '', l.date ?? '', l.receivedBids ?? '', l.singleBid ? 'jā' : '', (l.cpv ?? '').slice(0, 8), l.sourceUrl ?? '']);
    const safe = (w.winnerName ?? w.winnerId).replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
    downloadCsv(`piegadatajs_${safe}.csv`, ['Pasūtītājs', 'Summa EUR', 'Datums', 'Piedāvājumi', 'Viens pretendents', 'CPV', 'EIS saite'], rows);
  }

  return (
    <div>
      <div className="card">
        <div className="profile-head">
          <div>
            <h2>{w.winnerName ?? w.winnerId}</h2>
            <div className="muted small mono">Reģ. nr. {w.winnerId}{w.sectorLabel ? ` · ${w.sectorLabel}` : ''}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {sbHigh && <span className="badge red" title="Norāde izpētei, nevis pārkāpuma pierādījums. Augsta viena-pretendenta daļa var nozīmēt arī specifisku tirgu."><span className="dot" aria-hidden="true" />Bieži vienīgais pretendents</span>}
              {depHigh && <span className="badge red" title="Norāde izpētei, nevis pārkāpuma pierādījums. Augsta atkarība no viena pasūtītāja var būt arī nozares specifika."><span className="dot" aria-hidden="true" />Atkarīgs no 1 pasūtītāja</span>}
              <button className="filter-btn" onClick={exportCsv}>⬇ Līgumi CSV</button>
              <CopyLink path={`p/winner/${encodeURIComponent(w.fileId)}`} />
            </div>
          </div>
          <div className="bigscore">
            <div className="bigval mono">≈ {eur(w.awardedValue)}</div>
            <div className="l">Uzvarēto līgumu kopvērtība (aptuvena)</div>
          </div>
        </div>
      </div>

      <div className="section grid cols-3">
        <div className="card stat"><div className="num">{w.contracts}</div><div className="lbl">Uzvarēti līgumi</div></div>
        <div className="card stat"><div className="num">{w.buyers}</div><div className="lbl">Atšķirīgi pasūtītāji</div></div>
        <div className="card stat"><div className="num" style={{ color: sbHigh ? 'var(--red)' : undefined }}>{pct(w.singleBidRate, 0)}</div><div className="lbl">Uzvar kā vienīgais pretendents</div></div>
      </div>

      <div className="card">
        <p className="muted small" style={{ margin: 0 }}>
          {depHigh
            ? `${pct(w.topBuyerShare, 0)} no vērtības nāk no viena pasūtītāja (${w.topBuyerName ?? '–'}) — augsta atkarība, vērts pārbaudīt attiecības raksturu.`
            : `Lielākais pasūtītājs: ${w.topBuyerName ?? '–'} (${pct(w.topBuyerShare, 0)} no vērtības).`}
          {' '}Karogs nav pierādījums — augsta viena-pretendenta daļa var nozīmēt arī specifisku tirgu.
        </p>
      </div>

      <div className="card">
        <div className="disclaimer">
          <strong>Vērtības ir aptuvenas (≈).</strong> IUB atvērtie dati par lieliem un ietvara iepirkumiem mēdz būt nepilnīgi
          vai paši sev pretrunā (piem. viena procedūra ar diviem dažādiem kopskaitļiem), tāpēc summas var atšķirties no faktiskajām.
          Skaitļus izmanto lieluma salīdzināšanai, ne precīzai uzskaitei. Riska pazīmes balstās uz līgumu skaitu un attiecībām, ne absolūtām summām.
        </div>
      </div>

      {w.offshore && w.offshore.owners.length > 0 && (
        <>
          <h3 className="section-title">{w.offshore.tier === 'offshore' ? 'Ofšora patiesā labuma guvējs' : 'Zemu nodokļu jurisdikcija'}</h3>
          <div className="card" style={{ borderLeft: '4px solid var(--red)' }}>
            <p className="muted small" style={{ marginTop: 0 }}>
              Šī uzņēmuma <strong>patiesā labuma guvējs</strong> (faktiskais īpašnieks) ir reģistrēts vai dzīvo
              {w.offshore.tier === 'offshore' ? ' klasiskā ofšora / noslēpumainības jurisdikcijā' : ' zemu nodokļu jurisdikcijā'}.
              Tas apgrūtina patieso īpašnieku pārbaudi. <strong>Karogs nav pierādījums</strong> — dzīvot ārvalstī ir legāli;
              tā ir caurspīdīguma pazīme, kas var būt vērts pārbaudīt.
            </p>
            {w.offshore.owners.map((o, i) => (
              <div key={i} className="plg-owner">
                <span className="plg-av">{(o.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('')}</span>
                <span style={{ flex: 1 }}>{o.name}</span>
                <span className={`note-tag ${o.tier === 'offshore' ? 'note-high' : ''}`}>{o.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {w.phoenix && (
        <>
          <h3 className="section-title">Iespējama “fēniksa” firma</h3>
          <div className="card" style={{ borderLeft: '4px solid var(--red)' }}>
            <p className="muted small" style={{ marginTop: 0 }}>
              Šī ir <strong>nesen reģistrēta</strong> firma{w.phoenix.registered ? ` (${w.phoenix.registered})` : ''}, kas dala {w.phoenix.via} ar vecāku uzvarētāju{' '}
              {w.phoenix.predecessorFileId
                ? <a className="btn-link" href={`#/winner/${encodeURIComponent(w.phoenix.predecessorFileId)}`}>{w.phoenix.predecessorName ?? w.phoenix.predecessorReg}</a>
                : <strong>{w.phoenix.predecessorName ?? w.phoenix.predecessorReg}</strong>}
              {' '}un turpina uzvarēt pie tā paša pasūtītāja <strong>{w.phoenix.buyerName ?? w.phoenix.buyerId}</strong>.
              Iespējama reputācijas vai parādu “pārdzimšana”. <strong>Karogs nav pierādījums</strong> — tā var būt arī likumīga pārstrukturizācija.
            </p>
          </div>
        </>
      )}

      {w.homeAdvantage && (
        <>
          <h3 className="section-title">Mājas priekšrocība</h3>
          <div className="card" style={{ borderLeft: '4px solid var(--red)' }}>
            <p className="muted small" style={{ marginTop: 0 }}>
              Šis piegādātājs pie pasūtītāja <strong>{w.homeAdvantage.buyerName ?? w.homeAdvantage.buyerId}</strong> uzvar
              <strong> {Math.round(w.homeAdvantage.winRateThere * 100)}%</strong> gadījumu ({w.homeAdvantage.partsThere} dalības),
              bet citur — tikai <strong>{Math.round(w.homeAdvantage.winRateElse * 100)}%</strong> ({w.homeAdvantage.partsElse} dalības).
              Krasa atšķirība var liecināt par <strong>favorītismu</strong>. <strong>Karogs nav pierādījums</strong> — to var izskaidrot arī specializācija vai ģeogrāfija.
            </p>
          </div>
        </>
      )}

      {w.beneficialOwners && w.beneficialOwners.length > 0 && (
        <>
          <h3 className="section-title">Patiesā labuma guvēji</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>Uzņēmuma patiesie labuma guvēji (Uzņēmumu reģistra atvērtie dati). No personas koda rādīti tikai pirmie 4 cipari.</p>
            {w.beneficialOwners.map((o, i) => (
              <div key={i} className="plg-owner">
                <span className="plg-av">{(o.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('')}</span>
                <span style={{ flex: 1 }}>{o.name}</span>
                <span className="muted small mono">{o.id}{o.nat ? ` · ${o.nat}` : ''}</span>
              </div>
            ))}
            <div style={{ marginTop: 8 }}>
              <a className="iublink small" href="https://info.ur.gov.lv/#/data-search/legal-entity" target="_blank" rel="noopener noreferrer">Pārbaudīt Uzņēmumu reģistrā (meklē pēc reģ. nr. {w.winnerId}) →</a>
            </div>
          </div>
        </>
      )}

      {w.officers && w.officers.length > 0 && (
        <>
          <h3 className="section-title">Valde un pārstāvēttiesīgās personas</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>Valdes locekļi un citas pārstāvēttiesīgās amatpersonas (Uzņēmumu reģistra atvērtie dati).</p>
            {w.officers.map((o, i) => (
              <div key={i} className="plg-owner">
                <span className="plg-av">{(o.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('')}</span>
                <span style={{ flex: 1 }}>{o.name} <span className="muted small">· {roleLabel(o.role)}</span></span>
                <span className="muted small mono">{o.id}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {w.relatedWinners && w.relatedWinners.length > 0 && (
        <>
          <h3 className="section-title">Saistītie uzņēmumi — kopīga persona</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>Citi uzvarētāji, kuriem ir kopīga persona (patiesā labuma guvējs vai valdes loceklis) ar šo uzņēmumu. Tie var darboties tirgū kā atsevišķi pretendenti. Karogs nav pierādījums — tā ir norāde iespējamai saiknei.</p>
            {w.relatedWinners.map((r, i) => (
              <a key={i} className="flow-row clickable" href={r.fileId ? `#/winner/${encodeURIComponent(r.fileId)}` : undefined} style={{ display: 'block' }}>
                <div className="flow-top"><span className="flow-name">{r.name ?? '?'}{r.fileId ? <span className="muted"> →</span> : null}</span><strong className="mono small">{eur(r.value)}</strong></div>
                <div className="muted small mono">{r.contracts} līg. · caur {r.via}{r.role ? ` (${roleLabel(r.role)})` : ''}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {w.financials && (
        <>
          <h3 className="section-title">Finanšu dati (gada pārskats {w.financials.year})</h3>
          <div className="card">
            {w.lowCapacity && <div className="note-tag note-high" style={{ margin: '0 0 8px', display: 'inline-block' }}>ļoti maz resursu lieliem līgumiem</div>}
            <div className="kv"><span>Neto apgrozījums</span><span className="mono">{w.financials.turnover != null ? eur(w.financials.turnover) : '–'}</span></div>
            <div className="kv"><span>Vidējais darbinieku skaits</span><span className="mono">{w.financials.employees != null ? w.financials.employees : '–'}</span></div>
            <div className="kv"><span>Peļņa / zaudējumi</span><span className="mono">{w.financials.profit != null ? eur(w.financials.profit) : '–'}</span></div>
            {w.lowCapacity && <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>Kapitālsabiedrība ar ļoti maz darbiniekiem ({w.financials.employees}) un mikro apgrozījumu, kas ieguvusi ≥€500&nbsp;000 līgumus. Iespējama frontes vai pass-through firma — taču tas var nozīmēt arī nesen iegūtu ietvara līgumu vai apakšuzņēmēju modeli. Karogs nav pierādījums.</p>}
            <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>Avots: VID gada pārskati (UR atvērtie dati). Apgrozījums ir gada, līgumu vērtība — par visu periodu, tāpēc tie nav tieši salīdzināmi.</p>
          </div>
        </>
      )}

      {w.capacityGap && (
        <>
          <h3 className="section-title">Kapacitātes plaisa</h3>
          <div className="card">
            <div className="note-tag note-high" style={{ margin: '0 0 8px', display: 'inline-block' }}>uzvar vairāk, nekā liecina apgrozījums vai darbinieku skaits</div>
            <div className="kv"><span>Uzvarēto līgumu kopvērtība</span><span className="mono">{eur(w.capacityGap.value)}</span></div>
            {w.capacityGap.turnover != null && <div className="kv"><span>Gada apgrozījums ({w.capacityGap.year})</span><span className="mono">{eur(w.capacityGap.turnover)}</span></div>}
            {w.capacityGap.ratio != null && <div className="kv"><span>Līgumi pret apgrozījumu</span><span className="mono" style={{ color: 'var(--red-ink)' }}>{w.capacityGap.ratio}×</span></div>}
            {w.capacityGap.employees != null && <div className="kv"><span>Darbinieku skaits</span><span className="mono">{w.capacityGap.employees}</span></div>}
            {w.capacityGap.perEmployee != null && <div className="kv"><span>Vērtība uz darbinieku</span><span className="mono">{eur(w.capacityGap.perEmployee)}</span></div>}
            <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
              Kad firma uzvar līgumus, kuru vērtība daudzkārt pārsniedz tās apgrozījumu vai ko tik maz darbinieku objektīvi spētu izpildīt, tā var būt starpnieks vai «pass-through» firma. Taču tam var būt arī likumīgs izskaidrojums — liela uzņēmumu grupa, jauns meitasuzņēmums vai apakšuzņēmēju modelis. <strong>Karogs nav pierādījums.</strong>
            </p>
          </div>
        </>
      )}

      {w.vidDebtor && (
        <>
          <h3 className="section-title">VID nodokļu parāds</h3>
          <div className="card">
            <div className="note-tag note-high" style={{ margin: '0 0 8px', display: 'inline-block' }}>publicēts VID parādnieku sarakstā</div>
            <div className="kv"><span>Parāda summa</span><span className="mono" style={{ color: 'var(--red-ink)' }}>{eur(w.vidDebtor.amount)}</span></div>
            {w.vidDebtor.asOf && <div className="kv"><span>Dati uz</span><span className="mono">{w.vidDebtor.asOf}</span></div>}
            <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
              Nodokļu parāds virs likumā noteiktā sliekšņa ir Publisko iepirkumu likuma 42. panta izslēgšanas pamats. Avots: {w.vidDebtor.source}. Parāds var būt radies pēc līguma piešķiršanas — tā ir norāde pārbaudei, ne apgalvojums par pārkāpumu.
            </p>
          </div>
        </>
      )}

      {w.cfla && w.cfla.contracts > 0 && (
        <>
          <h3 className="section-title">ES fondu līgumi (CFLA)</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              Šī uzņēmuma līgumi ES fondu līdzfinansētos projektos (CFLA atvērtie dati, 2014–2027). Te ietverti arī
              <strong> zemsliekšņa iepirkumi</strong>, ko IUB paziņojumi nesatur — tāpēc šī ir papildu redzamība pār pārējiem datiem.
            </p>
            <div className="section grid cols-3" style={{ marginTop: 0 }}>
              <div className="card stat"><div className="num">{w.cfla.contracts}</div><div className="lbl">ES fondu līgumi</div></div>
              <div className="card stat"><div className="num">{eur(w.cfla.value)}</div><div className="lbl">Kopvērtība (bez PVN)</div></div>
              <div className="card stat"><div className="num" style={{ color: w.cfla.belowCount >= 3 ? 'var(--red)' : undefined }}>{w.cfla.belowCount}</div><div className="lbl">no tiem zemsliekšņa</div></div>
            </div>
            {w.cfla.funds.length > 0 && (
              <div style={{ margin: '2px 0 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {w.cfla.funds.map((f, i) => <span key={i} className="note-tag">{f.fund}: {eur(f.value)}</span>)}
              </div>
            )}
            {w.cfla.splitSignal && (
              <div className="note-tag note-high" style={{ display: 'block', margin: '4px 0 8px', whiteSpace: 'normal', lineHeight: 1.4 }}>
                {w.cfla.splitSignal}. <span style={{ fontWeight: 400 }}>Karogs nav pierādījums — daudzi zemsliekšņa līgumi var būt arī objektīvi pamatoti; tā ir norāde izpētei.</span>
              </div>
            )}
            {w.cfla.projects.length > 0 && (
              <ul className="member-list">
                {w.cfla.projects.map((p, i) => (
                  <li key={i}>
                    <div className="memrow" style={{ alignItems: 'baseline' }}>
                      <span style={{ flex: 1 }}>{p.name ?? p.project}<span className="muted small mono" style={{ marginLeft: 6 }}>{p.project}</span></span>
                      <span className="muted small mono">{p.count} līg.{p.planned != null ? ` (plānā ${p.planned})` : ''}{p.below > 0 ? ` · ${p.below} zemsliekšņa` : ''} · {eur(p.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small" style={{ margin: '8px 4px 0' }}>
              Avots: CFLA «ES fondu projektu» atvērtie dati (data.gov.lv, CC0). Summas — bez PVN. «plānā N» = projektā plānoto iepirkumu skaits (CFLA iepirkumu plāns).
            </p>
          </div>
        </>
      )}

      {w.cfla && w.cfla.related.length > 0 && (
        <>
          <h3 className="section-title">Saistība caur ES projektiem</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              Citi uzņēmumi, kas saistīti ar šo piegādātāju caur kopīgu ES fondu projektu — kā cits <strong>izpildītājs</strong> tajā pašā
              projektā vai kā reģistrēts <strong>sadarbības partneris</strong>. Kopīgs projekts ir konteksts, ne pārkāpums; karogs nav pierādījums.
            </p>
            {w.cfla.related.map((r, i) => (
              <a key={i} className="flow-row clickable" href={r.fileId ? `#/winner/${encodeURIComponent(r.fileId)}` : undefined} style={{ display: 'block' }}>
                <div className="flow-top"><span className="flow-name">{r.name ?? r.reg}{r.fileId ? <span className="muted"> →</span> : null}</span><span className="note-tag">{r.relation}</span></div>
                <div className="muted small">{r.projectName ?? r.project}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {w.coBidders && w.coBidders.length > 0 && (
        <>
          <h3 className="section-title">Kopā-pretendenti</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              Citas firmas, kas <strong>bieži piedalās tajos pašos konkursos</strong> kā šis piegādātājs (no EIS piedāvājumu atvēršanas datiem).
              Kopīga piedalīšanās ir normāla konkurence — <strong>karogs nav pierādījums</strong>. Uzmanību pelna <strong>saistīti</strong> pretendenti
              (sarkanā krāsā): firmas ar kopīgu īpašnieku vai holdinga struktūru, kas konkursos uzstājas kā konkurenti — tā var būt fiktīva konkurence
              (sk. «Karteļa pazīmes»).
            </p>
            <StarNet centerName={w.winnerName} others={w.coBidders} />
            <ul className="member-list" style={{ marginTop: 10 }}>
              {w.coBidders.map((o, i) => {
                const inner = (
                  <>
                    <span style={{ flex: 1 }}>{o.name ?? o.reg}
                      {o.related && <span className="note-tag note-high" style={{ marginLeft: 6 }}>saistīts — {o.related === 'persona' ? 'kopīga persona' : 'kopīgs holdings'}</span>}
                    </span>
                    <span className="muted small mono" style={{ whiteSpace: 'nowrap' }}>{o.coBids} kopā · uzvaras {o.weWon}:{o.theyWon}{o.fileId && <span className="iublink small" style={{ marginLeft: 6 }}>→</span>}</span>
                  </>
                );
                return <li key={i}>{o.fileId ? <a className="memrow clickable" href={`#/winner/${encodeURIComponent(o.fileId)}`}>{inner}</a> : <div className="memrow">{inner}</div>}</li>;
              })}
            </ul>
          </div>
        </>
      )}

      {w.ownership && (w.ownership.owners.length > 0 || w.ownership.ultimate.length > 0) && (
        <>
          <h3 className="section-title">Īpašnieki un holdinga struktūra</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>SIA dalībnieki (kapitāldaļu turētāji) no Uzņēmumu reģistra atvērtajiem datiem. Ja dalībnieks ir cits uzņēmums, redzama holdinga ķēde.</p>
            {w.ownership.owners.length > 0 && (
              <div className="member-list">
                {w.ownership.owners.map((o, i) => (
                  <div key={i} className="plg-owner">
                    <span style={{ flex: 1 }}>{o.name}{o.kind === 'foreign' ? ' (ārvalstu uzņēmums)' : o.kind === 'person' ? '' : ''}</span>
                    <strong className="mono small">{o.sharePct}%</strong>
                  </div>
                ))}
              </div>
            )}
            {w.ownership.ultimate.length > 0 && (
              <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
                Galējais īpašnieks-uzņēmums (holdinga augšgals): <strong>{w.ownership.ultimate.map((u) => u.name).join(', ')}</strong>
              </p>
            )}
          </div>
        </>
      )}

      {w.ownership && w.ownership.siblings.length > 0 && (
        <>
          <h3 className="section-title">Saistīti caur kopīgu īpašnieku-uzņēmumu</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>Citi uzvarētāji, kas pieder tam pašam holdingam (kopīgs mātes uzņēmums īpašuma ķēdē). Tie var darboties tirgū kā atsevišķi pretendenti. Karogs nav pierādījums — tā ir norāde iespējamai saiknei.</p>
            {w.ownership.siblings.map((s, i) => (
              <a key={i} className="flow-row clickable" href={s.fileId ? `#/winner/${encodeURIComponent(s.fileId)}` : undefined} style={{ display: 'block' }}>
                <div className="flow-top"><span className="flow-name">{s.name ?? '?'}{s.fileId ? <span className="muted"> →</span> : null}</span></div>
                <div className="muted small">caur {s.via}</div>
              </a>
            ))}
          </div>
        </>
      )}

      {w.sameAddress && w.sameAddress.winners.length > 0 && (
        <>
          <h3 className="section-title">Kopīga juridiskā adrese</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>
              Citi uzvarētāji, kas reģistrēti tajā pašā adresē{w.sameAddress.address ? ` (${w.sameAddress.address})` : ''}.
              Šajā adresē kopā reģistrētas <strong>{w.sameAddress.addrTotal} firmas</strong>{w.sameAddress.addrTotal > 15 ? ' — iespējams biroju centrs, tāpēc saikne var būt nejauša' : ''}. Vājāks signāls nekā īpašums; karogs nav pierādījums.
            </p>
            {w.sameAddress.winners.map((s, i) => (
              <a key={i} className="flow-row clickable" href={s.fileId ? `#/winner/${encodeURIComponent(s.fileId)}` : undefined} style={{ display: 'block' }}>
                <div className="flow-top"><span className="flow-name">{s.name ?? '?'}{s.fileId ? <span className="muted"> →</span> : null}</span></div>
              </a>
            ))}
          </div>
        </>
      )}

      <h3 className="section-title">Līgumi pa pasūtītājiem ({w.byBuyer.length})</h3>
      <div className="card">
        {w.byBuyer.map((g) => (
          <div className="lot" key={g.buyerId}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-link" style={{ textAlign: 'left', fontWeight: 600 }} onClick={() => onSelectBuyer(g.buyerId)}>{g.buyerName ?? g.buyerId} →</button>
              <span className="mono small">{g.contracts} līg. · {eur(g.value)}{g.singleBid > 0 ? ` · ${g.singleBid} ar 1 pretendentu` : ''}</span>
            </div>
            <ul className="member-list">
              {g.lots.slice(0, 30).map((l) => {
                const val = l.value != null
                  ? <span className="mono">{eur(l.value)}</span>
                  : <span className="mono" title="IUB atvērtajos datos šim līgumam nav norādīta vērtība">–<sup>*</sup></span>;
                const meta = <span className="muted small">{l.subjectName ? `${l.subjectName} · ` : ''}{l.date ?? ''}{l.singleBid ? ' · 1 pretendents' : l.receivedBids ? ` · ${l.receivedBids} piedāv.` : ''}</span>;
                return (
                  <li key={l.lotId}>
                    {l.sourceUrl ? (
                      <a className="memrow" href={l.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {val}{meta}<span className="iublink small" style={{ marginLeft: 'auto' }}>Skatīt →</span>
                      </a>
                    ) : (
                      <div className="memrow">
                        {val}{meta}<span className="muted small" style={{ marginLeft: 'auto' }} title="IUB atvērtajos datos šim ierakstam nav tiešās saites uz konkrēto iepirkumu">IUB nav saites*</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="muted small" style={{ margin: '10px 4px 0' }}>
          <strong>*</strong> IUB datu robs — šim ierakstam IUB atvērtajos datos nav norādīta vērtība (–*) vai nav tiešās saites uz iepirkumu (IUB nav saites*). Tā nav mūsu kļūda; saiti rādām tikai tad, ja IUB sniedz strādājošu tiešo saiti.
        </p>
      </div>

      <div className="section"><Disclaimer /></div>
    </div>
  );
}
