import { RiskNote } from './RiskNote.tsx';
import { useEffect, useMemo, useState } from 'react';
import type { WinnersIndex, WinnerIndexEntry } from '../types.ts';
import { eur, pct, downloadCsv, norm, tokenMatch, parseSearch, wilsonLower, sampleClass } from '../format.ts';

// Viena pretendenta likmes ticamā apakšējā robeža (Vilsons) — mazā izlase sarūk, tāpēc 1/1 nekarogo sarkanu.
const sbLower = (w: { singleBidRate: number; contracts: number }) => wilsonLower(Math.round(w.singleBidRate * w.contracts), w.contracts);

const PAGE = 60;
type SortKey = 'value' | 'contracts' | 'buyers' | 'singleBid' | 'dependence' | 'name';

// Vērtības joslas filtram (EUR).
const VALUE_BANDS: { k: string; l: string; min: number; max: number }[] = [
  { k: 'all', l: 'Jebkura vērtība', min: 0, max: Infinity },
  { k: 's', l: '< 50 tūkst.', min: 0, max: 50000 },
  { k: 'm', l: '50 tūkst. – 1 milj.', min: 50000, max: 1000000 },
  { k: 'l', l: '1 – 10 milj.', min: 1000000, max: 10000000 },
  { k: 'xl', l: '> 10 milj.', min: 10000000, max: Infinity },
];

