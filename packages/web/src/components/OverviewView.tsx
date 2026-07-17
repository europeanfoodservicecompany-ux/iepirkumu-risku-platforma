import { useState } from 'react';
import { Term } from './Term.tsx';
import type { OverviewData, CartelPair } from '../types.ts';
import { pct, eur } from '../format.ts';
import { LatviaMap } from './LatviaMap.tsx';

const RISK = { red: 'var(--red)', yellow: 'var(--yellow)', green: 'var(--green)', none: '#c3bdb0' };

// Kompakta EUR vērtība lielajiem skaitļiem.
function compactEur(x: number): string {
  if (x >= 1e9) return '€' + (x / 1e9).toFixed(2).replace('.', ',') + ' mljrd.';
  if (x >= 1e6) return '€' + Math.round(x / 1e6) + ' milj.';
  return eur(x);
}

// SVG riņķa (donut) diagramma. Ārējais gredzens — riska sadalījums TIKAI izvērtētajiem pasūtītājiem
// (lai "nav datu" daļa vizuāli nedominētu). Iekšējais plānais gredzens — cik daļa vispār izvērtēta.
function Donut({ risk, none }: { risk: { label: string; value: number; color: string }[]; none: number }) {
  const evaluated = risk.reduce((s, x) => s + x.value, 0);
  const all = evaluated + none;
  const evalTotal = evaluated || 1;
  const R = 52, C = 2 * Math.PI * R;
  const Ri = 37, Ci = 2 * Math.PI * Ri;
  const covLen = (evaluated / (all || 1)) * Ci;
  let offset = 0;
  return (
    <svg viewBox="0 0 130 130" width="150" height="150" role="img" aria-label="Riska sadalījums izvērtētajiem pasūtītājiem">
      <g transform="translate(65,65) rotate(-90)">
        {risk.map((s) => {
          const len = (s.value / evalTotal) * C;
          const el = <circle key={s.label} r={R} fill="none" stroke={s.color} strokeWidth="17"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
        <circle r={Ri} fill="none" stroke="var(--ring-track)" strokeWidth="4" />
        <circle r={Ri} fill="none" stroke="#a89e8f" strokeWidth="4" strokeDasharray={`${covLen} ${Ci - covLen}`} />
      </g>
      <text x="65" y="60" textAnchor="middle" fontSize="21" fontWeight="500" fill="var(--ink)">{evaluated}</text>
      <text x="65" y="77" textAnchor="middle" fontSize="8.5" fill="var(--muted)">izvērtēti no {all}</text>
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
  const last = pts[pts.length - 1];
  // Tendence: pēdējo 6 mēn. vidējais pret iepriekšējiem 6 (procentpunktos, ne relatīvi — godīgāk pret sezonalitāti).
  const avg = (a: typeof pts) => a.reduce((s, p) => s + p.singleBidRate, 0) / (a.length || 1);
  const recent = pts.slice(-6), prior = pts.slice(-12, -6);
  const delta = recent.length >= 3 && prior.length >= 3 ? avg(recent) - avg(prior) : null;
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
      <circle cx={x(pts.length - 1)} cy={y(last.singleBidRate)} r="3.6" fill="var(--brand)" />
      <text x={x(pts.length - 1) - 6} y={y(last.singleBidRate) - 6} textAnchor="end" fontSize="10.5" fontWeight="600" fill="var(--brand)">{pct(last.singleBidRate, 0)}</text>
      {delta != null && Math.abs(delta) >= 0.02 && (
        <text x={padL + 2} y={padT + 10} fontSize="10.5" fontWeight="600" fill={delta > 0 ? 'var(--red)' : 'var(--green)'}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))} pp pēdējā pusgadā
        </text>
      )}
      {pts.map((p, i) => (i % labelEvery === 0 ? (
        <text key={p.month} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{p.month.slice(2)}</text>
      ) : null))}
    </svg>
  );
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return day && m ? `${day}.${m}.${y}.` : d;
}
const gadiWord = (n: number) => (n === 1 ? 'gads' : 'gadi');
const ligWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'līgums' : 'līgumi');

