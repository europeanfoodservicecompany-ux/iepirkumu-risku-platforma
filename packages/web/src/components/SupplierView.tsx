import { useEffect, useMemo, useState } from 'react';
import type { WinnersIndex, WinnerIndexEntry } from '../types.ts';
import { eur, pct, downloadCsv } from '../format.ts';

const PAGE = 60;
type SortKey = 'value' | 'contracts' | 'buyers' | 'singleBid' | 'dependence' | 'name';

// Vērtības joslas filtram (EUR).
const VALUE_BANDS: { k: string; l: string; min: number; max: number }[] = [
  { k: 'all', l: 'Jebkura vērtība', min: 0, max: Infinity },
  { k: 's', l: '< 50 tūkst.', min: 0, max: 50000 },
  { k: 'm', l: '50 tūkst. – 1 milj.', min: 50000, max: 1000000 },
  { k: 'l', l: '1 – 10 milj.', min: 1000000, max: 10000000 },
  { k: 'xl', l: '> 10 milj.', min: 10000000, max: Infinity },
];

function Hi({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term);
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

export function SupplierView({ data, onSelect, sectorFilter, onClearSector }: { data: WinnersIndex; onSelect: (fileId: string) => void; sectorFilter?: string | null; onClearSector?: () => void }) {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('all');
  const [band, setBand] = useState('all');
  const [minContracts, setMinContracts] = useState(5);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' });
  const [limit, setLimit] = useState(PAGE);
  const term = query.trim().toLowerCase();
  void onClearSector;
  // Kad ienāk nozares filtrs no Nozaru cilnes — pielieto to (un atļauj visus piegādātājus).
  useEffect(() => { if (sectorFilter) { setSector(sectorFilter); setMinContracts(1); setLimit(PAGE); } }, [sectorFilter]);

  // Nozaru saraksts no datiem.
  const sectors = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of data.winners) if (w.sectorCpv2) m.set(w.sectorCpv2, w.sectorLabel ?? w.sectorCpv2);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'lv'));
  }, [data]);

  const vb = VALUE_BANDS.find((b) => b.k === band)!;
  const filtered = useMemo(() => data.winners.filter((w) => {
    if (term && !`${w.winnerName ?? ''} ${w.winnerId}`.toLowerCase().includes(term)) return false;
    if (sector !== 'all' && w.sectorCpv2 !== sector) return false;
    if (w.value < vb.min || w.value >= vb.max) return false;
    // Kad meklē pēc nosaukuma/reģ.nr, līgumu skaita slieksni neņem vērā — citādi konkrēts
    // piegādātājs ar <5 līgumiem "pazūd" un izskatās, ka meklēšana nestrādā.
    if (!term && w.contracts < minContracts) return false;
    return true;
  }), [data, term, sector, band, minContracts, vb]);

  const rows = useMemo(() => {
    const val = (w: WinnerIndexEntry): number | string =>
      sort.key === 'value' ? w.value : sort.key === 'contracts' ? w.contracts : sort.key === 'buyers' ? w.buyers
        : sort.key === 'singleBid' ? w.singleBidRate : sort.key === 'dependence' ? w.topBuyerShare : (w.winnerName ?? w.winnerId);
    return [...filtered].sort((a, b) => {
      const va = val(a), vb2 = val(b);
      if (typeof va === 'string' || typeof vb2 === 'string') return String(va).localeCompare(String(vb2), 'lv') * (sort.dir === 'asc' ? 1 : -1);
      return (va - vb2) * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [filtered, sort]);

  const shown = rows.slice(0, limit);
  const toggle = (key: SortKey) => { setLimit(PAGE); setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }); };
  const caret = (key: SortKey) => sort.key === key ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '';

  function exportCsv() {
    downloadCsv('iepirkumu-piegadataji.csv',
      ['Reģ.nr.', 'Piegādātājs', 'Līgumi', 'Vērtība EUR', 'Pasūtītāji', 'Viena pretendenta %', 'Atkarība no 1 pasūt. %', 'Nozare'],
      rows.map((w) => [w.winnerId, w.winnerName ?? '', w.contracts, w.value, w.buyers, Math.round(w.singleBidRate * 100), Math.round(w.topBuyerShare * 100), w.sectorLabel ?? '']));
  }

  return (
    <div className="card">
      <p className="muted small" style={{ marginTop: 0 }}>
        Skats no piegādātāja puses: visi uzvarētie līgumi pār visiem pasūtītājiem. Pazīmes izpētei:
        augsta <strong>viena pretendenta daļa</strong> (uzvar bez konkurences) un <strong>atkarība no viena pasūtītāja</strong>.
        Tās ir norādes, ne pierādījums.
      </p>
      <div className="disclaimer" style={{ marginBottom: 12 }}>
        <strong>Vērtības ir aptuvenas (≈).</strong> IUB atvērtie dati par lieliem un ietvara iepirkumiem mēdz būt nepilnīgi
        vai paši sev pretrunā, tāpēc kopvērtības var atšķirties no faktiskajām. Izmanto tās lielumu salīdzināšanai, ne precīzai uzskaitei.
      </div>

      <div className="controls" style={{ gap: 8 }}>
        <input className="search-input" style={{ flex: '1 1 220px', minWidth: 180 }} placeholder="Meklēt piegādātāju (nosaukums vai reģ. nr.)"
          value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
        <select className="filter-btn" value={sector} onChange={(e) => { setSector(e.target.value); setLimit(PAGE); }} aria-label="Nozare">
          <option value="all">Visas nozares</option>
          {sectors.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="filter-btn" value={band} onChange={(e) => { setBand(e.target.value); setLimit(PAGE); }} aria-label="Vērtība">
          {VALUE_BANDS.map((b) => <option key={b.k} value={b.k}>{b.l}</option>)}
        </select>
        <select className="filter-btn" value={minContracts} onChange={(e) => { setMinContracts(Number(e.target.value)); setLimit(PAGE); }} aria-label="Min. līgumu">
          <option value={1}>≥ 1 līgums</option>
          <option value={5}>≥ 5 līgumi</option>
          <option value={10}>≥ 10 līgumi</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="muted small" style={{ margin: 0 }}>{rows.length} piegādātāji. Klikšķini uz kolonnas, lai sakārtotu.</p>
        {rows.length > 0 && <button className="filter-btn" onClick={exportCsv}>⬇ Lejupielādēt CSV</button>}
      </div>

      {rows.length === 0 ? (
        <div className="empty">Nav atbilstošu piegādātāju. Pamēģini citu filtru vai meklēšanas vārdu.</div>
      ) : (
        <>
          <div className="table-wrap"><table className="buyer-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggle('name')}>Piegādātājs{caret('name')}</th>
                <th className="sortable" style={{ width: 110, textAlign: 'right' }} onClick={() => toggle('value')} title="Uzvarēto līgumu kopvērtība (aptuvena — IUB dati par lieliem iepirkumiem nepilnīgi)">Vērtība ≈{caret('value')}</th>
                <th className="sortable col-ind" style={{ width: 64, textAlign: 'right' }} onClick={() => toggle('contracts')}>Līgumi{caret('contracts')}</th>
                <th className="sortable col-ind" style={{ width: 64, textAlign: 'right' }} onClick={() => toggle('buyers')} title="Atšķirīgu pasūtītāju skaits">Pasūt.{caret('buyers')}</th>
                <th className="sortable" style={{ width: 80, textAlign: 'right' }} onClick={() => toggle('singleBid')} title="Cik bieži uzvar kā vienīgais pretendents">1 pret.{caret('singleBid')}</th>
                <th className="sortable col-ind" style={{ width: 90, textAlign: 'right' }} onClick={() => toggle('dependence')} title="Cik liela daļa vērtības no viena pasūtītāja">Atkarība{caret('dependence')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => (
                <tr key={w.fileId} className="clickable" tabIndex={0} role="button" aria-label={w.winnerName ?? w.winnerId}
                  onClick={() => onSelect(w.fileId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(w.fileId); } }}>
                  <td><Hi text={w.winnerName ?? w.winnerId} term={term} /><div className="muted small mono">{w.winnerId}{w.sectorLabel ? ` · ${w.sectorLabel}` : ''}</div></td>
                  <td className="mono" style={{ textAlign: 'right' }}>{eur(w.value)}</td>
                  <td className="mono col-ind" style={{ textAlign: 'right' }}>{w.contracts}</td>
                  <td className="mono col-ind" style={{ textAlign: 'right' }}>{w.buyers}</td>
                  <td className="mono" style={{ textAlign: 'right', color: w.contracts >= 5 && w.singleBidRate >= 0.7 ? 'var(--red)' : w.contracts >= 5 && w.singleBidRate >= 0.4 ? 'var(--yellow)' : 'inherit' }}>{pct(w.singleBidRate, 0)}</td>
                  <td className="mono col-ind" style={{ textAlign: 'right', color: w.contracts >= 5 && w.topBuyerShare >= 0.8 && w.buyers <= 2 ? 'var(--red)' : 'inherit' }}>{pct(w.topBuyerShare, 0)}</td>
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
