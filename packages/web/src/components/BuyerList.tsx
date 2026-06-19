import { useMemo, useState } from 'react';
import type { IndexBuyer, IndKey, RiskLevel } from '../types.ts';
import { bandFromScore, downloadCsv } from '../format.ts';

type Filter = 'scored' | 'red' | 'yellow' | 'all';
type SortKey = 'combined' | 'name' | IndKey;

const IND: { key: IndKey; label: string; tip: string }[] = [
  { key: 'B1', label: 'B1', tip: 'B1 — Viena pretendenta īpatsvars: cik bieži piedalās tikai viens piegādātājs (vāja konkurence).' },
  { key: 'B2', label: 'B2', tip: 'B2 — Uzvarētāju koncentrācija: cik liela līgumu daļa nonāk pie viena uzvarētāja (HHI).' },
  { key: 'A', label: 'A', tip: 'A — Iepirkumu sadalīšana: viens liels pirkums sadalīts vairākos mazākos zem sliekšņa.' },
  { key: 'C', label: 'C', tip: 'C — Cenu/vērtības novirze: neparasti augsta līgumvērtība attiecīgajā CPV kategorijā.' },
  { key: 'E', label: 'E', tip: 'E — Procedūras integritāte: sarunu procedūra bez iepriekšējas konkurences izsludināšanas.' },
  { key: 'D', label: 'D', tip: 'D — Saistītās puses: līgumi tikko dibinātiem uzņēmumiem (UR reģistrācijas dati).' },
  { key: 'G', label: 'G', tip: 'G — Līguma grozījumi: papildu darbi vai izpildītāja maiņa pēc uzvaras (cenas/apjoma uzpūšana).' },
];

const PAGE = 60;

const VALUE_BANDS: { k: string; l: string; min: number; max: number }[] = [
  { k: 'all', l: 'Jebkura vērtība', min: 0, max: Infinity },
  { k: 's', l: '< 100 tūkst.', min: 0, max: 100000 },
  { k: 'm', l: '100 tūkst. – 1 milj.', min: 100000, max: 1000000 },
  { k: 'l', l: '1 – 10 milj.', min: 1000000, max: 10000000 },
  { k: 'xl', l: '> 10 milj.', min: 10000000, max: Infinity },
];

function scoreKey(score: number | null): string {
  if (score === null) return 'gray';
  if (score >= 60) return 'red';   // kopējais slieksnis 60 (6 slāņi)
  if (score >= 30) return 'yellow';
  return 'green';
}
function MiniBadge({ score, level }: { score: number | null; level: RiskLevel }) {
  if (score === null) return <span className="muted small">–</span>;
  return <span className={`badge ${bandFromScore(score, level)}`}><span className="dot" aria-hidden="true" />{score}</span>;
}
const hasLevel = (b: IndexBuyer, lvl: 'red' | 'yellow') => Object.values(b.levels).some((v) => v === lvl);
const matches = (b: IndexBuyer, term: string) => `${b.buyerName ?? ''} ${b.buyerId}`.toLowerCase().includes(term);

// Izceļ meklēto tekstu nosaukumā.
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

