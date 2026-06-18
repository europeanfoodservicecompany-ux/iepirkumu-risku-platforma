import type { BuyerDetail, RiskResult, ActiveTender } from '../types.ts';
import { buyerBand, buyerSummary, b2Summary, aSummary, cSummary, eSummary, dSummary, pct, fmtRatio, eur, downloadCsv } from '../format.ts';
import { RiskBadge } from './RiskBadge.tsx';
import { RiskBreakdown } from './RiskBreakdown.tsx';
import { Disclaimer } from './Disclaimer.tsx';

const barColor: Record<string, string> = {
  red: 'var(--red)', yellow: 'var(--yellow)', green: 'var(--green)', gray: 'var(--gray)',
};

// Grupē kopas līgumus pa uzvarētājiem (salami pazīme = daudzi vienam piegādātājam).
function groupByWinner(members: { id: string; value: number | null; date: string | null; winnerId: string | null; winnerName: string | null; sourceUrl: string | null }[]) {
  const m = new Map<string, { name: string; sum: number; items: typeof members }>();
  for (const x of members) {
    const key = x.winnerId ?? x.winnerName ?? '—';
    const g = m.get(key) ?? { name: x.winnerName ?? x.winnerId ?? 'Nezināms', sum: 0, items: [] };
    g.sum += x.value ?? 0; g.items.push(x); m.set(key, g);
  }
  return [...m.values()].sort((a, b) => b.sum - a.sum);
}


function ScoreBar({ r }: { r: RiskResult }) {
  if (r.score === null) return null;
  const band = buyerBand(r);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="bar"><span style={{ width: `${r.score}%`, background: barColor[band.key] }} /></div>
      <div className="muted small" style={{ marginTop: 4 }}>0 — zems · 30 — dzeltens · 70 — sarkans</div>
    </div>
  );
}

