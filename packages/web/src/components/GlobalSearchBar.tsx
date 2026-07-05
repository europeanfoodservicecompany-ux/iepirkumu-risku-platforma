import { useEffect, useMemo, useRef, useState } from 'react';
import type { IndexBuyer, SearchWinner, SearchPerson } from '../types.ts';
import { norm, queryTokens, tokenMatch } from '../format.ts';

// Viena, vienmēr redzama meklēšana visiem entītiju tipiem (pasūtītāji + piegādātāji + personas).
// Pretendentu/personu indeksus ielādē tikai pēc fokusa (lazy), lai sākotnējā lapa paliek viegla.
export function GlobalSearchBar({ buyers, winners, persons, routeKey, onFocusLoad, onBuyer, onWinner, onPerson }: {
  buyers: IndexBuyer[];
  winners: SearchWinner[] | null;
  persons: SearchPerson[] | null;
  routeKey: string; // mainās, pārejot starp skatiem — notīra meklēšanas lauku, lai vecais teksts nesalīp
  onFocusLoad: () => void;
  onBuyer: (id: string) => void;
  onWinner: (fileId: string) => void;
  onPerson: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1); // aktīvais ieraksts tastatūras navigācijai
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const term = norm(query.trim());

  const tokens = useMemo(() => queryTokens(query), [query]);
  const res = useMemo(() => {
    if (term.length < 2) return { b: [], w: [], p: [], bN: 0, wN: 0, pN: 0 };
    const bAll = buyers.filter((x) => tokenMatch(norm(`${x.buyerName ?? ''} ${x.buyerId}`), tokens));
    const wAll = (winners ?? []).filter((x) => tokenMatch(norm(`${x.winnerName ?? ''} ${x.winnerId}`), tokens));
    const pAll = (persons ?? []).filter((x) => tokenMatch(norm(x.name ?? ''), tokens));
    // Rāda ierobežotu skaitu (kompakts saraksts); pilns skaits header'ā + "rādīt visas" saite personām.
    return { b: bAll.slice(0, 5), w: wAll.slice(0, 5), p: pAll.slice(0, 6), bN: bAll.length, wN: wAll.length, pN: pAll.length };
  }, [buyers, winners, persons, term, tokens]);

  // Plakans ierakstu saraksts (bez grupu virsrakstiem) tastatūras navigācijai.
  const flat = useMemo(() => [
    ...res.b.map((b) => ({ id: `opt-b-${b.buyerId}`, go: () => onBuyer(b.buyerId) })),
    ...res.w.map((w) => ({ id: `opt-w-${w.fileId}`, go: () => onWinner(w.fileId) })),
    ...res.p.map((p) => ({ id: `opt-p-${p.name}`, go: () => onPerson(p.name) })),
  ], [res, onBuyer, onWinner, onPerson]);

  const any = flat.length > 0;
  const open = focused && term.length >= 2;
  const close = () => setTimeout(() => setFocused(false), 150);
  useEffect(() => { setActive(-1); }, [term]); // atiestata izvēli, mainot meklējumu
  useEffect(() => { setQuery(''); setFocused(false); }, [routeKey]); // notīra lauku, pārejot uz citu skatu

  // Dropdown ir position:fixed, lai izkļūtu no galvenes `overflow:hidden` (citādi to apgriež).
  // Pozīciju rēķina no meklēšanas lauka; atjauno pie ritināšanas/izmēra maiņas.
  useEffect(() => {
    if (!open) return;
    const update = () => { const r = boxRef.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, left: r.left, width: r.width }); };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [open]);

  const choose = (go: () => void) => { go(); setFocused(false); setQuery(''); setActive(-1); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !any) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % flat.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? flat.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(flat[active].go); }
    else if (e.key === 'Escape') { setFocused(false); }
  };

  return (
    <div className="global-search">
      <div className="search-box" ref={boxRef}>
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input type="search" className="with-icon"
          placeholder="Meklēt firmu, pasūtītāju vai personu…"
          value={query} onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setFocused(true); onFocusLoad(); }} onBlur={close} onKeyDown={onKeyDown}
          role="combobox" aria-expanded={open} aria-controls="global-suggest" aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? flat[active].id : undefined}
          aria-label="Meklēt firmu, pasūtītāju vai personu" autoComplete="off" />
        {open && (
          <ul className="suggest suggest-fixed" role="listbox" id="global-suggest"
            style={pos ? { position: 'fixed', top: pos.top, left: pos.left, width: pos.width, right: 'auto' } : { visibility: 'hidden' }}>
            {!any && <li className="muted small" style={{ padding: '8px 12px' }}>Nekas neatbilst “{query}”.</li>}
            {res.b.length > 0 && <li className="suggest-group" aria-hidden="true">Pasūtītāji ({res.bN})</li>}
            {res.b.map((b) => { const id = `opt-b-${b.buyerId}`; const fi = flat.findIndex((f) => f.id === id); return (
              <li key={'b' + b.buyerId} id={id} role="option" aria-selected={active === fi} className={active === fi ? 'active' : ''}
                onMouseDown={(e) => { e.preventDefault(); choose(() => onBuyer(b.buyerId)); }}>
                <span className="suggest-name">{b.buyerName ?? b.buyerId}</span>
                <span className="suggest-meta">{b.combinedScore !== null && <span className={`badge ${b.combinedLevel ?? 'gray'}`}><span className="dot" />{b.combinedScore}</span>}</span>
              </li>
            ); })}
            {res.w.length > 0 && <li className="suggest-group" aria-hidden="true">Piegādātāji ({res.wN})</li>}
            {res.w.map((w) => { const id = `opt-w-${w.fileId}`; const fi = flat.findIndex((f) => f.id === id); return (
              <li key={'w' + w.fileId} id={id} role="option" aria-selected={active === fi} className={active === fi ? 'active' : ''}
                onMouseDown={(e) => { e.preventDefault(); choose(() => onWinner(w.fileId)); }}>
                <span className="suggest-name">{w.winnerName ?? w.winnerId}{w.cfla ? <span className="src-tag src-eu" title="Šim piegādātājam ir arī ES fondu (CFLA) līgumi">ES fondi</span> : null}</span>
                <span className="suggest-meta muted small mono">{w.contracts} līg.</span>
              </li>
            ); })}
            {res.p.length > 0 && <li className="suggest-group" aria-hidden="true">Personas ({res.pN})</li>}
            {res.p.map((p) => { const id = `opt-p-${p.name}`; const fi = flat.findIndex((f) => f.id === id); return (
              <li key={'p' + p.name} id={id} role="option" aria-selected={active === fi} className={active === fi ? 'active' : ''}
                onMouseDown={(e) => { e.preventDefault(); choose(() => onPerson(p.name)); }}>
                <span className="suggest-name">{p.name}</span>
                <span className="suggest-meta muted small">{p.companyCount} firmas</span>
              </li>
            ); })}
            {res.pN > res.p.length && (
              <li className="suggest-all" onMouseDown={(e) => { e.preventDefault(); choose(() => onPerson(query.trim())); }}>
                Rādīt visas {res.pN} personas “{query.trim()}” →
              </li>
            )}
            {(winners === null || persons === null) && <li className="muted small" style={{ padding: '6px 12px' }}>Ielādē piegādātājus un personas…</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
