// Termina paskaidrojums uz vietas (inline), kur lietotājs to satiek — ne tikai metodoloģijas lapā.
// Nespeciālistam HHI/CPV/z-vērtība nav saprotami. Desktopā — hover (title); mobilajā/skārienā —
// klikšķis atver popover (title uz skārienekrāna nedara neko).
import { useState } from 'react';

const DEFS: Record<string, string> = {
  HHI: 'Koncentrācijas indekss (Herfindāla–Hiršmana). Jo augstāks (līdz 10 000), jo vairāk tirgu kontrolē daži uzvarētāji. Virs ~2500 = augsta koncentrācija.',
  CPV: 'ES vienotais iepirkumu vārdnīcas (CPV) kods — klasificē, ko iepērk (piem. būvdarbi, pārtika, IT).',
  'z-vērtība': 'Cik standartnoviržu vērtība atšķiras no līdzīgu iepirkumu vidējās. z≥2,5 = neparasti augsta nozarē.',
  'viena pretendenta likme': 'Cik liela daļa iepirkumu izlemta ar tikai vienu pretendentu — galvenā vājas konkurences pazīme.',
};
export function Term({ k, children }: { k: keyof typeof DEFS | string; children?: React.ReactNode }) {
  const def = DEFS[k] ?? '';
  const [open, setOpen] = useState(false);
  if (!def) return <>{children ?? k}</>;
  const toggle = (e: React.SyntheticEvent) => { e.stopPropagation(); setOpen((o) => !o); };
  return (
    <span className="term" tabIndex={0} role="button" aria-expanded={open}
      title={def} aria-label={`${children ?? k}: ${def}`}
      onClick={toggle}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } else if (e.key === 'Escape') setOpen(false); }}>
      {children ?? k}<sup className="term-i" aria-hidden="true">ⓘ</sup>
      {open && <span className="term-pop" role="tooltip">{def}</span>}
    </span>
  );
}