export function BuyerProfile({ buyer, nationalSingleBidRate, activeTenders = [] }: {
  buyer: BuyerDetail; nationalSingleBidRate: number; activeTenders?: ActiveTender[];
}) {
  const r = buyer.result;       // B1
  const b2 = buyer.b2;          // B2
  const d = r.detail ?? {};
  const cd = b2.detail ?? {};
  const aRes = buyer.a;
  const clusters = aRes.detail?.clusters ?? [];
  const cRes = buyer.c;
  const priceFlags = cRes.detail?.priceFlags ?? [];
  const eRes = buyer.e;
  const dRes = buyer.d;
  const newWinners = dRes.detail?.newWinners ?? [];
  const openUrl = (url?: string | null) => { if (url) window.open(url, '_blank', 'noopener'); };

  function exportFlagged() {
    const rows: (string | number | null)[][] = [];
    for (const l of buyer.flaggedLots) rows.push(['B1 viens pretendents', `daļa ${l.lotId}`, '', '', '', `saņemts ${l.detail?.receivedBids ?? '?'} piedāvājums`, l.detail?.sourceUrl ?? '']);
    for (const c of (aRes.detail?.clusters ?? [])) for (const m of c.members) rows.push(['A sadalīšana', `CPV ${c.cpv4}`, m.value ?? '', m.date ?? '', m.winnerName ?? m.winnerId ?? '', `kopa €${c.sum} (${c.sumRatio}× slieksnis)`, m.sourceUrl ?? '']);
    for (const p of priceFlags) rows.push(['C vērtības novirze', `CPV ${(p.cpv ?? '').slice(0, 8)}`, p.value, '', '', `z=${p.z} (n=${p.obs})`, p.sourceUrl ?? '']);
    for (const w of newWinners) rows.push(['D jauns uzvarētājs', `daļa ${w.lotId}`, w.value ?? '', w.registered, w.winnerName ?? w.winnerId ?? '', `${w.ageMonths} mēn. vecs`, w.sourceUrl ?? '']);
    const safe = (buyer.buyerName ?? buyer.buyerId).replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
    downloadCsv(`karogotie_${safe}.csv`, ['Indikators', 'Iepirkums', 'Summa EUR', 'Datums', 'Uzvarētājs', 'Detaļa', 'IUB saite'], rows);
  }
  const nat = nationalSingleBidRate;
  const combKey = (buyer.combinedLevel ?? 'gray') as 'red' | 'yellow' | 'green' | 'gray';
  const combLabel = { red: 'Augsts risks', yellow: 'Vērts pārbaudīt', green: 'Zems', gray: 'Nepietiek datu' }[combKey];

  return (
    <div>
      <div className="card">
        <div className="profile-head">
          <div>
            <h2>{buyer.buyerName ?? buyer.buyerId}</h2>
            <div className="muted small mono">Reģ. nr. {buyer.buyerId}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><RiskBadge band={combKey} label={combLabel} /><button className="filter-btn" onClick={exportFlagged}>⬇ Karogotie CSV</button></div>
          </div>
          <div className="bigscore">
            <div
              className="ring"
              style={{ background: `conic-gradient(${barColor[combKey]} ${(buyer.combinedScore ?? 0) * 3.6}deg, var(--ring-track) 0)` }}
            >
              <div className="ring-inner">
                <span className="n" style={{ color: barColor[combKey] }}>{buyer.combinedScore ?? '–'}</span>
                <span className="ring-max">/100</span>
              </div>
            </div>
            <div className="l">Kopējais risks</div>
          </div>
        </div>
      </div>

      <h3 className="section-title">Riska sadalījums pa indikatoriem</h3>
      <div className="card">
        <RiskBreakdown buyer={buyer} />
        <div className="muted small" style={{ marginTop: 12 }}>
          Kopējais risks ir svērta indikatoru kombinācija (B 30%, A 25%, C 20%, D 15%, E 10%).
          Augstu risku rada vairāku signālu sakritība, ne viens atsevišķs rādītājs.
        </div>
      </div>

      {activeTenders.length > 0 && (
        <>
          <h3 className="section-title">Aktuālie konkursi ({activeTenders.length})</h3>
          <div className="card">
            <p className="muted small" style={{ marginTop: 0 }}>Šobrīd atvērti šī pasūtītāja iepirkumi (termiņš vēl nav pagājis).</p>
            {activeTenders.map((t) => (
              <div className={`lot ${t.sourceUrl ? 'row-link' : ''}`} key={t.id} onClick={() => openUrl(t.sourceUrl)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span className="small" style={{ flex: 1 }}>{t.name ?? '—'}</span>
                  {t.sourceUrl && <a className="iublink small" href={t.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Skatīt →</a>}
                </div>
                <div className="why">Termiņš {t.deadline}{t.deadlineTime ? ` ${t.deadlineTime}` : ''} · CPV {(t.cpv ?? '').slice(0, 8)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── B1 — Konkurence ── */}
      <h3 className="section-title">B1 · Viena pretendenta īpatsvars (slānis B)</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>{buyerSummary(r, nat)}</p>
        <div className="kv"><span>Viena pretendenta īpatsvars</span>
          <strong className="mono">{r.score === null ? 'nepietiek datu' : pct(d.singleBidRate, 1)}</strong></div>
        <div className="kv"><span>Nacionālais vidējais</span><span className="mono">{pct(nat, 1)}</span></div>
        <div className="kv"><span>Attiecība pret vidējo</span><span className="mono">{fmtRatio(d.relativeRatio)}</span></div>
        <div className="kv"><span>Iepirkumi ar izvēlētu uzvarētāju</span><span className="mono">{d.winnerChosenLots ?? 0}</span></div>
        <div className="kv"><span>No tiem ar vienu pretendentu</span><span className="mono">{d.singleBidLots ?? 0}</span></div>
        <ScoreBar r={r} />
      </div>

      {/* ── B2 — Uzvarētāju koncentrācija ── */}
      <h3 className="section-title">B2 · Uzvarētāju koncentrācija (slānis B)</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>{b2Summary(b2)}</p>
        <div className="kv"><span>Lielākā uzvarētāja daļa</span>
          <strong className="mono">{b2.score === null ? 'nepietiek datu' : pct(cd.topWinnerShare, 1)}</strong></div>
        <div className="kv"><span>Lielākais uzvarētājs</span><span>{cd.topWinnerName ?? '–'}</span></div>
        <div className="kv"><span>Koncentrācijas indekss (HHI)</span><span className="mono">{cd.hhi ?? '–'}</span></div>
        <div className="kv"><span>Atšķirīgu uzvarētāju skaits</span><span className="mono">{cd.distinctWinners ?? '–'}</span></div>
        <div className="kv"><span>Piešķirti līgumi</span><span className="mono">{cd.awardedLots ?? 0}</span></div>
        <div className="kv"><span>Aprēķina bāze</span><span>{cd.basis === 'value' ? 'līgumvērtība' : cd.basis === 'count' ? 'līgumu skaits' : '–'}</span></div>
        <ScoreBar r={b2} />
      </div>

      {/* ── A — Iepirkumu sadalīšana ── */}
      <h3 className="section-title">A · Iepirkumu sadalīšana (slānis A)</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>{aSummary(aRes)}</p>
        {clusters.length === 0 && <p className="muted">Nav atrastu kopu.</p>}
        {clusters.map((c, idx) => (
          <div className="lot" key={idx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <RiskBadge band={c.level === 'red' ? 'red' : 'yellow'} label={c.level === 'red' ? 'Sarkans' : 'Dzeltens'} />
                <span className="muted small mono" style={{ marginLeft: 8 }}>CPV {c.cpv4}*</span>
              </div>
              <span className="mono small">{c.count} līgumi · {eur(c.sum)} ({c.sumRatio}× slieksnis)</span>
            </div>
            <div className="why">
              {c.count} tuvu-slieksnim līgumi vienā CPV grupā no {c.from} līdz {c.to}, kopā {eur(c.sum)} —
              pārsniedz {eur(c.threshold)} procedūras slieksni{c.sameWinner ? '; visi vienam uzvarētājam' : ''}.
            </div>
            <div className="member-groups">
              {groupByWinner(c.members).map((g, gi) => (
                <div className="wgroup" key={gi}>
                  <div className="wgroup-head">
                    <span className="small">{g.name}</span>
                    <span className="muted small mono">{g.items.length} līg. · {eur(g.sum)}</span>
                  </div>
                  <ul className="member-list">
                    {g.items.map((m) => (
                      <li key={m.id} className={m.sourceUrl ? 'row-link' : undefined} onClick={() => openUrl(m.sourceUrl)}>
                        <span className="mono">{eur(m.value)}</span>
                        <span className="muted small">{m.date}</span>
                        {m.sourceUrl && <a className="iublink small" href={m.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ marginLeft: 'auto' }}>Skatīt →</a>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── C — Cenu/vērtības novirze ── */}
      <h3 className="section-title">C · Cenu/vērtības novirze (slānis C)</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>{cSummary(cRes)}</p>
        <div className="disclaimer" style={{ marginBottom: 12 }}>
          <strong>Piezīme:</strong> dati satur līgumu kopsummas, ne vienības cenas. Augsta vērtība var
          nozīmēt pārmaksu <em>vai</em> vienkārši lielāku iepirkumu — tā ir tikai norāde pārbaudei.
        </div>
        {priceFlags.length === 0 && <p className="muted">Nav vērtības izlēcēju.</p>}
        {priceFlags.map((p) => (
          <div className={`lot ${p.sourceUrl ? 'row-link' : ''}`} key={p.lotId} onClick={() => openUrl(p.sourceUrl)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <RiskBadge band={p.z >= 2 ? 'red' : 'yellow'} label={`z = ${p.z}`} />
                <span className="muted small mono" style={{ marginLeft: 8 }}>CPV {(p.cpv ?? '').slice(0, 8)}</span>
              </div>
              {p.sourceUrl && <a className="iublink" href={p.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Skatīt iepirkumu →</a>}
            </div>
            <div className="why">
              Līgumvērtība {eur(p.value)} — par {p.z} standartnovirzēm virs vidējā šajā CPV kategorijā
              (salīdzināts ar {p.obs} līdzīgiem līgumiem).
            </div>
          </div>
        ))}
      </div>

      {/* ── E — Procedūras integritāte ── */}
      <h3 className="section-title">E · Procedūras integritāte (slānis E)</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>{eSummary(eRes)}</p>
        <div className="kv"><span>Sarunu procedūras bez konkurences</span>
          <strong className="mono">{eRes.status === 'NoData' ? 'nepietiek datu' : (eRes.detail?.nonCompetitiveLots ?? 0)}</strong></div>
        <div className="kv"><span>Īpatsvars no visiem iepirkumiem</span><span className="mono">{eRes.status === 'NoData' ? '–' : pct(eRes.detail?.nonCompetitiveShare, 1)}</span></div>
      </div>

      {/* ── D — Saistītās puses ── */}
      <h3 className="section-title">D · Saistītās puses / jauni uzvarētāji (slānis D)</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>{dSummary(dRes)}</p>
        <div className="muted small" style={{ marginBottom: newWinners.length ? 12 : 0 }}>
          Avots: Uzņēmumu reģistra atvērtie dati (reģistrācijas datumi).
        </div>
        {newWinners.map((w) => (
          <div className={`lot ${w.sourceUrl ? 'row-link' : ''}`} key={w.lotId} onClick={() => openUrl(w.sourceUrl)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <RiskBadge band={w.veryNew ? 'red' : 'yellow'} label={`${w.ageMonths} mēn. vecs`} />
                <span className="small" style={{ marginLeft: 8 }}>{w.winnerName ?? w.winnerId}</span>
              </div>
              {w.sourceUrl && <a className="iublink" href={w.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Skatīt iepirkumu →</a>}
            </div>
            <div className="why">
              Uzvarētājs reģistrēts {w.registered} — tikai {w.ageMonths} mēnešus pirms līguma iegūšanas
              {w.value != null ? ` (līgums ${eur(w.value)})` : ''}. Nesen dibināts uzņēmums, kas uzreiz iegūst līgumu, ir saistīto pušu riska signāls.
            </div>
          </div>
        ))}
      </div>

      {/* ── Karogotie iepirkumi (B1) ── */}
      <h3 className="section-title">Karogotie iepirkumi ({buyer.flaggedLots.length})</h3>
      <div className="card">
        {buyer.flaggedLots.length === 0 && <p className="muted">Nav karogotu iepirkumu šajā datu periodā.</p>}
        {buyer.flaggedLots.map((lot) => (
          <div className={`lot ${lot.detail?.sourceUrl ? 'row-link' : ''}`} key={lot.lotId} onClick={() => openUrl(lot.detail?.sourceUrl)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <RiskBadge band={lot.level === 'red' ? 'red' : 'yellow'} label={lot.level === 'red' ? 'Sarkans' : 'Dzeltens'} />
                <span className="muted small mono" style={{ marginLeft: 8 }}>daļa {lot.lotId}</span>
              </div>
              {lot.detail?.sourceUrl && (
                <a className="iublink" href={lot.detail.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Skatīt iepirkumu →</a>
              )}
            </div>
            <div className="why">
              Saņemts {lot.detail?.receivedBids ?? '?'} piedāvājums — konkurences trūkums. Atsevišķs viens
              pretendents ir dzeltens karogs; sarkans iedegtos kombinācijā ar citu signālu.
            </div>
          </div>
        ))}
      </div>

      <div className="section"><Disclaimer /></div>
    </div>
  );
}
