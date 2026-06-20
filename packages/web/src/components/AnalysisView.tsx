import { useMemo } from 'react';
import type { IndexBuyer, OverviewData, MarketsData } from '../types.ts';
import { pct, eur } from '../format.ts';

// ── Krāsu palīgi ──
function lerp(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function scoreColor(v: number): string {
  const t = v / 100;
  return t < 0.5 ? lerp([238, 241, 234], [236, 201, 138], t * 2) : lerp([236, 201, 138], [207, 83, 64], (t - 0.5) * 2);
}
function rateColorBin(x: number): string { return x > 0.4 ? 'var(--red)' : x >= 0.2 ? 'var(--yellow)' : 'var(--green)'; }

// ── 1. Indikatoru siltuma karte ──
function Heatmap({ buyers, onSelect }: { buyers: IndexBuyer[]; onSelect: (id: string) => void }) {
  const cols: { k: 'B' | 'A' | 'C' | 'G' | 'D' | 'E' }[] = [{ k: 'B' }, { k: 'A' }, { k: 'C' }, { k: 'G' }, { k: 'D' }, { k: 'E' }];
  const rows = useMemo(() => [...buyers].filter((b) => b.combinedScore != null).sort((a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0)).slice(0, 15), [buyers]);
  return (
    <div className="table-wrap"><table className="heat-tbl">
      <thead><tr><th style={{ textAlign: 'left' }}>Pasūtītājs</th>{cols.map((c) => <th key={c.k} title={c.k}>{c.k}</th>)}<th>Kopā</th></tr></thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.buyerId} className="clickable" tabIndex={0} role="button" aria-label={b.buyerName ?? b.buyerId}
            onClick={() => onSelect(b.buyerId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(b.buyerId); } }}>
            <td className="heat-name">{b.buyerName ?? b.buyerId}</td>
            {cols.map((c) => { const v = b.layerScores[c.k] ?? 0; return <td key={c.k} className="heat-cell" style={{ background: scoreColor(v), color: v >= 80 ? '#fff' : '#20302b' }}>{v}</td>; })}
            <td className="heat-cell" style={{ background: scoreColor(b.combinedScore ?? 0), color: (b.combinedScore ?? 0) >= 60 ? '#fff' : '#20302b', fontWeight: 700 }}>{b.combinedScore}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

// ── 2. Sezonalitātes kalendārs ──
function Seasonality({ timeline }: { timeline: OverviewData['timeline'] }) {
  const map = new Map(timeline.map((t) => [t.month, t.singleBidRate]));
  const years = [...new Set(timeline.map((t) => t.month.slice(0, 4)))];
  const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jūn', 'Jūl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const min = 0.19, max = 0.29;
  const col = (v: number) => { const t = Math.max(0, Math.min(1, (v - min) / (max - min))); return t < 0.5 ? lerp([207, 230, 214], [242, 215, 154], t * 2) : lerp([242, 215, 154], [224, 138, 111], (t - 0.5) * 2); };
  return (
    <div className="table-wrap"><table className="cal-tbl">
      <thead><tr><th></th>{mn.map((m) => <th key={m}>{m}</th>)}</tr></thead>
      <tbody>
        {years.map((y) => (
          <tr key={y}><td className="cal-y">{y}</td>
            {mn.map((_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`; const v = map.get(k); return <td key={i} className="cal-cell" style={v != null ? { background: col(v) } : { background: 'transparent' }}>{v != null ? Math.round(v * 100) : ''}</td>; })}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}

// ── 3. Izkliede: viena-pretendenta likme pret tēriņu ──
function Scatter({ buyers, onSelect }: { buyers: IndexBuyer[]; onSelect: (id: string) => void }) {
  const pts = useMemo(() => buyers.filter((b) => (b.contracts ?? 0) >= 30 && (b.value ?? 0) >= 1e6 && b.singleBidRate != null)
    .map((b) => ({ id: b.buyerId, x: (b.singleBidRate as number), y: (b.value as number) / 1e6, c: b.contracts as number, n: b.buyerName ?? b.buyerId }))
    .sort((a, b) => b.y - a.y).slice(0, 90), [buyers]);
  const W = 680, H = 360, pl = 44, pr = 12, pt = 12, pb = 34;
  const X = (r: number) => pl + (r / 0.7) * (W - pl - pr);
  const Y = (v: number) => { const t = (Math.log10(Math.max(0.5, v)) - Math.log10(0.5)) / (Math.log10(2500) - Math.log10(0.5)); return pt + (1 - t) * (H - pt - pb); };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Izkliede: viena pretendenta likme pret tēriņu">
      {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((t) => <g key={t}><line x1={X(t)} x2={X(t)} y1={pt} y2={H - pb} stroke="var(--line)" /><text x={X(t)} y={H - pb + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">{Math.round(t * 100)}%</text></g>)}
      {[1, 10, 100, 1000].map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} stroke="var(--line)" /><text x={pl - 6} y={Y(v) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{v}</text></g>)}
      <text x={(W) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--muted)">Viena pretendenta likme →</text>
      {pts.map((p) => (
        <circle key={p.id} cx={X(p.x)} cy={Y(p.y)} r={Math.max(4, Math.sqrt(p.c) / 3.2)} fill={rateColorBin(p.x)} fillOpacity="0.55" stroke={rateColorBin(p.x)} strokeWidth="1"
          className="clickable" tabIndex={0} role="button" onClick={() => onSelect(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.id); } }}>
          <title>{`${p.n}: ${pct(p.x, 0)} viena pret., ${Math.round(p.y)} milj. €, ${p.c} līg.`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── 4. Slēgto tirgu burbuļi ──
function MarketBubbles({ markets }: { markets: MarketsData['markets'] }) {
  const top = markets.slice(0, 14);
  const W = 680, H = 360, pl = 46, pr = 14, pt = 14, pb = 34;
  const X = (r: number) => pl + r * (W - pl - pr);
  const Y = (h: number) => pt + (1 - h) * (H - pt - pb);
  const col = (sc: number) => sc >= 70 ? 'var(--red)' : sc >= 60 ? 'var(--yellow)' : 'var(--green)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Slēgtie tirgi: koncentrācija pret konkurenci">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={'x' + t}><line x1={X(t)} x2={X(t)} y1={pt} y2={H - pb} stroke="var(--line)" /><text x={X(t)} y={H - pb + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">{Math.round(t * 100)}%</text></g>)}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={'y' + t}><line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="var(--line)" /><text x={pl - 6} y={Y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text></g>)}
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--muted)">Viena pretendenta likme →</text>
      <text x={12} y={pt + 4} fontSize="11" fill="var(--muted)" transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">Koncentrācija (HHI)</text>
      {top.map((m) => (
        <circle key={m.cpv} cx={X(m.singleBidRate)} cy={Y(m.hhi)} r={Math.max(6, Math.sqrt(m.awardedValue / 1e6) * 4 + 5)} fill={col(m.score)} fillOpacity="0.5" stroke={col(m.score)} strokeWidth="1">
          <title>{`${m.label}: ${pct(m.singleBidRate, 0)} viena pret., HHI ${m.hhi}, ${eur(m.awardedValue)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function AnalysisView({ buyers, overview, markets, onSelectBuyer }: {
  buyers: IndexBuyer[]; overview: OverviewData; markets: MarketsData | null; onSelectBuyer: (id: string) => void;
}) {
  return (
    <div>
      <p className="muted small" style={{ marginTop: 0 }}>Vizuāla datu analīze. Karogs nav pierādījums — tās ir statistiskas norādes izpētei.</p>

      <div className="card ov-card">
        <h3 className="ov-h">Indikatoru siltuma karte — augstākā riska pasūtītāji</h3>
        <p className="muted small" style={{ marginTop: 0 }}>Katra šūna = indikatora rezultāts. Svarīgākie ir tie, kas iedegas vairākos indikatoros vienlaikus. Klikšķini rindu → profils.</p>
        <Heatmap buyers={buyers} onSelect={onSelectBuyer} />
      </div>

      <div className="card ov-card" style={{ marginTop: 12 }}>
        <h3 className="ov-h">Konkurence pret tēriņu</h3>
        <p className="muted small" style={{ marginTop: 0 }}>Katrs burbulis = pasūtītājs (lielums = līgumu skaits). Augšā pa labi = daudz tērē + vāja konkurence. Y ass logaritmiska. Klikšķini → profils.</p>
        <Scatter buyers={buyers} onSelect={onSelectBuyer} />
      </div>

      <div className="card ov-card" style={{ marginTop: 12 }}>
        <h3 className="ov-h">Sezonalitāte — viena pretendenta likme pa mēnešiem</h3>
        <Seasonality timeline={overview.timeline} />
      </div>

      <div className="card ov-card" style={{ marginTop: 12 }}>
        <h3 className="ov-h">Slēgtie tirgi — koncentrācija pret konkurenci</h3>
        <p className="muted small" style={{ marginTop: 0 }}>Katrs burbulis = CPV tirgus (lielums = kopvērtība). Augšā pa labi = monopols bez konkurences.</p>
        {markets ? <MarketBubbles markets={markets.markets} /> : <div className="loading">Ielādē tirgus…</div>}
      </div>
    </div>
  );
}
