import type { PersonEntry } from '../types.ts';
import { eur } from '../format.ts';

// Tīkls: persona (kreisā) → firmas (vidus) → pasūtītāji (labā).
// Pasūtītājs, kas savienots ar ≥2 firmām, iekrāsots — tā vizuāli redzams kopīgais pasūtītājs.
const trunc = (s: string | null, n: number) => !s ? '—' : s.length > n ? s.slice(0, n - 1) + '…' : s;

export function PersonNetwork({ person }: { person: PersonEntry }) {
  const companies = person.companies.slice(0, 10);
  // Unikālie pasūtītāji starp firmu top-pasūtītājiem + cik firmu uz tiem norāda.
  const buyerMap = new Map<string, { name: string; value: number; from: number[] }>();
  companies.forEach((c, ci) => (c.buyers ?? []).forEach((b) => {
    const k = b.name ?? '?';
    const x = buyerMap.get(k) ?? { name: k, value: 0, from: [] };
    x.value += b.value; if (!x.from.includes(ci)) x.from.push(ci);
    buyerMap.set(k, x);
  }));
  const buyers = [...buyerMap.values()].sort((a, b) => b.from.length - a.from.length || b.value - a.value).slice(0, 14);
  const buyerIdx = new Map(buyers.map((b, i) => [b.name, i]));

  const rowGap = 46, pad = 28;
  const rows = Math.max(companies.length, buyers.length, 1);
  const H = rows * rowGap + pad;
  const W = 900;
  const cx = { p: 70, c: 350, b: 600 };
  const colY = (i: number, n: number) => H / 2 + (i - (n - 1) / 2) * rowGap;
  const cyC = (i: number) => colY(i, companies.length);
  const cyB = (i: number) => colY(i, buyers.length);
  const pY = H / 2;

  return (
    <div className="person-net">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label="Personas saikņu tīkls">
        {/* malas persona→firma */}
        {companies.map((_, ci) => (
          <line key={'pc' + ci} x1={cx.p + 7} y1={pY} x2={cx.c - 6} y2={cyC(ci)} stroke="var(--line)" strokeWidth={1.2} />
        ))}
        {/* malas firma→pasūtītājs */}
        {companies.map((c, ci) => (c.buyers ?? []).map((b, bi) => {
          const k = b.name ?? '?'; const j = buyerIdx.get(k); if (j == null) return null;
          const shared = (buyerMap.get(k)?.from.length ?? 0) >= 2;
          return <line key={`cb${ci}-${bi}`} x1={cx.c + 6} y1={cyC(ci)} x2={cx.b - 6} y2={cyB(j)} stroke={shared ? '#c2902a' : 'var(--line)'} strokeWidth={shared ? 1.6 : 1} opacity={shared ? 0.85 : 0.5} />;
        }))}
        {/* persona */}
        <circle cx={cx.p} cy={pY} r={9} fill="var(--brand)" />
        <text x={cx.p} y={pY - 14} textAnchor="middle" className="net-lab net-lab-strong">{trunc(person.name, 22)}</text>
        {/* firmas */}
        {companies.map((c, ci) => (
          <g key={'c' + ci}>
            <circle cx={cx.c} cy={cyC(ci)} r={6} fill="var(--ink)" />
            <text x={cx.c} y={cyC(ci) - 11} textAnchor="middle" className="net-lab">{trunc(c.name, 30)}</text>
            <text x={cx.c} y={cyC(ci) + 16} textAnchor="middle" className="net-sub">{eur(c.value)}</text>
          </g>
        ))}
        {/* pasūtītāji */}
        {buyers.map((b, bi) => {
          const shared = b.from.length >= 2;
          return (
            <g key={'b' + bi}>
              <circle cx={cx.b} cy={cyB(bi)} r={5} fill={shared ? '#c2902a' : 'var(--muted)'} />
              <text x={cx.b + 11} y={cyB(bi) + 4} textAnchor="start" className={shared ? 'net-lab net-lab-hl' : 'net-lab'}>{trunc(b.name, 44)}</text>
            </g>
          );
        })}
      </svg>
      <p className="muted small" style={{ marginTop: 4 }}>
        <span className="net-key net-key-hl" /> iezīmēts = pasūtītājs, pie kura uzvarējušas ≥2 šīs personas firmas.
        Rādīti līdz 10 firmām un 14 pasūtītājiem (top pēc vērtības).
      </p>
    </div>
  );
}
