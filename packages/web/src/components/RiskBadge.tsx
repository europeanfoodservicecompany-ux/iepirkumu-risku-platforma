import type { BandKey } from '../format.ts';

export function RiskBadge({ band, label }: { band: BandKey; label: string }) {
  return (
    <span className={`badge ${band}`}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}