function Hi({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = norm(text).indexOf(term);
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

export function SupplierView({ data, onSelect, sectorFilter, onClearSector }: { data: WinnersIndex; onSelect: (fileId: string) => void; sectorFilter?: string | null; onClearSector?: () => void }) {
  // Sākotnējie filtri no URL (linkojami skati — filtri saglabājas hash query un nepazūd pārlādējot).
  const sp = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const [query, setQuery] = useState(sp.get('q') ?? '');
  const [sector, setSector] = useState(sp.get('sec') ?? 'all');
  const [band, setBand] = useState(sp.get('band') ?? 'all');
  const [minContracts, setMinContracts] = useState(sp.has('min') ? Number(sp.get('min')) : 5);
  const [addrOnly, setAddrOnly] = useState(sp.get('addr') === '1');
  const [source, setSource] = useState<'all' | 'eu' | 'noeu'>(sp.get('src') === 'eu' || sp.get('src') === 'noeu' ? (sp.get('src') as 'eu' | 'noeu') : 'all');
  const [offshoreOnly, setOffshoreOnly] = useState(sp.get('off') === '1');
  const [homeAdvOnly, setHomeAdvOnly] = useState(sp.get('home') === '1');
  const [capGapOnly, setCapGapOnly] = useState(sp.get('capgap') === '1');
  const [lowCapMax, setLowCapMax] = useState(sp.has('lowcap') ? Number(sp.get('lowcap')) : 0); // 0=izsl., citādi max darbinieku skaits
  const [loTurnMax, setLoTurnMax] = useState(sp.has('loturn') ? Number(sp.get('loturn')) : 0); // 0=izsl., citādi max apgrozījums (€)
  // "Papildu (riska) filtri" — sākumā atvērti, ja kāds no tiem jau aktīvs (piem. no linkotas URL).
  const [showAdv, setShowAdv] = useState(sp.get('addr') === '1' || sp.get('off') === '1' || sp.get('home') === '1' || sp.get('capgap') === '1' || sp.has('lowcap') || sp.has('loturn'));
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(() => {
    const s = sp.get('sort');
    if (s && s.includes(':')) { const [k, d] = s.split(':'); return { key: k as SortKey, dir: d === 'asc' ? 'asc' : 'desc' }; }
    return { key: 'value', dir: 'desc' };
  });
  const [limit, setLimit] = useState(PAGE);
  // Strukturētā meklēšana: reg:… cpv:… >summa <summa; pārējais paliek nosaukuma/reģ.nr brīvais teksts.
  const sq = parseSearch(query);
  const term = norm(sq.raw.trim());
  const tokens = sq.tokens;
  const active = !!term || sq.structured; // vai meklēšana aktīva (tad ignorē min. līgumu slieksni)
  void onClearSector;
  // Kad ienāk nozares filtrs no Nozaru cilnes — pielieto to (un atļauj visus piegādātājus).
  useEffect(() => { if (sectorFilter) { setSector(sectorFilter); setMinContracts(1); setLimit(PAGE); } }, [sectorFilter]);

  // Saglabā filtrus URL hash query (linkojami, nepazūd pārlādējot). replaceState → bez vēstures piesārņojuma un bez hashchange.
  useEffect(() => {
    if (!window.location.hash.startsWith('#/suppliers')) return;
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (sector !== 'all') p.set('sec', sector);
    if (band !== 'all') p.set('band', band);
    if (minContracts !== 5) p.set('min', String(minContracts));
    if (addrOnly) p.set('addr', '1');
    if (source !== 'all') p.set('src', source);
    if (offshoreOnly) p.set('off', '1');
    if (homeAdvOnly) p.set('home', '1');
    if (capGapOnly) p.set('capgap', '1');
    if (lowCapMax) p.set('lowcap', String(lowCapMax));
    if (loTurnMax) p.set('loturn', String(loTurnMax));
    if (!(sort.key === 'value' && sort.dir === 'desc')) p.set('sort', `${sort.key}:${sort.dir}`);
    const qs = p.toString();
    const target = qs ? `#/suppliers?${qs}` : '#/suppliers';
    if (window.location.hash !== target) history.replaceState(null, '', target);
  }, [query, sector, band, minContracts, addrOnly, source, offshoreOnly, homeAdvOnly, capGapOnly, lowCapMax, loTurnMax, sort]);

  // Nozaru saraksts no datiem.
  const sectors = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of data.winners) if (w.sectorCpv2) m.set(w.sectorCpv2, w.sectorLabel ?? w.sectorCpv2);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'lv'));
  }, [data]);

  const vb = VALUE_BANDS.find((b) => b.k === band)!;
  const filtered = useMemo(() => data.winners.filter((w) => {
    if (term && !tokenMatch(norm(`${w.winnerName ?? ''} ${w.winnerId}`), tokens)) return false;
    // Strukturētie prefiksi: reg: (reģ.nr sākums), cpv: (nozares CPV2), >summa/<summa (kopvērtība).
    if (sq.reg && !String(w.winnerId).replace(/\D/g, '').includes(sq.reg)) return false;
    if (sq.cpv && (w.sectorCpv2 ?? '') !== sq.cpv.slice(0, 2)) return false;
    if (sq.minVal != null && w.value < sq.minVal) return false;
    if (sq.maxVal != null && w.value > sq.maxVal) return false;
    if (sector !== 'all' && w.sectorCpv2 !== sector) return false;
    if (w.value < vb.min || w.value >= vb.max) return false;
    // Kad meklē (pēc nosaukuma/reģ.nr vai ar prefiksu), līgumu skaita slieksni neņem vērā — citādi konkrēts
    // piegādātājs ar <5 līgumiem "pazūd" un izskatās, ka meklēšana nestrādā.
    if (!active && w.contracts < minContracts) return false;
    if (addrOnly && !w.sharedAddr) return false;
    if (source === 'eu' && !w.cfla) return false;
    if (source === 'noeu' && w.cfla) return false;
    if (offshoreOnly && !w.offshore) return false;
    if (homeAdvOnly && !w.homeAdv) return false;
    if (capGapOnly && !w.capGap) return false;
    if (lowCapMax && (w.lowCapEmp == null || w.lowCapEmp > lowCapMax)) return false;
    if (loTurnMax && (w.loTurn == null || w.loTurn >= loTurnMax)) return false;
    return true;
  }), [data, term, tokens, sq.reg, sq.cpv, sq.minVal, sq.maxVal, active, sector, band, minContracts, vb, addrOnly, source, offshoreOnly, homeAdvOnly, capGapOnly, lowCapMax, loTurnMax]);

  const rows = useMemo(() => {
    const val = (w: WinnerIndexEntry): number | string =>
      sort.key === 'value' ? w.value : sort.key === 'contracts' ? w.contracts : sort.key === 'buyers' ? w.buyers
        : sort.key === 'singleBid' ? sbLower(w) : sort.key === 'dependence' ? w.topBuyerShare : (w.winnerName ?? w.winnerId);
    return [...filtered].sort((a, b) => {
      const va = val(a), vb2 = val(b);
      if (typeof va === 'string' || typeof vb2 === 'string') return String(va).localeCompare(String(vb2), 'lv') * (sort.dir === 'asc' ? 1 : -1);
      return (va - vb2) * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [filtered, sort]);

  const shown = rows.slice(0, limit);
  const toggle = (key: SortKey) => { setLimit(PAGE); setSort((s) => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }); };
  const caret = (key: SortKey) => sort.key === key ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '';

  function exportCsv() {
    downloadCsv('iepirkumu-piegadataji.csv',
      ['Reģ.nr.', 'Piegādātājs', 'Līgumi', 'Vērtība EUR', 'Pasūtītāji', 'Viena pretendenta %', 'Atkarība no 1 pasūt. %', 'Nozare'],
      rows.map((w) => [w.winnerId, w.winnerName ?? '', w.contracts, w.value, w.buyers, Math.round(w.singleBidRate * 100), Math.round(w.topBuyerShare * 100), w.sectorLabel ?? '']));
  }

  return (
    <div className="card">
      <RiskNote />
      <p className="muted small" style={{ marginTop: 0 }}>
        Skats no piegādātāja puses: visi uzvarētie līgumi pār visiem pasūtītājiem. Pazīmes izpētei:
        augsta <strong>viena pretendenta daļa</strong> (uzvar bez konkurences) un <strong>atkarība no viena pasūtītāja</strong>.
        Tās ir norādes, ne pierādījums.
      </p>
      <div className="disclaimer" style={{ marginBottom: 12 }}>
        <strong>Vērtības ir aptuvenas (≈).</strong> IUB atvērtie dati par lieliem un ietvara iepirkumiem mēdz būt nepilnīgi
        vai paši sev pretrunā, tāpēc kopvērtības var atšķirties no faktiskajām. Izmanto tās lielumu salīdzināšanai, ne precīzai uzskaitei.
      </div>

      <div className="controls" style={{ gap: 8 }}>
        <input className="search-input" style={{ flex: '1 1 220px', minWidth: 180 }} placeholder="Meklēt piegādātāju (nosaukums vai reģ. nr.)"
          value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
        <select className="filter-btn" value={sector} onChange={(e) => { setSector(e.target.value); setLimit(PAGE); }} aria-label="Nozare">
          <option value="all">Visas nozares</option>
          {sectors.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="filter-btn" value={band} onChange={(e) => { setBand(e.target.value); setLimit(PAGE); }} aria-label="Vērtība">
          {VALUE_BANDS.map((b) => <option key={b.k} value={b.k}>{b.l}</option>)}
        </select>
        <select className="filter-btn" value={minContracts} onChange={(e) => { setMinContracts(Number(e.target.value)); setLimit(PAGE); }} aria-label="Min. līgumu">
          <option value={1}>≥ 1 līgums</option>
          <option value={5}>≥ 5 līgumi</option>
          <option value={10}>≥ 10 līgumi</option>
        </select>
        <div className="seg" role="group" aria-label="Avots — ES fondu līgumi">
          {([['all', 'Visi avoti'], ['noeu', 'Bez ES fondiem'], ['eu', 'Ar ES fondiem']] as const).map(([v, l]) => (
            <button key={v} type="button" className={`seg-btn ${source === v ? 'active' : ''}`} aria-pressed={source === v} onClick={() => { setSource(v); setLimit(PAGE); }}>{l}</button>
          ))}
        </div>
        {(() => { const adv = (addrOnly ? 1 : 0) + (offshoreOnly ? 1 : 0) + (homeAdvOnly ? 1 : 0) + (capGapOnly ? 1 : 0) + (lowCapMax ? 1 : 0) + (loTurnMax ? 1 : 0); return (
          <button type="button" className="filter-btn" aria-expanded={showAdv} onClick={() => setShowAdv((s) => !s)}>
            Papildu riska filtri{adv ? ` (${adv})` : ''} {showAdv ? '▴' : '▾'}
          </button>
        ); })()}
      </div>
      <p className="muted small" style={{ margin: '2px 0 0' }}>
        Padoms: meklēšanā var lietot prefiksus — <code>reg:40003</code> (reģ.nr), <code>cpv:45</code> (nozares kods),
        {' '}<code>&gt;1m</code> vai <code>&lt;500k</code> (kopvērtība). Tos var kombinēt ar nosaukumu, piem. <code>cpv:45 &gt;1m ceļi</code>.
      </p>
      {showAdv && (
        <div className="controls" style={{ gap: 8, marginTop: -4, paddingBottom: 4 }}>
          <label className="chk"><input type="checkbox" checked={addrOnly} onChange={(e) => { setAddrOnly(e.target.checked); setLimit(PAGE); }} /> tikai kopīga adrese</label>
          <label className="chk" title="Tikai piegādātāji, kuru patiesā labuma guvējs reģistrēts ofšora vai zemu nodokļu jurisdikcijā"><input type="checkbox" checked={offshoreOnly} onChange={(e) => { setOffshoreOnly(e.target.checked); setLimit(PAGE); }} /> tikai ofšora īpašnieki</label>
          <label className="chk" title="Tikai piegādātāji ar 'mājas priekšrocību' — uzvar krasi biežāk pie viena pasūtītāja nekā citur"><input type="checkbox" checked={homeAdvOnly} onChange={(e) => { setHomeAdvOnly(e.target.checked); setLimit(PAGE); }} /> tikai mājas priekšrocība</label>
          <label className="chk" title="Tikai piegādātāji ar kapacitātes plaisu — uzvarēto līgumu vērtība nesamērīga ar apgrozījumu vai darbinieku skaitu"><input type="checkbox" checked={capGapOnly} onChange={(e) => { setCapGapOnly(e.target.checked); setLimit(PAGE); }} /> tikai kapacitātes plaisa</label>
          <select className="filter-btn" value={lowCapMax} onChange={(e) => { setLowCapMax(Number(e.target.value)); setLimit(PAGE); }} aria-label="Maz resursu, lieli līgumi" title="Maz darbinieku + mikro apgrozījums + ≥€500k līgumi">
            <option value={0}>Resursi: visi</option>
            <option value={1}>≤ 1 darbinieks, lieli līgumi</option>
            <option value={2}>≤ 2 darbinieki, lieli līgumi</option>
            <option value={3}>≤ 3 darbinieki, lieli līgumi</option>
          </select>
          <select className="filter-btn" value={loTurnMax} onChange={(e) => { setLoTurnMax(Number(e.target.value)); setLimit(PAGE); }} aria-label="Mazs apgrozījums, lieli līgumi" title="Mazs apgrozījums + ≥€500k līgumi">
            <option value={0}>Apgrozījums: visi</option>
            <option value={100000}>&lt; €100 tūkst., lieli līgumi</option>
            <option value={500000}>&lt; €500 tūkst., lieli līgumi</option>
            <option value={1000000}>&lt; €1 milj., lieli līgumi</option>
          </select>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <p className="muted small" style={{ margin: 0 }}>{rows.length} piegādātāji. Klikšķini uz kolonnas virsraksta, lai sakārtotu; vēlreiz — pretējā virzienā (▲ no mazākā, ▼ no lielākā).</p>
        {rows.length > 0 && <button className="filter-btn" onClick={exportCsv}>⬇ Lejupielādēt CSV</button>}
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          Nav atbilstošu piegādātāju. Pamēģini citu filtru vai meklēšanas vārdu.
          <div style={{ marginTop: 10 }}>
            <button className="filter-btn" onClick={() => { setQuery(''); setSector('all'); setBand('all'); setMinContracts(5); setAddrOnly(false); setSource('all'); setOffshoreOnly(false); setHomeAdvOnly(false); setCapGapOnly(false); setLowCapMax(0); setLoTurnMax(0); setLimit(PAGE); }}>✕ Notīrīt visus filtrus</button>
          </div>
        </div>
      ) : (
        <>
          <div className="table-wrap"><table className="buyer-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggle('name')}>Piegādātājs{caret('name')}</th>
                <th className="sortable" style={{ width: 110, textAlign: 'right' }} onClick={() => toggle('value')} title="Uzvarēto līgumu kopvērtība (aptuvena — IUB dati par lieliem iepirkumiem nepilnīgi)">Vērtība ≈{caret('value')}</th>
                <th className="sortable col-ind" style={{ width: 64, textAlign: 'right' }} onClick={() => toggle('contracts')}>Līgumi{caret('contracts')}</th>
                <th className="sortable col-ind" style={{ width: 64, textAlign: 'right' }} onClick={() => toggle('buyers')} title="Atšķirīgu pasūtītāju skaits">Pasūt.{caret('buyers')}</th>
                <th className="sortable" style={{ width: 80, textAlign: 'right' }} onClick={() => toggle('singleBid')} title="Cik bieži uzvar kā vienīgais pretendents">1 pret.{caret('singleBid')}</th>
                <th className="sortable col-ind" style={{ width: 90, textAlign: 'right' }} onClick={() => toggle('dependence')} title="Cik liela daļa vērtības no viena pasūtītāja">Atkarība{caret('dependence')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((w) => (
                <tr key={w.fileId} className="clickable" tabIndex={0} role="button" aria-label={w.winnerName ?? w.winnerId}
                  onClick={() => onSelect(w.fileId)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(w.fileId); } }}>
                  <td><Hi text={w.winnerName ?? w.winnerId} term={term} />{w.offshore && <span className={`note-tag ${w.offshore === 'offshore' ? 'note-high' : ''}`} style={{ marginLeft: 6 }} title={w.offshore === 'offshore' ? 'Patiesā labuma guvējs ofšora jurisdikcijā' : 'Patiesā labuma guvējs zemu nodokļu jurisdikcijā'}>{w.offshore === 'offshore' ? 'ofšors' : 'zemi nodokļi'}</span>}{w.homeAdv && <span className="note-tag note-high" style={{ marginLeft: 6 }} title="Uzvar krasi biežāk pie viena pasūtītāja nekā citur">mājas priekšrocība</span>}{w.phoenix && <span className="note-tag note-high" style={{ marginLeft: 6 }} title="Jauna firma, kas pārmanto veca priekšteci pie tā paša pasūtītāja">fēnikss</span>}{w.capGap && <span className="note-tag note-high" style={{ marginLeft: 6 }} title="Uzvarēto līgumu vērtība nesamērīga ar apgrozījumu vai darbinieku skaitu">kapacitātes plaisa</span>}{w.vidDebt && <span className="note-tag note-high" style={{ marginLeft: 6 }} title="Publicēts VID nodokļu parādnieku sarakstā">VID parāds</span>}<div className="muted small mono">{w.winnerId}{w.sectorLabel ? ` · ${w.sectorLabel}` : ''}</div></td>
                  <td className="mono" style={{ textAlign: 'right' }}>{eur(w.value)}</td>
                  <td className="mono col-ind" style={{ textAlign: 'right' }}>{w.contracts}</td>
                  <td className="mono col-ind" style={{ textAlign: 'right' }}>{w.buyers}</td>
                  <td className="mono" style={{ textAlign: 'right', color: sbLower(w) >= 0.5 ? 'var(--red)' : sbLower(w) >= 0.25 ? 'var(--yellow)' : 'inherit' }}
                    title={`Ticamā apakšējā robeža (Vilsons, 95%): ${pct(sbLower(w), 0)} pie ${w.contracts} līgumiem. Krāsa balstās uz šo, ne uz neapstrādāto likmi — mazā izlase nekarogo.`}>
                    {pct(w.singleBidRate, 0)}{sampleClass(w.contracts) === 'low' && w.singleBidRate > 0 && <span className="muted small" title="Maza izlase — likme statistiski nenoteikta"> ⚠</span>}</td>
                  <td className="mono col-ind" style={{ textAlign: 'right', color: w.contracts >= 5 && w.topBuyerShare >= 0.8 && w.buyers <= 2 ? 'var(--red)' : 'inherit' }}>{pct(w.topBuyerShare, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {limit < rows.length && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="filter-btn" onClick={() => setLimit((l) => l + PAGE)}>Rādīt vairāk ({rows.length - limit})</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
