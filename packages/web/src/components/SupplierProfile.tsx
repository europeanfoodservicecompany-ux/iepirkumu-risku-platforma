import type { WinnerDetail } from '../types.ts';
import { eur, pct, downloadCsv } from '../format.ts';
import { Disclaimer } from './Disclaimer.tsx';

const ROLE: Record<string, string> = { PLG: 'patiesā labuma guvējs', valde: 'valdes loceklis', 'prokūrists': 'prokūrists', likvidators: 'likvidators', amatpersona: 'amatpersona' };
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
              {sbHigh && <span className="badge red"><span className="dot" aria-hidden="true" />Bieži vienīgais pretendents</span>}
              {depHigh && <span className="badge red"><span className="dot" aria-hidden="true" />Atkarīgs no 1 pasūtītāja</span>}
              <button className="filter-btn" onClick={exportCsv}>⬇ Līgumi CSV</button>
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
            <p className="muted small" style={{ marginTop: 0 }}>Valdes locekļi, prokūristi un citas pārstāvēttiesīgās amatpersonas (Uzņēmumu reģistra atvērtie dati).</p>
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
            <p className="muted small" style={{ marginTop: 0 }}>Citi uzvarētāji, kuriem ir kopīga persona (patiesā labuma guvējs, valdes loceklis vai prokūrists) ar šo uzņēmumu. Tie var darboties tirgū kā atsevišķi pretendenti. Karogs nav pierādījums — tā ir norāde iespējamai saiknei.</p>
            {w.relatedWinners.map((r, i) => (
              <a key={i} className="flow-row clickable" href={r.fileId ? `#/winner/${encodeURIComponent(r.fileId)}` : undefined} style={{ display: 'block' }}>
                <div className="flow-top"><span className="flow-name">{r.name ?? '?'}{r.fileId ? <span className="muted"> →</span> : null}</span><strong className="mono small">{eur(r.value)}</strong></div>
                <div className="muted small mono">{r.contracts} līg. · caur {r.via}{r.role ? ` (${roleLabel(r.role)})` : ''}</div>
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
                const meta = <span className="muted small">{l.date ?? ''}{l.singleBid ? ' · 1 pretendents' : l.receivedBids ? ` · ${l.receivedBids} piedāv.` : ''}</span>;
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