// Īss firmas vārds tīkla mezglam (izņem SIA/AS prefiksus, paņem raksturīgāko vārdu).
function shortName(s: string | null): string {
  if (!s) return '?';
  const clean = s.replace(/["'“”]/g, '').replace(/\b(SIA|AS|AAS|ADB|UAB|OÜ|Sabiedrība ar ierobežotu atbildību|Akciju sabiedrība)\b/gi, ' ').trim();
  const w = clean.split(/\s+/).filter(Boolean);
  return (w[0] ?? s).slice(0, 12);
}

// Hero paraksta vizualizācija: top karteļa pāris kā mini tīkls (divi galvenie + dekoratīvi mezgli).
function HeroNetwork({ pair, onOpen }: { pair: CartelPair; onOpen: () => void }) {
  return (
    <button className="hero-net" onClick={onOpen} aria-label={`Karteļa pazīmes: ${pair.a.name} un ${pair.b.name}`}>
      <div className="hero-net-label">{pair.type === 'cover' ? 'Seguma pazīme' : 'Rotācijas pazīme'} · pretendentu tīkls</div>
      <svg viewBox="0 0 280 156" width="100%" role="img" aria-hidden="true" style={{ overflow: 'visible' }}>
        {/* savienojumi */}
        <line x1="74" y1="66" x2="206" y2="66" stroke="var(--red)" strokeWidth="2.5" />
        <line x1="74" y1="66" x2="48" y2="126" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
        <line x1="74" y1="66" x2="140" y2="130" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
        <line x1="206" y1="66" x2="232" y2="126" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
        <line x1="140" y1="130" x2="232" y2="126" stroke="var(--line-strong)" strokeWidth="1.5" opacity="0.5" />
        {/* dekoratīvie (citi pretendenti) */}
        <circle cx="48" cy="126" r="10" fill="var(--card)" stroke="var(--line-strong)" />
        <circle cx="140" cy="130" r="10" fill="var(--card)" stroke="var(--line-strong)" />
        <circle cx="232" cy="126" r="10" fill="var(--card)" stroke="var(--line-strong)" />
        {/* galvenais pāris — tīri apļi, nosaukums VIRS */}
        <circle cx="74" cy="66" r="19" fill="var(--red-bg)" stroke="var(--red)" strokeWidth="1.8" />
        <circle cx="206" cy="66" r="19" fill="var(--red-bg)" stroke="var(--red)" strokeWidth="1.8" />
        <text x="74" y="32" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--red)">{shortName(pair.a.name)}</text>
        <text x="206" y="32" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--red)">{shortName(pair.b.name)}</text>
      </svg>
      <div className="hero-net-cap">{pair.coBids} kopīgi konkursi · {Math.round(pair.duoShare * 100)}% tikai šie divi →</div>
    </button>
  );
}

