import { useEffect, useMemo, useState } from 'react';
import type { CartelIndexData } from '../types.ts';
import { eur, downloadCsv } from '../format.ts';
import { PairNet } from './BidderNet.tsx';

const PAGE = 25;
type Filter = 'all' | 'rotation' | 'cover' | 'related';

// Karteļa pazīmes uz REĀLIEM pretendentu tīkliem (EIS piedāvājumu atvēršanas dati).
// Pretendentu pāri, kas bieži piedalās kopā un ekskluzīvi. Rotācija vs segums. Karogs nav pierādījums.
export function CartelView({ data, onSelectWinner }: { data: CartelIndexData; onSelectWinner: (fileId: string) => void }) {
  const sp0 = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const [filter, setFilter] = useState<Filter>((['all', 'rotation', 'cover', 'related'].includes(sp0.get('f') ?? '') ? sp0.get('f') : 'all') as Filter);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null); // stabils pāra ID, ne indekss (citādi pārlec, mainot filtru)
  const [relLimit, setRelLimit] = useState(15); // "saistīti pretendenti vienā iepirkumā" saraksts

  const rows = useMemo(() => data.pairs.filter((p) =>
    filter === 'all' ? true : filter === 'related' ? p.related : p.type === filter), [data, filter]);

  // Saglabā filtru URL-ā (linkojams skats).
  useEffect(() => {
    if (window.location.hash.split('?')[0] !== '#/cartel') return;
    const target = filter === 'all' ? '#/cartel' : `#/cartel?f=${filter}`;
    if (window.location.hash !== target) history.replaceState(null, '', target);
  }, [filter]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Karteļa pazīmes (pretendentu tīkli)</h2>
      <p className="muted small" style={{ maxWidth: 780, marginTop: 0 }}>
        Balstīts uz <strong>reāliem pretendentiem</strong> (EIS piedāvājumu atvēršanas dati) — kas tiešām piedalījās, ne tikai uzvarētājs.
        Rāda pretendentu pārus, kas bieži piedalās <strong>kopā un ekskluzīvi</strong> (vismaz 5 reizes, ≥50% gadījumu konkursā tikai viņi divi).
        <strong> Karogs nav pierādījums</strong> — visbiežāk tas ir <em>likumīgs divu firmu (duopola) tirgus</em> (piem. bankas, gāze, ūdens),
        kur dabiski ir tikai divi spēlētāji. Aizdomas pastiprina kopīgs īpašnieks vai adrese (atzīme «saistīti»).
      </p>

      <div className="section grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 0, marginBottom: 14 }}>
        <div className="card stat"><div className="num">{data.totals.procurementsWithBidders.toLocaleString('lv-LV')}</div><div className="lbl">Iepirkumi ar pretendentu datiem</div></div>
        <div className="card stat"><div className="num">{data.totals.rotation}</div><div className="lbl">Rotācijas pazīme</div></div>
        <div className="card stat"><div className="num">{data.totals.cover}</div><div className="lbl">Seguma pazīme</div></div>
        <div className="card stat"><div className="num" style={{ color: data.totals.related ? 'var(--red)' : undefined }}>{data.totals.related}</div><div className="lbl">No tiem saistīti (īpašnieks/adrese)</div></div>
      </div>

      {data.relatedInProc && data.relatedInProc.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '4px solid var(--red)' }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>Saistīti pretendenti vienā iepirkumā ({data.totals.relatedProcurements ?? data.relatedInProc.length})</h3>
          <p className="muted small" style={{ marginTop: 0 }}>
            Iepirkumi, kuros <strong>divi vai vairāki pretendenti ir savstarpēji saistīti</strong> — kopīga persona (īpašnieks/valde), holdinga ķēde vai adrese.
            Tā var būt <strong>fiktīva konkurence</strong> (viens “konkurē” pats ar sevi) un ir viens no PIL izslēgšanas pamatiem. <strong>Karogs nav pierādījums</strong> — saistītas firmas var piedalīties arī likumīgi.
          </p>
          <ul className="member-list">
            {data.relatedInProc.slice(0, relLimit).map((r, i) => {
              const kindLabel = (k: string) => k === 'persona' ? 'kopīga persona' : k === 'holdings' ? 'holdinga ķēde' : 'kopīga adrese';
              const NameR = ({ x }: { x: { name: string | null; reg: string; fileId: string | null } }) => x.fileId
                ? <a className="btn-link" onClick={() => onSelectWinner(x.fileId!)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelectWinner(x.fileId!); }}>{x.name ?? x.reg}</a>
                : <span>{x.name ?? x.reg}</span>;
              return (
                <li key={i} style={{ display: 'block', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{r.subject ?? r.buyer ?? '(bez nosaukuma)'}</strong>
                    <span className="mono small" style={{ whiteSpace: 'nowrap' }}>{eur(r.value)}{r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="iublink small" style={{ marginLeft: 6 }}>→</a>}</span>
                  </div>
                  <div className="muted small">{r.buyer ?? ''}{r.date ? ` · ${r.date}` : ''} · {r.bidders} pretendenti</div>
                  {r.pairs.map((p, k) => (
                    <div key={k} className="small" style={{ marginTop: 3 }}>
                      <NameR x={p.a} /> <span className="muted">↔</span> <NameR x={p.b} /> <span className={`note-tag ${p.kind === 'persona' ? 'note-high' : ''}`}>{kindLabel(p.kind)}</span>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
          {relLimit < data.relatedInProc.length && (
            <button className="filter-btn" style={{ marginTop: 8 }} onClick={() => setRelLimit((l) => l + 20)}>Rādīt vairāk ({data.relatedInProc.length - relLimit})</button>
          )}
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: 0 }}>Atkārtoti pretendentu pāri (laikā)</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="muted small">Rādīt:</span>
          {([['all', 'visus'], ['rotation', 'rotācija'], ['cover', 'segums'], ['related', 'saistītie']] as [Filter, string][]).map(([k, lbl]) => (
            <button key={k} className={`filter-btn ${filter === k ? 'active' : ''}`} onClick={() => { setFilter(k); setLimit(PAGE); }}>{lbl}</button>
          ))}
        </div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          <strong>Rotācija</strong> — uzvaras sadalītas līdzsvaroti (firmas it kā mijas). <strong>Segums</strong> — viens vienmēr uzvar,
          otrs piedalās, bet nekad neuzvar (iespējams «seguma» piedāvājums, lai konkurence izskatās reāla).
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 4px 8px' }}>
        <span className="muted small">{rows.length} pāri</span>
        {rows.length > 0 && <button className="filter-btn" style={{ padding: '5px 10px' }} onClick={() => downloadCsv('kartela_pari.csv',
          ['Firma A', 'Firma B', 'Kopā piedalījušies', '% tikai viņi divi', 'Tips', 'Saistīti', 'A uzvaras', 'B uzvaras'],
          rows.map((p) => [p.a.name ?? p.a.reg, p.b.name ?? p.b.reg, p.coBids, Math.round(p.duoShare * 100) + '%', p.type === 'cover' ? 'segums' : 'rotācija', p.related ? 'jā' : 'nē', p.aWins, p.bWins]))}>⬇ CSV</button>}
      </div>

      {rows.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
          {data.totals.procurementsWithBidders > 0 ? (
            <>
              <p style={{ margin: '4px 0', fontWeight: 600 }}>Neviens pāris nesasniedz slieksni.</p>
              <p className="small" style={{ margin: 0 }}>
                No {data.totals.procurementsWithBidders.toLocaleString('lv-LV')} iepirkumiem ar pretendentu datiem neviens pretendentu pāris
                {filter !== 'all' ? ' šajā kategorijā' : ''} nepiedalījās kopā vismaz 5 reizes ar ≥50% ekskluzivitāti. Tas ir <strong>labs</strong> rezultāts — nevis kļūda.
              </p>
            </>
          ) : (
            <p className="small" style={{ margin: 0 }}>Nav pretendentu (EIS) datu, uz kuriem balstīt analīzi.</p>
          )}
        </div>
      )}

      {rows.slice(0, limit).map((p, i) => {
        const Name = ({ x }: { x: { name: string | null; reg: string; fileId: string | null } }) => x.fileId
          ? <a className="btn-link" style={{ fontWeight: 600 }} onClick={() => onSelectWinner(x.fileId!)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelectWinner(x.fileId!); }}>{x.name ?? x.reg}</a>
          : <span style={{ fontWeight: 600 }}>{x.name ?? x.reg}</span>;
        const rowId = `${p.a.reg}|${p.b.reg}`;
        const isOpen = open === rowId;
        const procs = p.procs ?? [];
        return (
          <div className="card" key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div><Name x={p.a} /> <span className="muted">vs</span> <Name x={p.b} /></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className={`note-tag ${p.type === 'cover' ? 'note-high' : ''}`}>{p.type === 'cover' ? 'seguma pazīme' : 'rotācija'}</span>
                {p.related && <span className="note-tag note-high">saistīti (īpašnieks/adrese)</span>}
              </div>
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              Kopā piedalījušies <strong>{p.coBids}</strong> iepirkumos, no tiem <strong>{Math.round(p.duoShare * 100)}%</strong> tikai viņi divi ·
              uzvaras {p.aWins}:{p.bWins}
            </div>
            <div className="iublink small" style={{ marginTop: 8, cursor: 'pointer', display: 'inline-block' }}
              onClick={() => setOpen(isOpen ? null : rowId)} role="button" tabIndex={0} aria-expanded={isOpen}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : rowId); } }}>
              {isOpen ? '▾' : '▸'} Skatīt tīklu un {procs.length >= 50 ? 'visus' : ''} {procs.length} kopīgos iepirkumus
            </div>
            {isOpen && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18, alignItems: 'start' }} className="cartel-expand">
                <div><PairNet pair={p} /></div>
                <div>
                  <div className="muted small" style={{ marginBottom: 6 }}>Kopīgie iepirkumi (kur abi piedalījušies), lielākie pirmie:</div>
                  <ul className="member-list">
                    {procs.map((pr, k) => {
                      const winner = pr.won === 'a' ? p.a.name : pr.won === 'b' ? p.b.name : 'cits';
                      const row = (
                        <>
                          <span style={{ flex: 1 }}>{pr.subject ?? pr.buyer ?? '(bez nosaukuma)'}<span className="muted small" style={{ display: 'block' }}>{pr.buyer ?? ''} · uzvarēja: {winner}{pr.date ? ` · ${pr.date}` : ''}</span></span>
                          <span className="muted small mono" style={{ whiteSpace: 'nowrap', paddingLeft: 8 }}>{eur(pr.value)}{pr.url && <span className="iublink small" style={{ marginLeft: 6 }}>→</span>}</span>
                        </>
                      );
                      return <li key={k}>{pr.url ? <a className="memrow" href={pr.url} target="_blank" rel="noopener noreferrer">{row}</a> : <div className="memrow">{row}</div>}</li>;
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {limit < rows.length && (
        <button className="filter-btn" onClick={() => setLimit(limit + PAGE)} style={{ margin: '6px auto', display: 'block' }}>Rādīt vairāk ({rows.length - limit})</button>
      )}
    </div>
  );
}
