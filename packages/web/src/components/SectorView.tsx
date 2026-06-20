import { useState } from 'react';
import type { SectorsData, SectorStat, SectorEntity } from '../types.ts';
import { pct, eur, downloadCsv } from '../format.ts';

function rateColor(rate: number, national: number): string {
  if (rate >= national * 1.7) return 'var(--red)';
  if (rate >= national * 1.3) return 'var(--yellow)';
  return 'var(--green)';
}

// Mini-saraksts izvērstajā skatā (top pasūtītāji / piegādātāji nozarē).
function EntityList({ title, items, onPick }: { title: string; items: SectorEntity[]; onPick?: (id: string) => void }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="sec-exp-col">
      <div className="sec-exp-h">{title}</div>
      <table className="sec-exp-table">
        <thead>
          <tr><th>Nosaukums</th><th style={{ textAlign: 'right' }}>Līg.</th><th style={{ textAlign: 'right' }}>Vērtība ≈</th><th style={{ textAlign: 'right' }}>1 pret.</th></tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id} className={onPick ? 'clickable' : undefined}
              tabIndex={onPick ? 0 : undefined} role={onPick ? 'button' : undefined}
              onClick={onPick ? () => onPick(e.id) : undefined}
              onKeyDown={onPick ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(e.id); } } : undefined}>
              <td>{e.name ?? e.id}{onPick && <span className="muted"> →</span>}<div className="muted small mono">{e.id}</div></td>
              <td className="mono" style={{ textAlign: 'right' }}>{e.contracts}</td>
              <td className="mono" style={{ textAlign: 'right' }}>{eur(e.value)}</td>
              <td className="mono" style={{ textAlign: 'right', color: e.singleBidRate >= 0.7 ? 'var(--red)' : e.singleBidRate >= 0.4 ? 'var(--yellow)' : 'inherit' }}>{pct(e.singleBidRate, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectorView({ data, onSelect, onSelectBuyer }: { data: SectorsData; onSelect: (cpv2: string) => void; onSelectBuyer?: (id: string) => void }) {
  const nat = data.national.singleBidRate;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (cpv2: string) => setOpen((s) => { const n = new Set(s); if (n.has(cpv2)) n.delete(cpv2); else n.add(cpv2); return n; });
  const exportCsv = () => downloadCsv('nozares.csv',
    ['CPV', 'Nozare', 'Viena pretendenta %', 'Līgumi', 'Kopvērtība EUR', 'Pasūtītāji'],
    data.sectors.map((s) => [s.cpv2, s.label, (s.singleBidRate * 100).toFixed(1), s.contracts, s.awardedValue, s.buyers]));
  const max = Math.max(...data.sectors.map((s) => s.singleBidRate), nat);
  return (
    <div className="card">
      <p style={{ marginTop: 0 }}>
        Iepirkumu nozares pēc <strong>viena pretendenta īpatsvara</strong> (vājākā konkurence augšā).
        Salīdzinājumam — nacionālais vidējais ir <strong>{pct(nat, 1)}</strong>. Rāda nozares ar vismaz 10 iepirkumiem.
        Klikšķini uz nozares, lai <strong>izvērstu</strong> tās lielākos pasūtītājus un piegādātājus.
      </p>
      <div style={{ marginBottom: 12 }}><button className="filter-btn" onClick={exportCsv}>⬇ Lejupielādēt CSV</button></div>
      <div className="table-wrap"><table className="sec-table">
        <thead>
          <tr>
            <th style={{ width: 28 }}></th>
            <th>Nozare (CPV)</th>
            <th style={{ width: 230 }} className="small">Viena pretendenta īpatsvars</th>
            <th style={{ width: 90 }} className="small col-sec">Līgumi</th>
            <th style={{ width: 120 }} className="small col-sec">Kopvērtība</th>
            <th style={{ width: 90 }} className="small col-sec">Pasūtītāji</th>
          </tr>
        </thead>
        <tbody>
          {data.sectors.map((s) => (
            <SectorRows key={s.cpv2} s={s} col={rateColor(s.singleBidRate, nat)} nat={nat} max={max}
              isOpen={open.has(s.cpv2)} avg={s.contracts > 0 ? s.awardedValue / s.contracts : 0}
              onToggle={() => toggle(s.cpv2)} onSelect={onSelect} onSelectBuyer={onSelectBuyer} />
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

function SectorRows({ s, col, nat, max, isOpen, avg, onToggle, onSelect, onSelectBuyer }: {
  s: SectorStat; col: string; nat: number; max: number; isOpen: boolean; avg: number;
  onToggle: () => void; onSelect: (cpv2: string) => void; onSelectBuyer?: (id: string) => void;
}) {
  const vsNat = nat > 0 ? s.singleBidRate / nat : 1;
  return (
    <>
      <tr className="clickable" tabIndex={0} role="button" aria-expanded={isOpen} aria-label={`${s.label} — izvērst`}
        onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
        <td className="mono" style={{ textAlign: 'center', color: 'var(--muted)' }}>{isOpen ? '▾' : '▸'}</td>
        <td>{s.label}<div className="muted small mono">CPV {s.cpv2}</div></td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="bar" style={{ flex: 1 }}>
              <span style={{ width: `${(s.singleBidRate / max) * 100}%`, background: col }} />
            </div>
            <strong className="mono small" style={{ color: col, width: 42, textAlign: 'right' }}>{pct(s.singleBidRate, 0)}</strong>
          </div>
        </td>
        <td className="mono small col-sec">{s.contracts}</td>
        <td className="mono small col-sec">{eur(s.awardedValue)}</td>
        <td className="mono small col-sec">{s.buyers}</td>
      </tr>
      {isOpen && (
        <tr className="sec-exp-row">
          <td></td>
          <td colSpan={5}>
            <div className="sec-exp">
              <div className="sec-exp-stats">
                <span><strong>{s.contracts}</strong> līgumi · <strong>{s.suppliers ?? '—'}</strong> piegādātāji · <strong>{s.buyers}</strong> pasūtītāji</span>
                <span>Vidējā līguma vērtība ≈ <strong>{eur(avg)}</strong></span>
                <span>Viena pretendenta likme <strong style={{ color: col }}>{pct(s.singleBidRate, 0)}</strong> — <strong>{vsNat.toFixed(1)}×</strong> pret nacionālo vidējo</span>
              </div>
              <div className="sec-exp-cols">
                <EntityList title="Lielākie pasūtītāji nozarē" items={s.topBuyers ?? []} onPick={onSelectBuyer} />
                <EntityList title="Lielākie piegādātāji nozarē" items={s.topSuppliers ?? []} />
              </div>
              <div style={{ marginTop: 10 }}>
                <button className="filter-btn" onClick={(e) => { e.stopPropagation(); onSelect(s.cpv2); }}>
                  Skatīt visus šīs nozares pasūtītājus →
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