export function OverviewView({ data, cartelTop, onSelectBuyer, onSelectWinner, onPickSector, onPickRegion, onNav }: {
  data: OverviewData;
  cartelTop?: CartelPair | null;
  onSelectBuyer: (id: string) => void;
  onSelectWinner: (fileId: string) => void;
  onPickSector: (cpv2: string) => void;
  onPickRegion: (label: string) => void;
  onNav: (view: 'buyers' | 'sectors' | 'method' | 'cartel') => void;
}) {
  const nat = data.national.singleBidRate;
  const rd = data.riskDistribution;
  const [showFlags, setShowFlags] = useState(false); // sākumā 6, "Rādīt vairāk" → 12
  const [showLoyal, setShowLoyal] = useState(false);
  const riskSegs = [
    { label: 'Zems risks', value: rd.green, color: RISK.green },
    { label: 'Vidējs risks', value: rd.yellow, color: RISK.yellow },
    { label: 'Augsts risks', value: rd.red, color: RISK.red },
  ];
  const evaluated = rd.green + rd.yellow + rd.red || 1;
  const maxSec = Math.max(...data.topSectors.map((s) => s.singleBidRate), nat);

  return (
    <div>
      <div className={`hero${cartelTop ? ' hero-split' : ''}`}>
        <div className="hero-main">
          <h2 className="hero-h">Kur publiskajos iepirkumos vērts ieskatīties dziļāk</h2>
          <p className="hero-p">
            Šī ir neatkarīga vietne, kas analizē Latvijas publiskos iepirkumus un izceļ vājas konkurences un iespējama riska
            pazīmes. <strong>Karogs nav pierādījums</strong> — tā ir norāde izpētei. Sāc, meklējot konkrētu pasūtītāju vai
            piegādātāju (lauks augšā), vai ieej kādā no sarakstiem:
          </p>
          <div className="hero-actions">
            <button className="hero-btn primary" onClick={() => onNav('buyers')}>Augstākā riska pasūtītāji →</button>
            <button className="hero-btn" onClick={() => onNav('cartel')}>Karteļa pazīmes →</button>
            <button className="hero-btn" onClick={() => onNav('method')}>Kā tas darbojas →</button>
          </div>
        </div>
        {cartelTop && <HeroNetwork pair={cartelTop} onOpen={() => onNav('cartel')} />}
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-l">Iepirkumi</div><div className="kpi-v">{data.totals.procurements.toLocaleString('lv-LV')}</div><div className="kpi-sub">analizēti šajā periodā</div></div>
        <div className="kpi"><div className="kpi-l">Kopvērtība ≈</div><div className="kpi-v">{compactEur(data.totals.awardedValue)}</div><div className="kpi-sub">≈ €{Math.round(data.totals.awardedValue / 1.86e6).toLocaleString('lv-LV')} uz katru iedzīvotāju</div></div>
        <div className="kpi"><div className="kpi-l"><Term k="viena pretendenta likme">Viena pretendenta likme</Term></div><div className="kpi-v" style={{ color: 'var(--yellow)' }}>{pct(nat, 1)}</div><div className="kpi-sub">aptuveni katrs {nat > 0 ? Math.round(1 / nat) : '–'}. iepirkums bez konkurences</div></div>
        <div className="kpi"><div className="kpi-l">Augsta riska pasūtītāji</div><div className="kpi-v" style={{ color: 'var(--red)' }}>{rd.red} <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>/ {data.totals.buyers}</span></div><div className="kpi-sub">ar pietiekamu datu apjomu izvērtēti</div></div>
      </div>

      {data.recentFlags && data.recentFlags.length > 0 && (
        <div className="card ov-card" style={{ marginTop: 12 }}>
          <h3 className="ov-h">Jaunākie karogi</h3>
          <p className="muted small" style={{ marginTop: -4 }}>Nesen piešķirti līgumi ar skaidru riska pazīmi (viens pretendents, slēgts tirgus vai neparasta vērtība), jaunākie pirmie.</p>
          <div className="feed feed-grid">
            {data.recentFlags.slice(0, showFlags ? 12 : 6).map((f, i) => (
              <div key={i} className="feed-row">
                <span className="feed-date mono">{fmtDate(f.date)}</span>
                <div className="feed-mid">
                  <span className="feed-buyer clickable" tabIndex={0} role="button"
                    onClick={() => onSelectBuyer(f.buyerId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectBuyer(f.buyerId); } }}>{f.buyerName ?? f.buyerId}</span>
                  <span className="feed-arrow"> → </span>
                  {f.winnerFileId
                    ? <span className="feed-winner clickable" tabIndex={0} role="button" onClick={() => onSelectWinner(f.winnerFileId!)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectWinner(f.winnerFileId!); } }}>{f.winnerName ?? '—'}</span>
                    : <span className="feed-winner">{f.winnerName ?? '—'}</span>}
                  {f.subjectName && <div className="muted small" style={{ width: '100%', marginTop: 2 }}>{f.subjectName}</div>}
                  <div className="feed-tags">
                    {f.sector && <span className="sector-badge">{f.sector}</span>}
                    {f.euFunded && <span className="sector-badge" style={{ background: 'var(--brand)', color: '#fff' }} title="Iepirkums saistīts ar ES fondu līdzfinansētu projektu (CFLA dati)">ES fondi</span>}
                    {f.reasons.map((r, k) => <span key={k} className="note-tag note-high" style={{ margin: 0 }}>{r}</span>)}
                    {f.sourceUrl && <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="feed-eis">skatīt iepirkumu →</a>}
                  </div>
                </div>
                <span className="feed-val mono">{compactEur(f.value)}</span>
              </div>
            ))}
          </div>
          {!showFlags && data.recentFlags.length > 6 && (
            <button className="filter-btn" style={{ marginTop: 10 }} onClick={() => setShowFlags(true)}>Rādīt vairāk ({Math.min(12, data.recentFlags.length) - 6})</button>
          )}
        </div>
      )}

      {data.loyaltyPairs && data.loyaltyPairs.length > 0 && (
        <div className="card ov-card" style={{ marginTop: 12 }}>
          <h3 className="ov-h">Stabilākās pasūtītāju un piegādātāju attiecības</h3>
          <p className="muted small" style={{ marginTop: -4 }}>Pasūtītāji, kuri vairāku gadu garumā ievērojamu daļu iepirkumu izdevumu novirza vienam piegādātājam. Ilgstoša sadarbība pati par sevi nav pārkāpums, taču tā var liecināt par ierobežotu konkurenci konkrētajā tirgū.</p>
          <div className="feed feed-grid">
            {data.loyaltyPairs.slice(0, showLoyal ? 12 : 6).map((p, i) => (
              <div key={i} className="feed-row">
                <div className="feed-mid">
                  <span className="feed-buyer clickable" tabIndex={0} role="button"
                    onClick={() => onSelectBuyer(p.buyerId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectBuyer(p.buyerId); } }}>{p.buyerName ?? p.buyerId}</span>
                  <span className="feed-arrow"> → </span>
                  {p.fileId
                    ? <span className="feed-winner clickable" tabIndex={0} role="button" onClick={() => onSelectWinner(p.fileId!)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectWinner(p.fileId!); } }}>{p.supplier ?? '—'}</span>
                    : <span className="feed-winner">{p.supplier ?? '—'}</span>}
                  <div className="feed-tags">
                    <span className="note-tag note-high" style={{ margin: 0 }}>{Math.round(p.share * 100)} % no kopējā iepirkumu apjoma</span>
                    <span className="sector-badge">{p.from}–{p.to} · {p.years} {gadiWord(p.years)}</span>
                    <span className="sector-badge">{p.contracts} {ligWord(p.contracts)}</span>
                    {p.singleBidRate >= 0.5 && <span className="note-tag note-med" style={{ margin: 0 }}>{Math.round(p.singleBidRate * 100)} % iepirkumu saņemts tikai viens pretendents</span>}
                  </div>
                </div>
                <span className="feed-val mono">{compactEur(p.value)}</span>
              </div>
            ))}
          </div>
          {!showLoyal && data.loyaltyPairs.length > 6 && (
            <button className="filter-btn" style={{ marginTop: 10 }} onClick={() => setShowLoyal(true)}>Rādīt vairāk ({Math.min(12, data.loyaltyPairs.length) - 6})</button>
          )}
        </div>
      )}

      <div className="ov-row">
        <div className="card ov-card">
          <h3 className="ov-h">Pasūtītāju riska sadalījums</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Donut risk={riskSegs} none={rd.none} />
            <div style={{ flex: '1 1 130px' }}>
              {riskSegs.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 13 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <span className="muted mono small" style={{ width: 34, textAlign: 'right' }}>{pct(s.value / evaluated, 0)}</span>
                  <strong className="mono" style={{ width: 30, textAlign: 'right' }}>{s.value}</strong>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 0', marginTop: 4, borderTop: '1px solid var(--line)', fontSize: 13 }}>
                <span style={{ width: 11, height: 11, borderRadius: 2, background: RISK.none, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>Nav pietiekamu datu <span className="muted small">(netiek vērtēti)</span></span>
                <strong className="mono" style={{ width: 30, textAlign: 'right' }}>{rd.none}</strong>
              </div>
              <p className="muted small" style={{ margin: '8px 0 0' }}>Procenti — no {rd.green + rd.yellow + rd.red} pasūtītājiem ar pietiekamu datu apjomu.</p>
            </div>
          </div>
        </div>

        <div className="card ov-card">
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
      </div>

      <div className="ov-row" style={{ marginTop: 12 }}>
        <div className="card ov-card">
          <h3 className="ov-h">Nozares ar vājāko konkurenci</h3>
          <p className="muted small" style={{ marginTop: -4 }}>Zaļā svītra joslā — nacionālais vidējais ({pct(nat, 0)}); jo tālāk josla stiepjas pāri tai, jo vājāka konkurence nozarē.</p>
          {data.topSectors.map((s) => {
            const col = s.singleBidRate >= nat * 1.7 ? 'var(--red)' : s.singleBidRate >= nat * 1.3 ? 'var(--yellow)' : 'var(--green)';
            return (
              <div key={s.cpv2} className="ov-secrow clickable" tabIndex={0} role="button"
                onClick={() => onPickSector(s.cpv2)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPickSector(s.cpv2); } }}>
                <span className="ov-secname">{s.label}</span>
                <span className="bar" style={{ flex: 1, position: 'relative', overflow: 'visible' }}>
                  <span style={{ width: `${(s.singleBidRate / maxSec) * 100}%`, background: col }} />
                  <span aria-hidden="true" title={`nacionālais vidējais ${pct(nat, 0)}`}
                    style={{ position: 'absolute', left: `${(nat / maxSec) * 100}%`, top: -2, bottom: -2, width: 2, background: 'var(--brand)', borderRadius: 1 }} />
                </span>
                <strong className="mono small" style={{ color: col, width: 38, textAlign: 'right' }}>{pct(s.singleBidRate, 0)}</strong>
              </div>
            );
          })}
        </div>
        <div className="card ov-card">
          <h3 className="ov-h">Viena pretendenta likme laikā (pa mēnešiem)</h3>
          <TrendLine data={data.timeline} national={nat} />
        </div>
      </div>

      {data.regions && data.regions.length > 0 && (
        <div className="card ov-card" style={{ marginTop: 12 }}>
          <h3 className="ov-h">Reģioni — viena pretendenta likme</h3>
          <LatviaMap regions={data.regions} onPick={onPickRegion} />
        </div>
      )}

      <p className="muted small" style={{ marginTop: 12 }}>
        Karogs nav pierādījums — tās ir statistiskas norādes izpētei. Dati: {data.meta?.coverage ?? ''} · atjaunojas automātiski katru dienu.
      </p>
    </div>
  );
}