export function BuyerList({ buyers, query, onSelect }: { buyers: IndexBuyer[]; query: string; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('scored');
  const [ind, setInd] = useState<'all' | IndKey>('all');
  const [secF, setSecF] = useState('all');
  const [bandF, setBandF] = useState('all');
  const [regF, setRegF] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'combined', dir: 'desc' });
  const [limit, setLimit] = useState(PAGE);
  const term = query.trim().toLowerCase();

  // Nozaru un reģionu saraksti no datiem (filtru izvēlnēm).
  const sectors = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of buyers) if (b.sectorCpv2) m.set(b.sectorCpv2, b.sectorLabel ?? b.sectorCpv2);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'lv'));
  }, [buyers]);
  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const b of buyers) if (b.region) s.add(b.region);
    return [...s].sort((a, b) => a.localeCompare(b, 'lv'));
  }, [buyers]);

  const vb = VALUE_BANDS.find((x) => x.k === bandF)!;
  const filtered = useMemo(() => buyers.filter((b) => {
    if (term && !matches(b, term)) return false;
    if (secF !== 'all' && b.sectorCpv2 !== secF) return false;
    if (regF !== 'all' && b.region !== regF) return false;
    if (bandF !== 'all') { const v = b.value ?? 0; if (v < vb.min || v >= vb.max) return false; }
    if (ind !== 'all') {
      // Atlasa pēc konkrēta indikatora kolonnas
      if (b.scores[ind] === null) return false;
      if (filter === 'red' && b.levels[ind] !== 'red') return false;
      if (filter === 'yellow' && b.levels[ind] !== 'yellow') return false;
      return true;
    }
    if (filter === 'red' && !hasLevel(b, 'red')) return false;
    if (filter === 'yellow' && !hasLevel(b, 'yellow')) return false;
    if (filter === 'scored' && b.combinedScore === null) return false;
    return true;
  }), [buyers, term, filter, ind, secF, regF, bandF, vb]);

  const rows = useMemo(() => {
    const val = (b: IndexBuyer): number | string | null =>
      sort.key === 'combined' ? b.combinedScore : sort.key === 'name' ? (b.buyerName ?? b.buyerId) : b.scores[sort.key];
    const arr = [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'lv') * (sort.dir === 'asc' ? 1 : -1);
      }
      const na = va ?? -1, nb = vb ?? -1; // null beigās
      return (na - nb) * (sort.dir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [filtered, sort]);

  const shown = rows.slice(0, limit);

  function exportCsv() {
    downloadCsv(
      `iepirkumu-risks-pasutitaji.csv`,
      ['Reģ.nr.', 'Pasūtītājs', 'Kopējais risks', 'B1', 'B2', 'A', 'C', 'E', 'D', 'G'],
      rows.map((b) => [b.buyerId, b.buyerName ?? '', b.combinedScore, b.scores.B1, b.scores.B2, b.scores.A, b.scores.C, b.scores.E, b.scores.D, b.scores.G]),
    );
  }

  function toggleSort(key: SortKey) {
    setLimit(PAGE);
    setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' });
  }
  function pickInd(k: 'all' | IndKey) {
    setInd(k); setLimit(PAGE);
    setSort({ key: k === 'all' ? 'combined' : k, dir: 'desc' });
  }
  const caret = (key: SortKey) => sort.key === key ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '';

  const filters: { k: Filter; l: string }[] = [
    { k: 'scored', l: 'Ar rādītāju' }, { k: 'red', l: 'Augsts risks' },
    { k: 'yellow', l: 'Vērts pārbaudīt' }, { k: 'all', l: 'Visi' },
  ];

  return (
    <div className="card">
      <div className="controls">
        {filters.map((f) => (
          <button key={f.k} className={`filter-btn ${filter === f.k ? 'active' : ''}`}
            onClick={() => { setFilter(f.k); setLimit(PAGE); }}>{f.l}</button>
        ))}
      </div>

      <div className="controls" style={{ marginTop: -4 }}>
        <span className="muted small" style={{ alignSelf: 'center' }}>Indikators:</span>
        <button className={`filter-btn ${ind === 'all' ? 'active' : ''}`} onClick={() => pickInd('all')}>Kopējais</button>
        {IND.map((i) => (
          <button key={i.key} className={`filter-btn ${ind === i.key ? 'active' : ''}`} title={i.tip} onClick={() => pickInd(i.key)}>{i.key}</button>
        ))}
      </div>

      <div className="controls" style={{ marginTop: -4 }}>
        <select className="filter-btn" value={secF} onChange={(e) => { setSecF(e.target.value); setLimit(PAGE); }} aria-label="Nozare">
          <option value="all">Visas nozares</option>
          {sectors.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="filter-btn" value={regF} onChange={(e) => { setRegF(e.target.value); setLimit(PAGE); }} aria-label="Reģions">
          <option value="all">Visi reģioni</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="filter-btn" value={bandF} onChange={(e) => { setBandF(e.target.value); setLimit(PAGE); }} aria-label="Iepirkumu vērtība">
          {VALUE_BANDS.map((b) => <option key={b.k} value={b.k}>{b.l}</option>)}
        </select>
        {(secF !== 'all' || regF !== 'all' || bandF !== 'all') &&
          <button className="filter-btn" onClick={() => { setSecF('all'); setRegF('all'); setBandF('all'); setLimit(PAGE); }}>✕ Notīrīt</button>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="muted small" style={{ margin: 0 }}>
          {rows.length} pasūtītāji{term ? ` (meklē: “${query}”)` : ''}
          {ind !== 'all' ? ` · kārtoti pēc ${ind}` : ''}. Klikšķini uz kolonnas, lai sakārtotu.
        </p>
        {rows.length > 0 && <button className="filter-btn" onClick={exportCsv}>⬇ Lejupielādēt CSV</button>}
      </div>

      {rows.length === 0 ? (
        <div className="empty">Nav atbilstošu pasūtītāju. Pamēģini citu meklēšanas vārdu vai filtru.</div>
      ) : (
        <>
          <div className="table-wrap"><table className="buyer-table">
            <thead>
              <tr>
                <th className="sortable" style={{ width: 64 }} onClick={() => toggleSort('combined')} title="Kopējais svērtais risks (0–100)">Risks{caret('combined')}</th>
                <th className="sortable" onClick={() => toggleSort('name')}>Pasūtītājs{caret('name')}</th>
                {IND.map((i) => (
                  <th key={i.key} className={`sortable col-ind ${ind === i.key ? 'col-active' : ''}`} style={{ width: 70 }} title={i.tip} onClick={() => toggleSort(i.key)}>{i.label}{caret(i.key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.buyerId} className="clickable" tabIndex={0} role="button" aria-label={b.buyerName ?? b.buyerId} onClick={() => onSelect(b.buyerId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.buyerId); } }}>
                  <td><span className={`risk-circle ${scoreKey(b.combinedScore)}`}>{b.combinedScore ?? '–'}</span></td>
                  <td><Highlight text={b.buyerName ?? b.buyerId} term={term} /><div className="muted small mono">{b.buyerId}</div></td>
                  {IND.map((i) => <td key={i.key} className="col-ind"><MiniBadge score={b.scores[i.key]} level={b.levels[i.key]} /></td>)}
                </tr>
              ))}
            </tbody>
          </table></div>
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
