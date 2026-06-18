import type { SectorsData } from '../types.ts';
import { pct, eur, downloadCsv } from '../format.ts';

function rateColor(rate: number, national: number): string {
  if (rate >= national * 1.7) return 'var(--red)';
  if (rate >= national * 1.3) return 'var(--yellow)';
  return 'var(--green)';
}

export function SectorView({ data }: { data: SectorsData }) {
  const nat = data.national.singleBidRate;
  const exportCsv = () => downloadCsv('nozares.csv',
    ['CPV', 'Nozare', 'Viena pretendenta %', 'Līgumi', 'Kopvērtība EUR', 'Pasūtītāji'],
    data.sectors.map((s) => [s.cpv2, s.label, (s.singleBidRate * 100).toFixed(1), s.contracts, s.awardedValue, s.buyers]));
  const max = Math.max(...data.sectors.map((s) => s.singleBidRate), nat);
  return (
    <div className="card">
      <p style={{ marginTop: 0 }}>
        Iepirkumu nozares pēc <strong>viena pretendenta īpatsvara</strong> (vājākā konkurence augšā).
        Salīdzinājumam — nacionālais vidējais ir <strong>{pct(nat, 1)}</strong>. Rāda nozares ar vismaz 10 iepirkumiem.
      </p>
      <div style={{ marginBottom: 12 }}><button className="filter-btn" onClick={exportCsv}>⬇ Lejupielādēt CSV</button></div>
      <div className="table-wrap"><table className="sec-table">
        <thead>
          <tr>
            <th>Nozare (CPV)</th>
            <th style={{ width: 230 }} className="small">Viena pretendenta īpatsvars</th>
            <th style={{ width: 90 }} className="small col-sec">Līgumi</th>
            <th style={{ width: 120 }} className="small col-sec">Kopvērtība</th>
            <th style={{ width: 90 }} className="small col-sec">Pasūtītāji</th>
          </tr>
        </thead>
        <tbody>
          {data.sectors.map((s) => {
            const col = rateColor(s.singleBidRate, nat);
            return (
              <tr key={s.cpv2}>
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
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}
