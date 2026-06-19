import type { BuyerSummary, RiskResult } from '../types.ts';
import { buyerBand } from '../format.ts';

const barColor: Record<string, string> = {
  red: 'var(--red)', yellow: 'var(--yellow)', green: 'var(--green)', gray: 'var(--gray)',
};

const ROWS: { key: keyof BuyerSummary; label: string }[] = [
  { key: 'result', label: 'B1 · Viens pretendents' },
  { key: 'b2', label: 'B2 · Uzvarētāju koncentrācija' },
  { key: 'a', label: 'A · Sadalīšana' },
  { key: 'c', label: 'C · Vērtības novirze' },
  { key: 'e', label: 'E · Procedūra' },
  { key: 'd', label: 'D · Saistītās puses' },
  { key: 'g', label: 'G · Līguma grozījumi' },
];

export function RiskBreakdown({ buyer }: { buyer: BuyerSummary }) {
  return (
    <div className="breakdown">
      {ROWS.map((row) => {
        const r = buyer[row.key] as RiskResult;
        const band = buyerBand(r);
        const score = r.score;
        return (
          <div className="bd-row" key={row.key}>
            <div className="bd-label">{row.label}</div>
            <div className="bd-track">
              {score !== null && (
                <div className="bd-fill" style={{ width: `${score}%`, background: barColor[band.key] }} />
              )}
            </div>
            <div className="bd-val mono" style={{ color: score !== null ? barColor[band.key] : 'var(--muted)' }}>
              {score === null ? 'n/d' : score}
            </div>
          </div>
        );
      })}
    </div>
  );
}
