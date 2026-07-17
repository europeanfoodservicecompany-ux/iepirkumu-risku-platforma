import { useState } from 'react';
import type { QualityData } from '../types.ts';

// Datu kvalitātes monitors — publisks skats uz IUB atvērto datu nepilnībām.
// Kritizē DATUS, ne iestādi: katrai problēmai konkrēti paziņojumu identifikatori, ko var izlabot pie avota.
export function QualityView({ data }: { data: QualityData | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <div className="card"><p className="muted">Ielādē datu kvalitātes rādītājus…</p></div>;

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Datu kvalitātes monitors</h2>
      <p className="muted small" style={{ maxWidth: 780, marginTop: 0 }}>
        Šis skats rāda, cik daudz Iepirkumu uzraudzības biroja atvērto datu ierakstu ir nepilnīgi vai savstarpēji pretrunīgi.
        Mērķis ir <strong>palīdzēt uzlabot datus</strong>, ne kritizēt iestādi — katrai problēmai zemāk ir konkrēti paziņojumu
        identifikatori, ko var izlabot pie avota. Jo tīrāki un pilnīgāki dati, jo mazāk trokšņa publiskajā analīzē.
      </p>

      <div className="section grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 0, marginBottom: 16 }}>
        <div className="card stat"><div className="num">{data.totals.lots.toLocaleString('lv-LV')}</div><div className="lbl">Iepirkuma daļas</div></div>
        <div className="card stat"><div className="num">{data.totals.awarded.toLocaleString('lv-LV')}</div><div className="lbl">Piešķirti līgumi</div></div>
        <div className="card stat"><div className="num">{data.totals.buyers.toLocaleString('lv-LV')}</div><div className="lbl">Pasūtītāji</div></div>
      </div>

      {data.issues.map((iss) => {
        const isOpen = open === iss.key;
        return (
          <div className="card" key={iss.key} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', cursor: iss.samples.length ? 'pointer' : 'default' }}
              onClick={() => iss.samples.length && setOpen(isOpen ? null : iss.key)}
              role={iss.samples.length ? 'button' : undefined} tabIndex={iss.samples.length ? 0 : undefined}
              onKeyDown={(e) => { if (iss.samples.length && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(isOpen ? null : iss.key); } }}>
              <div style={{ fontWeight: 600 }}>{iss.samples.length ? (isOpen ? '▾ ' : '▸ ') : ''}{iss.label} <span className="muted small">({iss.scope})</span></div>
              <div className="mono" style={{ whiteSpace: 'nowrap' }}>
                <strong style={{ color: iss.count > 0 ? 'var(--red-ink)' : 'var(--muted)' }}>{iss.count.toLocaleString('lv-LV')}</strong>
                <span className="muted small"> · {iss.pct}%</span>
              </div>
            </div>
            {isOpen && iss.samples.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p className="muted small" style={{ marginTop: 0, marginBottom: 6 }}>Pirmie {iss.samples.length} paziņojumu identifikatori (pilnu sarakstu varam nodot IUB):</p>
                <div className="member-list">
                  {iss.samples.map((s, k) => (
                    <div key={k} className="memrow" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span className="mono small" style={{ wordBreak: 'break-all' }}>{s.id}</span>
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="iublink small" style={{ whiteSpace: 'nowrap' }}>skatīt →</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="muted small" style={{ marginTop: 14, maxWidth: 780 }}>
        Piezīme: procenti aprēķināti no piešķirtajiem līgumiem vai visām daļām atbilstoši katras rindas apjomam. Pārtrauktos
        iepirkumus tukšo lauku aprēķinā neieskaitām. Republicēti (laboti) paziņojumi tiek dedublēti; «pretrunīgas summas»
        norāda gadījumus, kur vienā procedūrā dažādos ierakstos ir atšķirīgas vērtības.
        Dati: {data.meta?.coverage ?? ''}{data.meta?.generatedAt ? ` · atjaunots ${data.meta.generatedAt.slice(0, 10)}` : ''}.
      </p>
    </div>
  );
}
