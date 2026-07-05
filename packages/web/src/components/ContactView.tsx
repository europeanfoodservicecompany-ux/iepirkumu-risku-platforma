import { useMemo, useState } from 'react';
import type { ContactsData } from '../types.ts';
import { eur, norm } from '../format.ts';

const PAGE = 25;
type SortKey = 'signals' | 'procurements' | 'singleBid' | 'topWinner' | 'value';
const LVL_RANK = { high: 2, med: 1 } as Record<string, number>;

// Iepirkumu kontaktpersonu meklēšana + procesa signāli:
// vai vienas personas vadītajos iepirkumos dominē viens/saistīts uzvarētājs vai viens pretendents.
export function ContactView({ data, onSelectWinner }: { data: ContactsData; onSelectWinner: (fileId: string) => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('signals');
  const [minProc, setMinProc] = useState(1);
  const [onlySignals, setOnlySignals] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [openProc, setOpenProc] = useState<string | null>(null);
  const term = norm(query.trim());

  const rows = useMemo(() => {
    const min = term ? 1 : minProc;
    const f = data.contacts.filter((c) =>
      (!term || norm(c.name).includes(term) || norm(c.organization ?? '').includes(term))
      && c.procurements >= min
      && (!onlySignals || c.signals.length > 0));
    f.sort((a, b) => {
      if (sort === 'signals') return (LVL_RANK[b.level ?? ''] ?? 0) - (LVL_RANK[a.level ?? ''] ?? 0) || b.procurements - a.procurements;
      if (sort === 'procurements') return b.procurements - a.procurements;
      if (sort === 'singleBid') return b.singleBidRate - a.singleBidRate;
      if (sort === 'topWinner') return b.topWinnerShare - a.topWinnerShare;
      return b.value - a.value;
    });
    return f;
  }, [data, term, sort, minProc, onlySignals]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Iepirkumu kontaktpersonas</h2>
      <p className="muted small" style={{ maxWidth: 760, marginTop: 0 }}>
        Paziņojumā norādītā kontaktpersona (no IUB e-veidlapas). Šeit var meklēt, vai vienas personas vadītajos
        iepirkumos atkārtoti uzvar viens un tas pats vai ar to saistīts pretendents, vai dominē viens pretendents.
        <strong> Karogs nav pārkāpuma pierādījums</strong> — sakritība pēc vārda var būt nejauša; tā ir norāde izpētei.
      </p>

      <div className="card" style={{ marginBottom: 14 }}>
        <input className="search-input" placeholder="Meklēt kontaktpersonu pēc vārda vai iestādes…"
          value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <label className="muted small">Kārtot:
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ marginLeft: 6 }}>
              <option value="signals">pēc signāliem</option>
              <option value="procurements">pēc iepirkumu skaita</option>
              <option value="singleBid">pēc viena pretendenta likmes</option>
              <option value="topWinner">pēc viena uzvarētāja īpatsvara</option>
              <option value="value">pēc vērtības</option>
            </select>
          </label>
          <label className="muted small">Min. iepirkumi:
            <select value={minProc} onChange={(e) => { setMinProc(Number(e.target.value)); setLimit(PAGE); }} style={{ marginLeft: 6 }}>
              <option value={1}>≥1</option><option value={2}>≥2</option><option value={5}>≥5</option><option value={10}>≥10</option>
            </select>
          </label>
          <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={onlySignals} onChange={(e) => { setOnlySignals(e.target.checked); setLimit(PAGE); }} />
            tikai ar signāliem
          </label>
        </div>
      </div>

      <div className="muted small" style={{ margin: '0 4px 8px' }}>{rows.length} kontaktpersonas</div>

      {rows.slice(0, limit).map((c, i) => {
        const id = c.name + '|' + (c.organization ?? '') + i;
        const isOpen = open === id;
        return (
          <div className="card" key={id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', cursor: 'pointer' }}
              onClick={() => setOpen(isOpen ? null : id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : id); } }}>
              <div>
                <span style={{ fontWeight: 600 }}>{isOpen ? '▾ ' : '▸ '}{c.name}</span>
                {c.organization && <span className="muted small" style={{ marginLeft: 8 }}>{c.organization}</span>}
              </div>
              <div className="muted small">{c.procurements} iep.{c.callOffs > c.procurements ? ` · ${c.callOffs} līgumi` : ''} · {eur(c.value)} · {c.distinctWinners} uzvarētāji</div>
            </div>
            {c.signals.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {c.signals.map((s, k) => <span key={k} className="note-tag note-high" style={{ margin: '0 6px 0 0' }}>{s}</span>)}
              </div>
            )}
            <div className="muted small" style={{ marginTop: 6 }}>
              Viena pretendenta likme: {Math.round(c.singleBidRate * 100)}% · lielākais uzvarētājs: {Math.round(c.topWinnerShare * 100)}%
            </div>
            {!isOpen && (
              <div className="iublink small" style={{ marginTop: 6, cursor: 'pointer', display: 'inline-block' }}
                onClick={() => setOpen(id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(id); } }}>
                ▸ Skatīt {c.procurements} iepirkumus un saites
              </div>
            )}
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                <div className="muted small" style={{ marginBottom: 4 }}>Uzvarētāji:</div>
                <ul className="member-list">
                  {c.winners.map((w, k) => (
                    <li key={k}>
                      {w.fileId
                        ? <a className="memrow clickable" onClick={() => onSelectWinner(w.fileId!)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onSelectWinner(w.fileId!); }}><span>{w.name}</span><span className="muted small">{w.contracts} līg. · {eur(w.value)}</span></a>
                        : <div className="memrow"><span>{w.name}</span><span className="muted small">{w.contracts} līg. · {eur(w.value)}</span></div>}
                    </li>
                  ))}
                </ul>
                <div className="muted small" style={{ margin: '10px 0 4px' }}>Iepirkumi ({c.procurements}):</div>
                <ul className="member-list">
                  {c.procs.map((p, k) => {
                    const pid = id + '#' + k;
                    const pOpen = openProc === pid;
                    const framework = p.callOffs > 1;
                    return (
                      <li key={k}>
                        <div className="memrow" style={{ alignItems: 'baseline' }}>
                          <span>{p.subjectName ?? '(bez nosaukuma)'}{framework && <span className="note-tag" style={{ marginLeft: 6 }}>{p.callOffs} izsaukumi</span>}</span>
                          <span className="muted small">{p.winnerName ?? '—'}{p.singleBid ? ' · 1 pretendents' : ''} · {eur(p.value)}{p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="iublink small" style={{ marginLeft: 8 }}>Skatīt iepirkumu →</a>}</span>
                        </div>
                        {framework && (
                          <div className="iublink small" style={{ cursor: 'pointer', marginLeft: 12, marginTop: 2 }} role="button" tabIndex={0}
                            onClick={() => setOpenProc(pOpen ? null : pid)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenProc(pOpen ? null : pid); } }}>
                            {pOpen ? '▾' : '▸'} {p.callOffs} izsaukumi (atsevišķi līgumi zem šī iepirkuma)
                          </div>
                        )}
                        {framework && pOpen && (
                          <ul className="member-list" style={{ marginLeft: 12 }}>
                            {p.lots.map((l, j) => (
                              <li key={j}>
                                {l.sourceUrl
                                  ? <a className="memrow" href={l.sourceUrl} target="_blank" rel="noopener noreferrer"><span>{l.subjectName ?? '—'}</span><span className="muted small">{eur(l.value)}{l.singleBid ? ' · 1 pretendents' : ''} · {l.date ?? ''}<span className="iublink small" style={{ marginLeft: 8 }}>Skatīt →</span></span></a>
                                  : <div className="memrow"><span>{l.subjectName ?? '—'}</span><span className="muted small">{eur(l.value)}{l.singleBid ? ' · 1 pretendents' : ''} · {l.date ?? ''}</span></div>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
