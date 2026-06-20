import { LV_REGION_PATHS } from '../lvRegions.ts';
import { pct, eur } from '../format.ts';

type Region = { key: string; contracts: number; singleBidRate: number; value: number; buyers: number; red: number };

// Lineāra interpolācija starp diviem hex toņiem.
function lerp(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
// Krāsa pēc viena-pretendenta likmes attiecīgajā diapazonā (zaļš → dzeltens → koraļļ).
function colorFor(rate: number, min: number, max: number): string {
  const t = max > min ? (rate - min) / (max - min) : 0.5;
  return t < 0.5 ? lerp('#cfe6d6', '#f2d79a', t * 2) : lerp('#f2d79a', '#e08a6f', (t - 0.5) * 2);
}

export function LatviaMap({ regions, onPick }: { regions: Region[]; onPick: (label: string) => void }) {
  const byKey = new Map(regions.map((r) => [r.key, r]));
  const rates = regions.map((r) => r.singleBidRate);
  const min = Math.min(...rates), max = Math.max(...rates);
  // Mazo/pārklājošos centra reģionu (Rīga, Pierīga) etiķešu nobīde, lai nesakrīt.
  const nudge: Record<string, [number, number]> = { Riga: [0, 22], Pieriga: [10, -26] };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, alignItems: 'center' }} className="lvmap-wrap">
      <svg viewBox="0 0 1000 620" width="100%" role="img" aria-label="Latvijas reģionu karte pēc viena pretendenta likmes">
        {LV_REGION_PATHS.map((rp) => {
          const r = byKey.get(rp.key);
          const fill = r ? colorFor(r.singleBidRate, min, max) : '#e9e1d4';
          return (
            <path key={rp.key} d={rp.d} fill={fill} stroke="#fff" strokeWidth="1.5"
              className="lvmap-region" tabIndex={0} role="button" aria-label={`${rp.label}: ${r ? pct(r.singleBidRate, 0) : '–'}`}
              onClick={() => onPick(rp.label)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(rp.label); } }} />
          );
        })}
        {LV_REGION_PATHS.map((rp) => {
          const r = byKey.get(rp.key);
          const [dx, dy] = nudge[rp.key] ?? [0, 0];
          const x = rp.cx + dx, y = rp.cy + dy;
          const txt = `${rp.label} ${r ? pct(r.singleBidRate, 0) : ''}`;
          return (
            <g key={rp.key + '-l'} pointerEvents="none">
              <rect x={x - txt.length * 4.2} y={y - 12} width={txt.length * 8.4} height={22} rx="5" fill="#ffffff" opacity="0.82" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="15" fontWeight="500" fill="#20302b">{txt}</text>
            </g>
          );
        })}
      </svg>

      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Krāsa = viena pretendenta likme (klikšķini reģionu → pasūtītāji)</div>
        {[...regions].sort((a, b) => b.singleBidRate - a.singleBidRate).map((r) => {
          const lbl = LV_REGION_PATHS.find((p) => p.key === r.key)?.label ?? r.key;
          return (
            <div key={r.key} className="lvmap-legrow clickable" tabIndex={0} role="button"
              onClick={() => onPick(lbl)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(lbl); } }}>
              <span className="lvmap-sw" style={{ background: colorFor(r.singleBidRate, min, max) }} />
              <span style={{ flex: 1 }}>{lbl}</span>
              <strong className="mono small">{pct(r.singleBidRate, 0)}</strong>
              <span className="muted small mono" style={{ width: 64, textAlign: 'right' }}>{r.buyers} pas.</span>
              <span className="muted small mono" style={{ width: 70, textAlign: 'right' }}>{eur(r.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
