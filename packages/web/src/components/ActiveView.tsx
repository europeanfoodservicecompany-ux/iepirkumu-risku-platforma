import { useMemo, useState } from 'react';
import type { ActiveData, ActiveTender, IndexBuyer } from '../types.ts';
import { eur, downloadCsv } from '../format.ts';

const NON_COMPETITIVE = new Set(['neg-wo-call']);

function daysLeft(deadline: string | null, asOf?: string): number | null {
  if (!deadline) return null;
  const a = asOf ? Date.parse(asOf) : Date.now();
  return Math.round((Date.parse(deadline) - a) / 86400000);
}

export function ActiveView({ data, buyers, onSelectBuyer }: {
  data: ActiveData; buyers: IndexBuyer[]; onSelectBuyer: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [riskyOnly, setRiskyOnly] = useState(false);
  const term = q.trim().toLowerCase();

  // Pasūtītāja vēsturiskais risks pēc reģ. nr.
  const riskBy = useMemo(() => {
    const m = new Map<string, { score: number | null; level: string | null }>();
    for (const b of buyers) m.set(b.buyerId, { score: b.combinedScore, level: b.combinedLevel });
    return m;
  }, [buyers]);

  const rows = useMemo(() => data.tenders.filter((t) => {
    if (term && !`${t.buyerName ?? ''} ${t.name ?? ''} ${t.cpv ?? ''}`.toLowerCase().includes(term)) return false;
    if (riskyOnly) {
      const r = riskBy.get(t.buyerId);
      const risky = (r && r.level === 'red') || NON_COMPETITIVE.has(t.procedureType ?? '');
      if (!risky) return false;
    }
    return true;
  }), [data, term, riskyOnly, riskBy]);

  const exportCsv = () => downloadCsv('aktualie-konkursi.csv',
    ['Termiņš', 'Iepirkums', 'Pasūtītājs', 'Reģ.nr.', 'CPV', 'Plānotā vērtība EUR', 'Procedūra', 'Pasūtītāja risks', 'IUB saite'],
    rows.map((t) => [t.deadline, t.name ?? '', t.buyerName ?? '', t.buyerId, t.cpv ?? '', t.estimatedValue ?? '', t.procedureType ?? '', riskBy.get(t.buyerId)?.score ?? '', t.sourceUrl ?? '']));

  return (
    <div className="card">
      <p style={{ marginTop: 0 }}>
        <strong>Aktuālie konkursi</strong> — šobrīd atvērti iepirkumi (termiņš vēl nav pagājis), uz {data.meta?.asOf}.
        Pilnos riska rādītājus (viens pretendents, cena u.c.) var aprēķināt tikai pēc rezultāta; šeit rādām
        <strong> pasūtītāja vēsturisko risku</strong> un <strong>procedūras veidu</strong> kā pirms-rezultāta signālus.
      </p>
      <div className="controls">
        <div className="search-box" style={{ flex: 1 }}>
          <input type="search" placeholder="Filtrēt pēc pasūtītāja, nosaukuma vai CPV…" value={q}
            onChange={(e) => setQ(e.target.value)} aria-label="Filtrēt konkursus" />
        </div>
        <button className={`filter-btn ${riskyOnly ? 'active' : ''}`} onClick={() => setRiskyOnly((v) => !v)}>
          Tikai paaugstināta riska
        </button>
        <button className="filter-btn" onClick={exportCsv}>⬇ CSV</button>
      </div>
      <p className="muted small">{rows.length} atvērti konkursi. Sakārtoti pēc termiņa (tuvākais augšā).</p>
      <div className="table-wrap"><table>
        <thead>
          <tr>
            <th style={{ width: 104 }} className="small">Termiņš</th>
            <th>Iepirkums</th>
            <th>Pasūtītājs</th>
            <th style={{ width: 96 }} className="small">Pasūt. risks</th>
            <th style={{ width: 104 }} className="small">Procedūra</th>
            <th style={{ width: 64 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 400).map((t: ActiveTender) => {
            const dl = daysLeft(t.deadline, data.meta?.asOf);
            const r = riskBy.get(t.buyerId);
            const nonComp = NON_COMPETITIVE.has(t.procedureType ?? '');
            const band = r && r.score !== null ? (r.level ?? 'green') : 'gray';
            return (
              <tr key={t.id}>
                <td className="small mono">{t.deadline}<div className="muted" style={{ fontSize: 11 }}>{dl !== null ? (dl <= 0 ? 'šodien' : `pēc ${dl} d.`) : ''}</div></td>
                <td className="small">{t.name ?? '—'}<div className="muted mono" style={{ fontSize: 11 }}>CPV {(t.cpv ?? '').slice(0, 8)}{t.estimatedValue != null ? ` · ${eur(t.estimatedValue)}` : ''}</div></td>
                <td className="small"><button className="btn-link" onClick={() => onSelectBuyer(t.buyerId)}>{t.buyerName ?? t.buyerId}</button></td>
                <td>{r && r.score !== null ? <span className={`badge ${band}`}><span className="dot" />{r.score}</span> : <span className="muted small">–</span>}</td>
                <td>{nonComp ? <span className="badge red"><span className="dot" />bez konkursa</span> : <span className="muted small">{t.procedureType ?? '–'}</span>}</td>
                <td>{t.sourceUrl && <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer" className="small">IUB →</a>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      {rows.length > 400 && <p className="muted small">Rāda pirmos 400 no {rows.length}. Izmanto filtru, lai sašaurinātu.</p>}
    </div>
  );
}
