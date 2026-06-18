import { useMemo, useState } from 'react';
import type { IndexBuyer } from '../types.ts';

const matches = (b: IndexBuyer, term: string) => `${b.buyerName ?? ''} ${b.buyerId}`.toLowerCase().includes(term);

export function GlobalSearch({ buyers, query, setQuery, onSelect }: {
  buyers: IndexBuyer[]; query: string; setQuery: (q: string) => void; onSelect: (id: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const term = query.trim().toLowerCase();
  const suggestions = useMemo(
    () => (term.length < 2 ? [] : buyers.filter((b) => matches(b, term)).slice(0, 8)),
    [buyers, term],
  );
  return (
    <div className="global-search">
      <div className="search-box">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input type="search" className="with-icon"
          placeholder="Meklēt pasūtītāju vai pašvaldību pēc nosaukuma vai reģ. numura…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
          aria-label="Meklēt pasūtītāju" autoComplete="off" />
        {focused && suggestions.length > 0 && (
          <ul className="suggest" role="listbox">
            {suggestions.map((b) => (
              <li key={b.buyerId} role="option" onMouseDown={() => { onSelect(b.buyerId); setFocused(false); }}>
                <span className="suggest-name">{b.buyerName ?? b.buyerId}</span>
                <span className="suggest-meta">
                  <span className="muted small mono">{b.buyerId}</span>
                  {b.combinedScore !== null && <span className={`badge ${b.combinedLevel ?? 'gray'}`}><span className="dot" />{b.combinedScore}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
