import { useEffect, useMemo, useState } from 'react';
import type { PersonsData, PersonEntry } from '../types.ts';
import { eur, norm, queryTokens, tokenMatch, downloadCsv } from '../format.ts';
import { PersonNetwork } from './PersonNetwork.tsx';

const PAGE = 30;
const ROLE: Record<string, string> = { PLG: 'patiesā labuma guvējs', valde: 'valdes loceklis', likvidators: 'likvidators', amatpersona: 'amatpersona' };
const roleLabel = (r: string) => ROLE[r] ?? r;
type SortKey = 'companies' | 'contracts' | 'value' | 'risk' | 'name';
const RISK_RANK = { high: 2, med: 1 } as Record<string, number>;

export function PersonView({ data, onSelectWinner, initialQuery }: { data: PersonsData; onSelectWinner: (fileId: string) => void; initialQuery?: string }) {
  // Sākotnējie filtri no URL (linkojami skati — filtri saglabājas hash query un nepazūd pārlādējot).
  const sp = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const [query, setQuery] = useState(initialQuery ?? '');
  const [sort, setSort] = useState<SortKey>((sp.get('sort') as SortKey) || 'companies');
  const [dir, setDir] = useState<'desc' | 'asc'>(sp.get('dir') === 'asc' ? 'asc' : 'desc');
  const [role, setRole] = useState(sp.get('role') ?? 'all');
  const [minCo, setMinCo] = useState(sp.has('minco') ? Number(sp.get('minco')) : 2);
  const [sector, setSector] = useState(sp.get('sec') ?? 'all');
  const [minValue, setMinValue] = useState(sp.has('minval') ? Number(sp.get('minval')) : 0);
  const [minContracts, setMinContracts] = useState(sp.has('minlig') ? Number(sp.get('minlig')) : 0);
  const [signalType, setSignalType] = useState(sp.get('sig') ?? 'all');
  const [onlyRisk, setOnlyRisk] = useState(sp.get('risk') === '1');
  const [onlyPep, setOnlyPep] = useState(sp.get('pep') === '1');
  const [limit, setLimit] = useState(PAGE);
  const [net, setNet] = useState<string | null>(null);
  const term = norm(query.trim());
  const tokens = queryTokens(query);
  const reset = () => setLimit(PAGE);
  // Kad no globālās meklēšanas uzklikšķina personu, initialQuery mainās — aizstāj lauka tekstu (nepieliek klāt).
  useEffect(() => { if (initialQuery) { setQuery(initialQuery); setLimit(PAGE); } }, [initialQuery]);

  // Saglabā filtrus URL hash query (linkojami, nepazūd pārlādējot). replaceState → bez vēstures piesārņojuma.
  useEffect(() => {
    if (!window.location.hash.startsWith('#/persons')) return;
    const p = new URLSearchParams();
    if (sort !== 'companies') p.set('sort', sort);
    if (dir !== 'desc') p.set('dir', dir);
    if (role !== 'all') p.set('role', role);
    if (minCo !== 2) p.set('minco', String(minCo));
    if (sector !== 'all') p.set('sec', sector);
    if (minValue) p.set('minval', String(minValue));
    if (minContracts) p.set('minlig', String(minContracts));
    if (signalType !== 'all') p.set('sig', signalType);
    if (onlyRisk) p.set('risk', '1');
    if (onlyPep) p.set('pep', '1');
    const qs = p.toString();
    const target = qs ? `#/persons?${qs}` : '#/persons';
    if (window.location.hash.split('?')[0] === '#/persons' && window.location.hash !== target) history.replaceState(null, '', target);
  }, [sort, dir, role, minCo, sector, minValue, minContracts, signalType, onlyRisk]);

  const sectorOptions = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of data.persons) for (const s of p.sectors ?? []) c.set(s, (c.get(s) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [data]);

  const rows = useMemo(() => {
    const min = term ? 1 : minCo;
    const filtered = data.persons.filter((p) =>
      (!term || tokenMatch(norm(p.name), tokens))
      && p.companyCount >= min
      && (role === 'all' || p.roles.includes(role))
      && (sector === 'all' || (p.sectors ?? []).includes(sector))
      && p.totalValue >= minValue
      && p.totalContracts >= minContracts
      && (signalType === 'all' || (p.signalTypes ?? []).includes(signalType))
      && (!onlyRisk || !!p.riskLevel)
      && (!onlyPep || !!p.pep));
    const val = (p: PersonEntry) =>
      sort === 'value' ? p.totalValue
      : sort === 'contracts' ? p.totalContracts
      : sort === 'risk' ? (RISK_RANK[p.riskLevel ?? ''] ?? 0) * 1e12 + p.totalValue
      : p.companyCount;
    const sorted = [...filtered].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'lv') : val(a) - val(b));
    if (dir === 'desc') sorted.reverse();
    return sorted.slice(0, 800);
  }, [data, term, role, minCo, sort, dir, onlyRisk, sector, minValue, minContracts, signalType, onlyPep]);
  const shown = rows.slice(0, limit);

  return (
    <div className="card">
      <p className="muted small" style={{ marginTop: 0 }}>
        Meklē pēc personas (patiesā labuma guvēja vai valdes locekļa) un redzi visus ar to saistītos uzvarētājus.
        Avots: Uzņēmumu reģistra atvērtie dati. No personas koda rādīti tikai pirmie 4 cipari. Karogs nav pierādījums — tā ir norāde izpētei.
      </p>
      <div className="controls" style={{ gap: 8 }}>
        <input className="search-input" style={{ flex: '1 1 220px', minWidth: 180 }} placeholder="Meklēt personu pēc vārda…"
          value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
        <select className="filter-btn" value={role} onChange={(e) => { setRole(e.target.value); setLimit(PAGE); }} aria-label="Loma">
          <option value="all">Visas lomas</option>
          <option value="PLG">Patiesā labuma guvējs</option>
          <option value="valde">Valdes loceklis</option>
        </select>
        <select className="filter-btn" value={minCo} onChange={(e) => { setMinCo(Number(e.target.value)); setLimit(PAGE); }} aria-label="Min. uzņēmumu">
          <option value={1}>≥ 1 uzņēmums</option>
          <option value={2}>≥ 2 uzņēmumi</option>
          <option value={3}>≥ 3 uzņēmumi</option>
          <option value={5}>≥ 5 uzņēmumi</option>
        </select>
        <select className="filter-btn" value={sort} onChange={(e) => { setSort(e.target.value as SortKey); setLimit(PAGE); }} aria-label="Kārtot">
          <option value="companies">Pēc uzņēmumu skaita</option>
          <option value="contracts">Pēc līgumu skaita</option>
          <option value="value">Pēc kopvērtības</option>
          <option value="risk">Pēc saiknes stipruma</option>
          <option value="name">Pēc nosaukuma</option>
        </select>
        <button className="filter-btn" onClick={() => { setDir((d) => d === 'desc' ? 'asc' : 'desc'); reset(); }}
          aria-label="Kārtošanas virziens" title={dir === 'desc' ? 'No lielākā uz mazāko' : 'No mazākā uz lielāko'}>
          {sort === 'name' ? (dir === 'desc' ? 'Z → A' : 'A → Z') : (dir === 'desc' ? '↓ no lielākā' : '↑ no mazākā')}
        </button>
        <label className="chk"><input type="checkbox" checked={onlyRisk} onChange={(e) => { setOnlyRisk(e.target.checked); reset(); }} /> tikai ar saiknēm</label>
        <label className="chk" title="Vārda sakritība ar 14. Saeimas deputātu — norāde pārbaudei, ne apstiprinājums"><input type="checkbox" checked={onlyPep} onChange={(e) => { setOnlyPep(e.target.checked); reset(); }} /> vārda sakritība ar deputātu</label>
      </div>
      <div className="controls" style={{ gap: 8, marginTop: 8 }}>
        <select className="filter-btn" value={sector} onChange={(e) => { setSector(e.target.value); reset(); }} aria-label="Nozare">
          <option value="all">Visas nozares</option>
          {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-btn" value={minValue} onChange={(e) => { setMinValue(Number(e.target.value)); reset(); }} aria-label="Min. kopvērtība">
          <option value={0}>Jebkura vērtība</option>
          <option value={100000}>≥ €100 tūkst.</option>
          <option value={1000000}>≥ €1 milj.</option>
          <option value={10000000}>≥ €10 milj.</option>
          <option value={100000000}>≥ €100 milj.</option>
        </select>
        <select className="filter-btn" value={minContracts} onChange={(e) => { setMinContracts(Number(e.target.value)); reset(); }} aria-label="Min. līgumu skaits">
          <option value={0}>Jebkurš līgumu sk.</option>
          <option value={10}>≥ 10 līgumi</option>
          <option value={50}>≥ 50 līgumi</option>
          <option value={100}>≥ 100 līgumi</option>
          <option value={500}>≥ 500 līgumi</option>
        </select>
        <select className="filter-btn" value={signalType} onChange={(e) => { setSignalType(e.target.value); reset(); }} aria-label="Signāla tips">
          <option value="all">Visi signāli</option>
          <option value="proc">Vienā procedūrā (≥2 firmas)</option>
          <option value="market">Dominē slēgtā tirgū</option>
          <option value="cpv">Kopīgs tirgus (CPV4)</option>
          <option value="buyer">Kopīgs pasūtītājs</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <p className="muted small" style={{ margin: 0 }}>{rows.length} personas{term ? '' : ' (filtrēts)'}.</p>
        {rows.length > 0 && <button className="filter-btn" style={{ padding: '5px 10px' }} onClick={() => downloadCsv('personas.csv',
          ['Vārds', 'Lomas', 'Uzņēmumi', 'Līgumi', 'Kopvērtība EUR', 'Riska līmenis', 'Vārda sakritība ar Saeimas deputātu (nav apstiprināta identitāte)', 'Signāli'],
          rows.map((p) => [p.name, (p.roles ?? []).join('/'), p.companyCount, p.totalContracts, p.totalValue, p.riskLevel ?? '', p.pep ? 'sakritība pēc vārda' + (p.pep.ambiguous ? ' (vairākas personas ar šo vārdu)' : '') : '', (p.signals ?? []).join('; ')]))}>⬇ CSV</button>}
      </div>

      {shown.length === 0 ? (
        <div className="empty">Nav atbilstošu personu. Pamēģini citu vārdu vai filtru.</div>
      ) : (
        <>
          {shown.map((p, i) => {
            const key = p.name + p.id + i;       // React saraksta atslēga (unikāla)
            const pid = p.id + '|' + p.name;     // stabils ID tīkla pārslēgam (nemainās, mainot filtru)
            return (
              <div className="person-card" key={key}>
                <div className="person-head">
                  <span className="plg-av">{(p.name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {p.name} <span className="muted small mono">{p.id}</span>
                      {p.riskLevel && <span className={`note-tag note-${p.riskLevel}`}>{p.riskLevel === 'high' ? 'izteikta saikne' : 'saikne'}</span>}
                      {p.pep && <span className="note-tag note-pep" title="Šis vārds sakrīt ar ievēlētu amatpersonu. Sakritība ir tikai pēc vārda, bez personas koda — tā var būt cita persona.">vārda sakritība: {p.pep.tier}</span>}
                    </div>
                    <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {p.roles.map((r) => <span key={r} className="role-badge">{roleLabel(r)}</span>)}
                      {(p.sectors ?? []).map((s) => <span key={s} className="sector-badge">{s}</span>)}
                    </div>
                  </div>
                  <div className="person-stats">
                    <div><strong>{p.companyCount}</strong><span>uzņēmumi</span></div>
                    <div><strong>{p.totalContracts}</strong><span>līgumi</span></div>
                    <div><strong className="mono">{eur(p.totalValue)}</strong><span>kopā ≈</span></div>
                  </div>
                </div>

                {(p.signals ?? []).length > 0 && (
                  <ul className="signal-list">
                    {p.signals!.map((s, k) => <li key={k}>{s}</li>)}
                  </ul>
                )}

                {p.pep && (
                  <div className="pep-note">
                    Šis vārds un uzvārds <strong>sakrīt ar amatpersonu ({p.pep.tier})</strong> (avots: {p.pep.source}).
                    {' '}Sakritība ir <strong>tikai pēc vārda un uzvārda, bez personas koda — tā var attiekties uz citu personu ar tādu pašu vārdu</strong>.
                    {p.pep.ambiguous && ' Turklāt šo vārdu iepirkumu datos nes vairākas personas.'}
                    {' '}Tā ir norāde izpētei, ne apstiprinājums, un neietver pieņēmumu par pārkāpumu.
                    {' '}Salīdzināts ar Ministru kabineta, Saeimas (2022) un Eiropas Parlamenta (2024) sastāvu; valsts sekretāri, pašvaldību deputāti un citas amatpersonas nav iekļautas, un birkas neesamība nenozīmē, ka persona nav politiski nozīmīga.
                    <div style={{ marginTop: 4 }}>
                      Pārbaudīt: <a href="https://www.saeima.lv/lv/deputati" target="_blank" rel="noopener noreferrer">Saeimas deputātu saraksts →</a>
                      {' · '}<a href="https://www6.vid.gov.lv/PNP" target="_blank" rel="noopener noreferrer">VID reģistrs (vajadzīgs personas kods) →</a>
                      {' · '}<a href="#/about">ziņot par kļūdu</a>
                    </div>
                  </div>
                )}

                <div className="person-companies">
                  {p.companies.map((c, j) => (
                    <a key={j} className="memrow" href={c.fileId ? `#/winner/${encodeURIComponent(c.fileId)}` : undefined}
                      onClick={c.fileId ? (e) => { e.preventDefault(); onSelectWinner(c.fileId!); } : undefined}>
                      <span style={{ flex: 1 }}>
                        {c.name}{c.fileId ? <span className="muted"> →</span> : null}
                        <span className="muted small"> · {roleLabel(c.role)}{c.sector ? ' · ' + c.sector : ''}</span>
                      </span>
                      <span className="mono small">{c.contracts} līg. · {eur(c.value)}</span>
                    </a>
                  ))}
                </div>

                {p.companyCount >= 2 && (
                  <div style={{ marginTop: 6 }}>
                    <button className="link-btn" onClick={() => setNet(net === pid ? null : pid)}>
                      {net === pid ? 'Slēpt tīklu' : 'Parādīt saikņu tīklu'}
                    </button>
                    {net === pid && <PersonNetwork person={p} />}
                  </div>
                )}
              </div>
            );
          })}
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
