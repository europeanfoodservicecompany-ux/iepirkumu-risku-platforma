import type { OverviewData } from '../types.ts';
import { pct, eur } from '../format.ts';
import { LatviaMap } from './LatviaMap.tsx';

const RISK = { red: 'var(--red)', yellow: 'var(--yellow)', green: 'var(--green)', none: '#c3bdb0' };

// Kompakta EUR vērtība lielajiem skaitļiem.
function compactEur(x: number): string {
  if (x >= 1e9) return '€' + (x / 1e9).toFixed(2).replace('.', ',') + ' mljrd.';
  if (x >= 1e6) return '€' + Math.round(x / 1e6) + ' milj.';
  return eur(x);
}

// SVG riņķa (donut) diagramma.
function Donut({ segs }: { segs: { label: string; value: number; color: string }[] }) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 130 130" width="150" height="150" role="img" aria-label="Pasūtītāju riska sadalījums">
      <g transform="translate(65,65) rotate(-90)">
        {segs.map((s) => {
          const len = (s.value / total) * C;
          const el = <circle key={s.label} r={R} fill="none" stroke={s.color} strokeWidth="18"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </g>
      <text x="65" y="61" textAnchor="middle" fontSize="22" fontWeight="500" fill="var(--ink)">{total}</text>
      <text x="65" y="78" textAnchor="middle" fontSize="10" fill="var(--muted)">pasūtītāji</text>
    </svg>
  );
}

// SVG mēnešu līknes diagramma (viena pretendenta likme laikā).
function TrendLine({ data, national }: { data: OverviewData['timeline']; national: number }) {
  const W = 640, H = 150, padL = 34, padB = 22, padT = 10, padR = 8;
  const pts = data.filter((d) => d.contracts >= 10); // tikai mēneši ar pietiekamu apjomu
  if (pts.length < 2) return null;
  const maxY = Math.max(0.6, ...pts.map((p) => p.singleBidRate));
  const x = (i: number) => padL + (i / (pts.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.singleBidRate).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${(H - padB)} L${padL},${(H - padB)} Z`;
  const natY = y(national);
  const ticks = [0, 0.2, 0.4, 0.6].filter((t) => t <= maxY);
  const labelEvery = Math.ceil(pts.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Viena pretendenta likme pa mēnešiem">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(t * 100)}%</text>
        </g>
      ))}
      <line x1={padL} x2={W - padR} y1={natY} y2={natY} stroke="var(--brand)" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - padR} y={natY - 4} textAnchor="end" fontSize="10" fill="var(--brand)">nacionālā {pct(national, 0)}</text>
      <path d={area} fill="var(--ring-track)" opacity="0.6" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" />
      {pts.map((p, i) => (i % labelEvery === 0 ? (
        <text key={p.month} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{p.month.slice(2)}</text>
      ) : null))}
    </svg>
  );
}

export function OverviewView({ data, onSelectBuyer, onPickSector, onPickRegion, onNav }: {
  data: OverviewData;
  onSelectBuyer: (id: string) => void;
  onPickSector: (cpv2: string) => void;
  onPickRegion: (label: string) => void;
  onNav: (view: 'buyers' | 'sectors') => void;
}) {
  const nat = data.national.singleBidRate;
  const rd = data.riskDistribution;
  const segs = [
    { label: 'Zems', value: rd.green, color: RISK.green },
    { label: 'Vidējs', value: rd.yellow, color: RISK.yellow },
    { label: 'Augsts', value: rd.red, color: RISK.red },
    { label: 'Nav datu', value: rd.none, color: RISK.none },
  ];
  const maxSec = Math.max(...data.topSectors.map((s) => s.singleBidRate), nat);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-l">Iepirkumi</div><div className="kpi-v">{data.totals.procurements.toLocaleString('lv-LV')}</div></div>
        <div className="kpi"><div className="kpi-l">Kopvērtība ≈</div><div className="kpi-v">{compactEur(data.totals.awardedValue)}</div></div>
        <div className="kpi"><div className="kpi-l">Viena pretendenta likme</div><div className="kpi-v" style={{ color: 'var(--yellow)' }}>{pct(nat, 1)}</div></div>
        <div className="kpi"><div className="kpi-l">Augsta riska pasūtītāji</div><div className="kpi-v" style={{ color: 'var(--red)' }}>{rd.red} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>/ {data.totals.buyers}</span></div></div>
      </div>

      <div className="ov-row">
        <div className="card ov-card">
          <h3 className="ov-h">Pasūtītāju riska sadalījums</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Donut segs={segs} />
            <div style={{ flex: '1 1 120px' }}>
              {segs.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 13 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <strong className="mono">{s.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card ov-card">
          <h3 className="ov-h">Nozares ar vājāko konkurenci</h3>
          {data.topSectors.map((s) => {
            const col = s.singleBidRate >= nat * 1.7 ? 'var(--red)' : s.singleBidRate >= nat * 1.3 ? 'var(--yellow)' : 'var(--green)';
            return (
              <div key={s.cpv2} className="ov-secrow clickable" tabIndex={0} role="button"
                onClick={() => onPickSector(s.cpv2)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickSector(s.cpv2); } }}>
                <span className="ov-secname">{s.label}</span>
                <span className="bar" style={{ flex: 1 }}><span style={{ width: `${(s.singleBidRate / maxSec) * 100}%`, background: col }} /></span>
                <strong className="mono small" style={{ color: col, width: 38, textAlign: 'right' }}>{pct(s.singleBidRate, 0)}</strong>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card ov-card" style={{ marginTop: 12 }}>
        <h3 className="ov-h">Viena pretendenta likme laikā (pa mēnešiem)</h3>
        <TrendLine data={data.timeline} national={nat} />
      </div>

      {data.regions && data.regions.length > 0 && (
        <div className="card ov-card" style={{ marginTop: 12 }}>
          <h3 className="ov-h">Reģioni — viena pretendenta likme</h3>
          <LatviaMap regions={data.regions} onPick={onPickRegion} />
        </div>
      )}

      <div className="card ov-card" style={{ marginTop: 12 }}>
        <h3 className="ov-h">Augstākā riska pasūtītāji</h3>
        <div className="ov-buyers">
          {data.topRiskBuyers.map((b) => (
            <div key={b.buyerId} className="ov-buyer clickable" tabIndex={0} role="button" aria-label={b.buyerName ?? b.buyerId}
              onClick={() => onSelectBuyer(b.buyerId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectBuyer(b.buyerId); } }}>
              <span className={`risk-dot ${b.combinedLevel === 'red' ? 'r' : 'y'}`} />
              <span className="ov-bname">{b.buyerName ?? b.buyerId}</span>
              <strong className="mono" style={{ color: b.combinedLevel === 'red' ? 'var(--red)' : 'var(--yellow)' }}>{b.combinedScore}</strong>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="filter-btn" onClick={() => onNav('buyers')}>Visi pasūtītāji →</button>
        </div>
      </div>

      <p className="muted small" style={{ marginTop: 12 }}>
        Karogs nav pierādījums — tās ir statistiskas norādes izpētei. Dati: {data.meta?.coverage ?? ''} · atjaunojas automātiski katru dienu.
      </p>
    </div>
  );
}
