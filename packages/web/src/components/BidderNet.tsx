import type { CartelPair, CoBidder } from '../types.ts';

// Īss firmas vārds tīkla mezglam (izņem SIA/AS prefiksus).
function shortName(s: string | null, max = 13): string {
  if (!s) return '?';
  const clean = s.replace(/["'“”]/g, '').replace(/\b(SIA|AS|AAS|ADB|UAB|OÜ|Sabiedrība ar ierobežotu atbildību|Akciju sabiedrība|VAS|PS)\b/gi, ' ').trim();
  const w = clean.split(/\s+/).filter(Boolean);
  return (w[0] ?? s).slice(0, max);
}

// Pāra tīkls — divi galvenie pretendenti + daži dekoratīvi (karteļa pāris). Nosaukumi VIRS apļiem.
export function PairNet({ pair }: { pair: CartelPair }) {
  return (
    <svg viewBox="0 0 280 150" width="100%" role="img" aria-label={`${pair.a.name} un ${pair.b.name} pretendentu tīkls`} style={{ overflow: 'visible', maxWidth: 360 }}>
      <line x1="74" y1="64" x2="206" y2="64" stroke="var(--red)" strokeWidth="2.6" />
      <line x1="74" y1="64" x2="48" y2="124" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
      <line x1="74" y1="64" x2="140" y2="128" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
      <line x1="206" y1="64" x2="232" y2="124" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
      <line x1="140" y1="128" x2="232" y2="124" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="48" cy="124" r="9" fill="var(--card)" stroke="var(--line-strong)" />
      <circle cx="140" cy="128" r="9" fill="var(--card)" stroke="var(--line-strong)" />
      <circle cx="232" cy="124" r="9" fill="var(--card)" stroke="var(--line-strong)" />
      <circle cx="74" cy="64" r="19" fill="var(--red-bg)" stroke="var(--red)" strokeWidth="1.8" />
      <circle cx="206" cy="64" r="19" fill="var(--red-bg)" stroke="var(--red)" strokeWidth="1.8" />
      <text x="74" y="32" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--red)">{shortName(pair.a.name)}</text>
      <text x="206" y="32" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--red)">{shortName(pair.b.name)}</text>
    </svg>
  );
}

// Zvaigznes tīkls — piegādātājs centrā + biežākie kopā-pretendenti rindā zem tā.
// Kodējums: saites biezums ∝ kopā-dalībām; SARKANS (+pārtraukts gredzens) = SAISTĪTS pretendents
// (kopīga persona/holdings) — fiktīvas konkurences pazīme. Uzvaru attiecība (mēs:viņi) zem katra mezgla.
export function StarNet({ centerName, others }: { centerName: string | null; others: CoBidder[] }) {
  const list = others.slice(0, 6);
  if (!list.length) return null;
  const W = 340, H = 160, cx = W / 2, cy = 34, by = 112;
  const maxN = Math.max(...list.map((o) => o.coBids), 1);
  const xs = list.map((_, i) => (list.length === 1 ? cx : 30 + (i * (W - 60)) / (list.length - 1)));
  const anyRelated = list.some((o) => o.related);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Kopā-pretendentu tīkls" style={{ overflow: 'visible' }}>
        {list.map((o, i) => (
          <line key={'e' + i} x1={cx} y1={cy} x2={xs[i]} y2={by}
            stroke={o.related ? 'var(--red)' : 'var(--line-strong)'} strokeWidth={1 + 2.6 * (o.coBids / maxN)}
            opacity={o.related ? 0.9 : 0.75} />
        ))}
        {list.map((o, i) => {
          const r = 6 + 5 * (o.coBids / maxN);
          return (
            <g key={'n' + i}>
              <title>{`${o.name ?? o.reg} · ${o.coBids} kopīgi konkursi · uzvaras ${o.weWon}:${o.theyWon}${o.related ? ` · saistīts (${o.related === 'persona' ? 'kopīga persona' : 'kopīgs holdings'})` : ''}`}</title>
              {o.related && <circle cx={xs[i]} cy={by} r={r + 3.5} fill="none" stroke="var(--red)" strokeWidth="1.3" strokeDasharray="3 2" />}
              <circle cx={xs[i]} cy={by} r={r} fill={o.related ? 'var(--red-bg)' : 'var(--bg-2)'} stroke={o.related ? 'var(--red)' : 'var(--line-strong)'} />
              <text x={xs[i]} y={by + r + 14} textAnchor="middle" fontSize="9.5" fontWeight={o.related ? 600 : 400} fill={o.related ? 'var(--red-ink)' : 'var(--ink-soft)'}>{shortName(o.name, 11)}</text>
              <text x={xs[i]} y={by + r + 25} textAnchor="middle" fontSize="8.5" fill="var(--muted)" className="mono">{o.weWon}:{o.theyWon}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="20" fill="var(--brand-bg)" stroke="var(--brand2)" strokeWidth="1.8" />
        <text x={cx} y={cy + 1} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--brand-ink)">{shortName(centerName, 12)}</text>
      </svg>
      <div className="muted small" style={{ marginTop: 2, lineHeight: 1.5 }}>
        Līnijas biezums — kopīgo konkursu skaits · skaitļi zem mezgla — uzvaras (šis&nbsp;:&nbsp;otrs) kopīgajos konkursos
        {anyRelated && <> · <span style={{ color: 'var(--red-ink)', fontWeight: 600 }}>sarkans gredzens</span> — saistīts pretendents (kopīgs īpašnieks vai holdings)</>}
      </div>
    </div>
  );
}
