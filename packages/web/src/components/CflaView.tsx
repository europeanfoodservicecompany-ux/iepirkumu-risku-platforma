import { useMemo, useState } from 'react';
import type { CflaIndexData } from '../types.ts';
import { eur, downloadCsv, norm } from '../format.ts';

const PAGE = 25;
type SortKey = 'split' | 'below' | 'iub' | 'value' | 'contracts';
const IUB_RANK = { high: 2, med: 1 } as Record<string, number>;

// ES fondi (CFLA) — meklēšana pa piegādātājiem ar ES fondu līgumiem (t.sk. zemsliekšņa, ko IUB nesatur).
// Kārtošana pēc sadalīšanas signāla / zemsliekšņa skaita / vērtības. Katrs izvēršams uz projektiem.
export function CflaView({ data, onSelectWinner }: { data: CflaIndexData; onSelectWinner: (fileId: string) => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('split');
  const [onlySplit, setOnlySplit] = useState(false);
  const [onlyOffshore, setOnlyOffshore] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const term = norm(query.trim());

  const rows = useMemo(() => {
    const f = data.suppliers.filter((s) =>
      (!onlySplit || s.splitMax >= 3)
      && (!onlyOffshore || !!s.offshore)
      && (!term || norm(s.name ?? '').includes(term)
        || norm(s.splitProject ?? '').includes(term)
        || s.projects.some((p) => norm(p.name).includes(term))));
    f.sort((a, b) => {
      if (sort === 'split') return b.splitMax - a.splitMax || b.belowCount - a.belowCount;
      if (sort === 'below') return b.belowCount - a.belowCount;
      if (sort === 'iub') return (IUB_RANK[b.iubLevel ?? ''] ?? 0) - (IUB_RANK[a.iubLevel ?? ''] ?? 0) || b.iubFlags.length - a.iubFlags.length || b.value - a.value;
      if (sort === 'contracts') return b.contracts - a.contracts;
      return b.value - a.value;
    });
    return f;
  }, [data, term, sort, onlySplit, onlyOffshore]);
  const offshoreCount = useMemo(() => data.suppliers.filter((s) => s.offshore).length, [data]);

  function exportCsv() {
    const rowsCsv = rows.map((s) => [s.name ?? s.winnerId, s.contracts, s.value, s.belowCount, s.splitMax, s.splitProject ?? '', s.funds.map((x) => x.fund).join('/'), s.iubContracts, Math.round(s.iubSingleBidRate * 100) + '%', s.iubFlags.join('; ')]);
    downloadCsv('es_fondi_cfla.csv', ['Piegādātājs', 'ES līgumi', 'Vērtība EUR', 'Zemsliekšņa', 'Maks. 1 projektā', 'Sadalīšanas projekts', 'Fondi', 'IUB līgumi', 'IUB viena pretendenta %', 'IUB riska pazīmes'], rowsCsv);
  }

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>ES fondi (CFLA)</h2>
      <p className="muted small" style={{ maxWidth: 760, marginTop: 0 }}>
        ES fondu līdzfinansētie iepirkumu līgumi (CFLA atvērtie dati, 2014–2027). Te ietverti arī <strong>zemsliekšņa iepirkumi</strong>,
        ko IUB paziņojumi nesatur. Meklē pēc piegādātāja vai projekta. <strong>Karogs nav pārkāpuma pierādījums</strong> — daudzi zemsliekšņa
        līgumi vienā projektā var būt arī objektīvi pamatoti; tā ir norāde izpētei.
      </p>
      <p className="muted small" style={{ maxWidth: 760, marginTop: -6 }}>
        Pašiem CFLA datiem riska rādītāju (B1/B2/C/D) aprēķināt nevar — tajos nav pretendentu skaita, CPV koda, ne pasūtītāja.
        Tāpēc, ja piegādātājs ir arī IUB uzvarētājs, ar <strong>IUB:</strong> birku rādām tā jau izrēķinātās IUB puses riska pazīmes kā kontekstu.
      </p>

      <div className="section grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 0, marginBottom: 14 }}>
        <div className="card stat"><div className="num">{data.totals.suppliers}</div><div className="lbl">Piegādātāji ar ES līgumiem</div></div>
        <div className="card stat"><div className="num">{data.totals.below}</div><div className="lbl">Zemsliekšņa līgumi (IUB nav)</div></div>
        <div className="card stat"><div className="num" style={{ color: 'var(--red)' }}>{data.totals.withSplit}</div><div className="lbl">Ar sadalīšanas signālu</div></div>
        <div className="card stat"><div className="num" style={{ color: 'var(--red)' }}>{data.totals.withIubRisk}</div><div className="lbl">Ar IUB riska pazīmēm</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <input className="search-input" placeholder="Meklēt piegādātāju vai projektu…"
          value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <label className="muted small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Kārtot:
            <select className="filter-btn" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="split">pēc sadalīšanas signāla</option>
              <option value="below">pēc zemsliekšņa skaita</option>
              <option value="iub">pēc IUB riska pazīmēm</option>
              <option value="value">pēc vērtības</option>
              <option value="contracts">pēc līgumu skaita</option>
            </select>
          </label>
          <label className="chk">
            <input type="checkbox" checked={onlySplit} onChange={(e) => { setOnlySplit(e.target.checked); setLimit(PAGE); }} />
            tikai ar sadalīšanas signālu
          </label>
          {offshoreCount > 0 && (
            <label className="chk" title="ES nauda firmām ar ofšora/pelēkās zonas patiesā labuma guvējiem">
              <input type="checkbox" checked={onlyOffshore} onChange={(e) => { setOnlyOffshore(e.target.checked); setLimit(PAGE); }} />
              tikai ofšora īpašnieki ({offshoreCount})
            </label>
          )}
          <button className="filter-btn" onClick={exportCsv} style={{ marginLeft: 'auto' }}>⬇ CSV</button>
        </div>
      </div>

      <div className="muted small" style={{ margin: '0 4px 8px' }}>{rows.length} piegādātāji</div>

      {rows.slice(0, limit).map((s) => {
        const id = s.fileId;
        const isOpen = open === id;
        return (
          <div className="card" key={id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', cursor: 'pointer' }}
              onClick={() => setOpen(isOpen ? null : id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(isOpen ? null : id); } }}>
              <div>
                <span style={{ fontWeight: 600 }}>{isOpen ? '▾ ' : '▸ '}{s.name ?? s.winnerId}</span>
                {s.sectorLabel && <span className="muted small" style={{ marginLeft: 8 }}>{s.sectorLabel}</span>}
              </div>
              <div className="muted small mono">{s.contracts} ES līg.{s.belowCount > 0 ? ` · ${s.belowCount} zemsliekšņa` : ''} · {eur(s.value)}</div>
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {s.splitMax >= 3 && <span className="note-tag note-high">projektā {s.splitMax} zemsliekšņa līgumi — iespējama sadalīšana</span>}
              {s.offshore && <span className={`note-tag ${s.offshore === 'offshore' ? 'note-high' : ''}`} title="Patiesā labuma guvējs ofšora/zemu nodokļu jurisdikcijā">{s.offshore === 'offshore' ? 'ofšora īpašnieks' : 'zemu nodokļu īpašnieks'}</span>}
              {s.funds.map((f, k) => <span key={k} className="note-tag">{f.fund}: {eur(f.value)}</span>)}
            </div>
            {s.iubContracts > 0 ? (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="muted small" style={{ fontWeight: 600 }} title="Šī piegādātāja rādītāji parastajos IUB iepirkumos. Norāde izpētei, nevis pārkāpuma pierādījums.">IUB iepirkumi:</span>
                <span className="muted small">{s.iubContracts} līg. · {Math.round(s.iubSingleBidRate * 100)}% kā vienīgais pretendents</span>
                {(s.iubRedBuyers > 0 || s.iubYellowBuyers > 0) && (
                  <span className="muted small" title="Cik augsta/vidēja riska pasūtītāju (kombinētais risks A/B1/B2/C/D/G) šis piegādātājs apkalpojis. Pasūtītāja risks nav piegādātāja vaina — tas ir konteksts.">
                    · pasūtītāji: {s.iubRedBuyers > 0 && <strong style={{ color: 'var(--red)' }}>{s.iubRedBuyers} augsta</strong>}{s.iubRedBuyers > 0 && s.iubYellowBuyers > 0 ? ', ' : ''}{s.iubYellowBuyers > 0 && <span>{s.iubYellowBuyers} vidēja riska</span>}
                  </span>
                )}
                {s.iubFlags.map((fl, k) => <span key={k} className="note-tag note-high">{fl}</span>)}
              </div>
            ) : (
              <div className="muted small" style={{ marginTop: 6 }} title="Šis piegādātājs neparādās IUB virssliekšņa iepirkumos — tikai ES fondu (t.sk. zemsliekšņa) līgumos.">IUB iepirkumi: nav (tikai ES fondu līgumi)</div>
            )}
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                {s.splitProject && <div className="muted small" style={{ marginBottom: 6 }}>Sadalīšanas projekts: <strong>{s.splitProject}</strong></div>}
                <div className="muted small" style={{ marginBottom: 4 }}>Projekti:</div>
                <ul className="member-list">
                  {s.projects.map((p, k) => (
                    <li key={k}>
                      <div className="memrow">
                        <span style={{ flex: 1 }}>{p.name}</span>
                        <span className="muted small mono">{p.count} līg.{p.below > 0 ? ` · ${p.below} zemsliekšņa` : ''}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="iublink small" style={{ marginTop: 8, cursor: 'pointer', display: 'inline-block' }}
                  onClick={() => onSelectWinner(s.fileId)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectWinner(s.fileId); } }}>
                  Atvērt piegādātāja profilu →
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
