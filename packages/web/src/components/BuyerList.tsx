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
];

const PAGE = 60;

function scoreKey(score: number | null): string {
  if (score === null) return 'gray';
  if (score >= 70) return 'red';
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
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'combined', dir: 'desc' });
  const [limit, setLimit] = useState(PAGE);
  const term = query.trim().toLowerCase();

  const filtered = useMemo(() => buyers.filter((b) => {
    if (filter === 'red' && !hasLevel(b, 'red')) return false;
    if (filter === 'yellow' && !hasLevel(b, 'yellow')) return false;
    if (filter === 'scored' && b.combinedScore === null) return false;
    if (term && !matches(b, term)) return false;
    return true;
  }), [buyers, term, filter]);

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
      ['Reģ.nr.', 'Pasūtītājs', 'Kopējais risks', 'B1', 'B2', 'A', 'C', 'E', 'D'],
      rows.map((b) => [b.buyerId, b.buyerName ?? '', b.combinedScore, b.scores.B1, b.scores.B2, b.scores.A, b.scores.C, b.scores.E, b.scores.D]),
    );
  }

  function toggleSort(key: SortKey) {
    setLimit(PAGE);
    setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' });
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="muted small" style={{ margin: 0 }}>{rows.length} pasūtītāji{term ? ` (filtrs: “${query}”)` : ''}. Klikšķini uz kolonnas, lai sakārtotu.</p>
        {rows.length > 0 && <button className="filter-btn" onClick={exportCsv}>⬇ Lejupielādēt CSV</button>}
      </div>

      {rows.length === 0 ? (
        <div className="empty">Nav atbilstošu pasūtītāju. Pamēģini citu meklēšanas vārdu vai filtru.</div>
      ) : (
        <>
          <div className="table-wrap"><table>
            <thead>
              <tr>
                <th className="sortable" style={{ width: 64 }} onClick={() => toggleSort('combined')} title="Kopējais svērtais risks (0–100)">Risks{caret('combined')}</th>
                <th className="sortable" onClick={() => toggleSort('name')}>Pasūtītājs{caret('name')}</th>
                {IND.map((i) => (
                  <th key={i.key} className="sortable" style={{ width: 70 }} title={i.tip} onClick={() => toggleSort(i.key)}>{i.label}{caret(i.key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.buyerId} className="clickable" onClick={() => onSelect(b.buyerId)}>
                  <td><span className={`risk-circle ${scoreKey(b.combinedScore)}`}>{b.combinedScore ?? '–'}</span></td>
                  <td><Highlight text={b.buyerName ?? b.buyerId} term={term} /><div className="muted small mono">{b.buyerId}</div></td>
                  {IND.map((i) => <td key={i.key}><MiniBadge score={b.scores[i.key]} level={b.levels[i.key]} /></td>)}
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
