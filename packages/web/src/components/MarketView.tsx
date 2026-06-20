import { useState } from 'react';
import type { MarketsData, MarketStat } from '../types.ts';
import { pct, eur, downloadCsv } from '../format.ts';

const col = (lvl: string | null) => (lvl === 'red' ? 'var(--red)' : lvl === 'yellow' ? 'var(--yellow)' : 'var(--green)');

function MarketRow({ m }: { m: MarketStat }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lot">
      <div role="button" tabIndex={0} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}>
        <span className="risk-circle" style={{ background: 'transparent', boxShadow: `inset 0 0 0 2px ${col(m.level)}`, color: col(m.level), width: 38, height: 38 }}>{m.score}</span>
        <div style={{ flex: 1 }}>
          <strong>{m.label}</strong>
          <div className="muted small">{m.distinctWinners} uzvarētāji · {m.contracts} līgumi · {eur(m.awardedValue)}</div>
        </div>
        <div className="market-metrics small mono">
          <span>HHI {m.hhi}</span>
          <span style={{ color: col(m.level) }}>1-pretend. {pct(m.singleBidRate, 0)}</span>
          <span>lielākais {pct(m.top1Share, 0)}</span>
        </div>
        <span className="muted">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <ul className="member-list" style={{ marginTop: 10 }}>
          {m.topWinners.map((w) => (
            <li key={w.id}>
              <span style={{ flex: 1 }}>{w.name ?? w.id}</span>
              <span className="muted small mono">{w.contracts} līg.</span>
              <span className="mono">{eur(w.value)}</span>
              <strong className="mono" style={{ minWidth: 48, textAlign: 'right' }}>{pct(w.share, 0)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MarketView({ data }: { data: MarketsData }) {
  const exportCsv = () => downloadCsv('slegtie-tirgi.csv',
    ['CPV', 'Nozare', 'Slēgtības score', 'HHI', 'Viena pretendenta %', 'Lielākā uzvarētāja %', 'Lielākais uzvarētājs', 'Līgumi', 'Uzvarētāji', 'Kopvērtība EUR'],
    data.markets.map((m) => [m.cpv, m.label, m.score, m.hhi, (m.singleBidRate * 100).toFixed(0), (m.top1Share * 100).toFixed(0), m.topWinners[0]?.name ?? '', m.contracts, m.distinctWinners, m.awardedValue]));
  return (
    <div className="card">
      <p style={{ marginTop: 0 }}>
        <strong>Slēgtie tirgi</strong> — CPV kategorijas, kur nedaudzi piegādātāji kontrolē lielāko līgumvērtības daļu
        (augsts HHI) un ir augsta viena pretendenta likme. Tā ir <strong>netieša</strong> pazīme par vāju konkurenci vai
        iespējami saskaņotām darbībām.
      </p>
      <div className="disclaimer" style={{ marginBottom: 14 }}>
        <strong>Piezīme:</strong> IUB atvērtajos datos nav zaudējušo pretendentu (tie publiski pieejami tikai katra iepirkuma atvēršanas protokolā, ne strukturēti), tāpēc saskaņotas darbības šeit pierādīt nevar.
        Šie rādītāji izceļ tirgus ar vāju konkurenci, ko, iespējams, vērts aplūkot tuvāk — tie nav pārkāpuma pierādījums.
      </div>
      <div style={{ marginBottom: 12 }}><button className="filter-btn" onClick={exportCsv}>⬇ Lejupielādēt CSV</button></div>
      {data.markets.map((m) => <MarketRow key={m.cpv} m={m} />)}
    </div>
  );
}
