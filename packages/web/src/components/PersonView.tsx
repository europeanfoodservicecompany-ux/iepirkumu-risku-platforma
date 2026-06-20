import { useMemo, useState } from 'react';
import type { PersonsData } from '../types.ts';
import { eur } from '../format.ts';

const PAGE = 40;
const ROLE: Record<string, string> = { PLG: 'patiesā labuma guvējs', valde: 'valdes loceklis', 'prokūrists': 'prokūrists', likvidators: 'likvidators', amatpersona: 'amatpersona' };
const roleLabel = (r: string) => ROLE[r] ?? r;

export function PersonView({ data, onSelectWinner }: { data: PersonsData; onSelectWinner: (fileId: string) => void }) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const term = query.trim().toLowerCase();

  const rows = useMemo(() => {
    const base = term
      ? data.persons.filter((p) => p.name.toLowerCase().includes(term))
      : data.persons.filter((p) => p.companyCount >= 2);
    return base.slice(0, 600);
  }, [data, term]);
  const shown = rows.slice(0, limit);

  return (
    <div className="card">
      <p className="muted small" style={{ marginTop: 0 }}>
        Meklē pēc personas (patiesā labuma guvēja, valdes locekļa vai prokūrista) un redzi visus ar to saistītos uzvarētājus.
        Avots: Uzņēmumu reģistra atvērtie dati. No personas koda rādīti tikai pirmie 4 cipari. Karogs nav pierādījums.
      </p>
      <div className="controls" style={{ gap: 8 }}>
        <input className="search-input" style={{ flex: '1 1 260px' }} placeholder="Meklēt personu pēc vārda…"
          value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
      </div>
      <p className="muted small">{term ? `${rows.length} atrastas personas` : `Rāda ${rows.length} personas, kas saistītas ar ≥2 uzvarētājiem (meklē, lai atrastu konkrētu personu).`}</p>

      {shown.length === 0 ? (
        <div className="empty">Nav atbilstošu personu. Pamēģini citu vārdu.</div>
      ) : (
        <>
          {shown.map((p, i) => (
            <div className="person-card" key={p.name + p.id + i}>
              <div className="person-head">
                <span className="plg-av">{(p.name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.name} <span className="muted small mono">{p.id}</span></div>
                  <div className="muted small">{p.companyCount} uzņēmumi · {p.roles.map(roleLabel).join(', ')} · ≈ {eur(p.totalValue)}</div>
                </div>
              </div>
              <div className="person-companies">
                {p.companies.map((c, j) => (
                  <a key={j} className="memrow" href={c.fileId ? `#/winner/${encodeURIComponent(c.fileId)}` : undefined}
                    onClick={c.fileId ? (e) => { e.preventDefault(); onSelectWinner(c.fileId!); } : undefined}>
                    <span style={{ flex: 1 }}>{c.name}{c.fileId ? <span className="muted"> →</span> : null}<span className="muted small"> · {roleLabel(c.role)}</span></span>
                    <span className="mono small">{c.contracts} līg. · {eur(c.value)}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
          {limit < rows.length && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="filter-btn" onClick={() => setLimit((l) => l + PAGE)}>Rādīt vairāk ({rows.length - limit})</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
