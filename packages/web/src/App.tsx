import { useEffect, useState, useRef } from 'react';
import type { IndexData, SectorsData, MarketsData, ActiveData, BuyerDetail, WinnersIndex, WinnerDetail, OverviewData, PersonsData, ContactsData, CflaIndexData, CartelIndexData, SearchIndex } from './types.ts';
import { pct } from './format.ts';
import { OverviewView } from './components/OverviewView.tsx';
import { AnalysisView } from './components/AnalysisView.tsx';
import { InfoPanel } from './components/InfoPanel.tsx';
import { BuyerList } from './components/BuyerList.tsx';
import { GlobalSearch } from './components/GlobalSearch.tsx';
import { GlobalSearchBar } from './components/GlobalSearchBar.tsx';
import { BuyerProfile } from './components/BuyerProfile.tsx';
import { SectorView } from './components/SectorView.tsx';
import { MarketView } from './components/MarketView.tsx';
import { ActiveView } from './components/ActiveView.tsx';
import { SupplierView } from './components/SupplierView.tsx';
import { PersonView } from './components/PersonView.tsx';
import { ContactView } from './components/ContactView.tsx';
import { CflaView } from './components/CflaView.tsx';
import { CartelView } from './components/CartelView.tsx';
import { SupplierProfile } from './components/SupplierProfile.tsx';
import { MethodologyView } from './components/MethodologyView.tsx';
import { AboutView } from './components/AboutView.tsx';
import { QualityView } from './components/QualityView.tsx';
import type { QualityData } from './types.ts';
import { Disclaimer } from './components/Disclaimer.tsx';

const BASE = import.meta.env.BASE_URL;

// Vienots JSON ielādētājs: pārbauda r.ok (404→HTML citādi klusi sabojātu json()), un kļūdu
// PARĀDA žurnālā, nevis norij (agrāk .catch(()=>{}) atstāja lietotāju mūžīgā "Ielādē…").
// Kešošanu tagad regulē _headers (stale-while-revalidate), tāpēc bez cache:'no-cache'.
function loadJson<T>(path: string, set: (v: T) => void, onErr?: (e: unknown) => void) {
  return fetch(`${BASE}${path}`)
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() as Promise<T>; })
    .then(set)
    .catch((e) => { console.warn(`Neizdevās ielādēt ${path}:`, e); onErr?.(e); });
}

// Atbildes tiesības / kļūdu ziņošana — nomaini uz vēlamo e-pastu (vai iztukšo, lai paslēptu).
const REPORT_EMAIL = 'janis.rupeiks@inbox.lv';
// GoatCounter konts (subdomēns) apmeklētāju skaitam. Jāsakrīt ar index.html data-goatcounter.
const GOATCOUNTER = 'iepirkumu-risks';

// Redzams apmeklētāju skaits (no GoatCounter publiskā skaitītāja). Ja skaitītājs nav ieslēgts, nekas netiek rādīts.
function VisitorCount() {
  const [n, setN] = useState<string | null>(null);
  useEffect(() => {
    fetch(`https://${GOATCOUNTER}.goatcounter.com/counter/TOTAL.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setN(d.count_unique || d.count); })
      .catch(() => {});
  }, []);
  if (!n) return null;
  return <div style={{ marginTop: 6 }}>{n} apmeklētāji</div>;
}

type View = 'overview' | 'analysis' | 'buyers' | 'suppliers' | 'persons' | 'contacts' | 'cfla' | 'cartel' | 'sectors' | 'markets' | 'active' | 'method' | 'about' | 'quality';

// Cilnes grupētas pēc lietotāja nodoma (mazina 12-ciļņu pārslodzi): kur sākt, kas iesaistīts,
// kādi riska atklājumi, kas notiek tagad, kā tas darbojas.
const TABS: { v: View; label: string; group: string }[] = [
  { v: 'overview', label: 'Pārskats', group: 'Sākums' },
  { v: 'analysis', label: 'Analīze', group: 'Sākums' },
  { v: 'buyers', label: 'Pasūtītāji', group: 'Kas iesaistīts' },
  { v: 'suppliers', label: 'Piegādātāji', group: 'Kas iesaistīts' },
  { v: 'persons', label: 'Personas', group: 'Kas iesaistīts' },
  { v: 'contacts', label: 'Kontaktpersonas', group: 'Kas iesaistīts' },
  { v: 'cartel', label: 'Karteļa pazīmes', group: 'Riska atklājumi' },
  { v: 'markets', label: 'Slēgtie tirgi', group: 'Riska atklājumi' },
  { v: 'cfla', label: 'ES fondi', group: 'Riska atklājumi' },
  { v: 'sectors', label: 'Nozares', group: 'Riska atklājumi' },
  { v: 'active', label: 'Aktuālie konkursi', group: 'Tagad' },
  { v: 'quality', label: 'Datu kvalitāte', group: 'Par' },
  { v: 'method', label: 'Metodoloģija', group: 'Par' },
  { v: 'about', label: 'Par šo vietni', group: 'Par' },
];

// Drošs dekodētājs — kropļota hash (piem. "#/buyer/%") citādi izmestu URIError un sabruktu lapu.
function safeDecode(s: string): string { try { return decodeURIComponent(s); } catch { return s; } }
function parseHash(): { view: View; buyerId: string | null; winnerId: string | null } {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0]; // nogriež filtru query (?...), lai maršruts paliek tīrs
  if (h.startsWith('buyer/')) return { view: 'buyers', buyerId: safeDecode(h.slice(6)), winnerId: null };
  if (h.startsWith('winner/')) return { view: 'suppliers', buyerId: null, winnerId: safeDecode(h.slice(7)) };
  if (h === 'analysis' || h === 'buyers' || h === 'suppliers' || h === 'persons' || h === 'contacts' || h === 'cfla' || h === 'cartel' || h === 'sectors' || h === 'markets' || h === 'active' || h === 'method' || h === 'about' || h === 'quality') return { view: h, buyerId: null, winnerId: null };
  return { view: 'overview', buyerId: null, winnerId: null };
}

export function App() {
  const [index, setIndex] = useState<IndexData | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [sectors, setSectors] = useState<SectorsData | null>(null);
  const [markets, setMarkets] = useState<MarketsData | null>(null);
  const [active, setActive] = useState<ActiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState<WinnersIndex | null>(null);
  const [persons, setPersons] = useState<PersonsData | null>(null);
  const [contacts, setContacts] = useState<ContactsData | null>(null);
  const [cfla, setCfla] = useState<CflaIndexData | null>(null);
  const [cartel, setCartel] = useState<CartelIndexData | null>(null);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null); // slaids indekss globālajai meklēšanai
  const [route, setRoute] = useState(parseHash());
  const view = route.view;
  const selected = route.buyerId;
  const selectedWinner = route.winnerId;
  const setView = (v: View) => { window.location.hash = v === 'overview' ? '#/' : `#/${v}`; };
  const setSelected = (id: string | null) => { window.location.hash = id ? `#/buyer/${encodeURIComponent(id)}` : '#/buyers'; };
  const setWinner = (fid: string | null) => { window.location.hash = fid ? `#/winner/${encodeURIComponent(fid)}` : '#/suppliers'; };
  const [detail, setDetail] = useState<BuyerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [winnerDetail, setWinnerDetail] = useState<WinnerDetail | null>(null);
  const [winnerLoading, setWinnerLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string | null>(null); // nozares filtrs (no Nozaru cilnes)
  const [regionFilter, setRegionFilter] = useState<string | null>(null); // reģiona filtrs (no Pārskata kartes)
  const pickSector = (cpv2: string) => { setRegionFilter(null); setSectorFilter(cpv2); setView('buyers'); };
  const pickRegion = (label: string) => { setSectorFilter(null); setRegionFilter(label); setView('buyers'); };
  // Globālā meklēšana: pretendentu/personu indeksus ielādē tikai pēc fokusa (lazy).
  const [personQuery, setPersonQuery] = useState('');
  const ensureGlobalData = () => {
    if (!searchIndex) loadJson('data/search-index.json', setSearchIndex);
  };
  const goPerson = (name: string) => { setPersonQuery(name); setView('persons'); };
  // "Vairāk ▾" pārpildes izvēlne (fiksēta pozīcija, lai nav joslas ritināšana to nenogriež).
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const toggleMore = () => {
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.bottom + 5, left: r.left });
    setMoreOpen((o) => !o);
  };

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    loadJson('data/index.json', setIndex, (e) => setError(String(e)));
    loadJson('data/overview.json', setOverview);
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true); setDetail(null);
    loadJson(`data/buyers/${selected}.json`, setDetail, () => setDetail(null)).finally(() => setDetailLoading(false));
  }, [selected]);

  useEffect(() => {
    if (view === 'quality' && !quality) loadJson('data/quality.json', setQuality);
    if (view === 'sectors' && !sectors) loadJson('data/sectors.json', setSectors);
    if ((view === 'markets' || view === 'analysis') && !markets) loadJson('data/markets.json', setMarkets);
    if ((view === 'active' || selected) && !active) loadJson('data/active.json', setActive);
    if ((view === 'suppliers' || selectedWinner) && !winners) loadJson('data/winners-index.json', setWinners);
    if (view === 'persons' && !persons) loadJson('data/persons-index.json', setPersons);
    if (view === 'contacts' && !contacts) loadJson('data/contacts-index.json', setContacts);
    if (view === 'cfla' && !cfla) loadJson('data/cfla-index.json', setCfla);
    if ((view === 'cartel' || view === 'overview') && !cartel) loadJson('data/cartel-index.json', setCartel);
  }, [view, sectors, markets, active, selected, selectedWinner, winners]);

  useEffect(() => {
    if (!selectedWinner) { setWinnerDetail(null); return; }
    setWinnerLoading(true); setWinnerDetail(null);
    loadJson(`data/winners/${selectedWinner}.json`, setWinnerDetail, () => setWinnerDetail(null)).finally(() => setWinnerLoading(false));
  }, [selectedWinner]);

  // A variants: biežāk lietotās cilnes redzamas, pārējās zem "Vairāk ▾" (mazāk primāro elementu = mazāk pārslodzes).
  const PRIMARY: View[] = ['overview', 'analysis', 'buyers', 'suppliers', 'persons', 'cartel', 'active'];
  const MORE: View[] = ['contacts', 'markets', 'cfla', 'sectors', 'quality', 'method', 'about'];
  const labelOf = (v: View) => TABS.find((t) => t.v === v)!.label;
  const moreActive = !selected && MORE.includes(view);
  const nav = (
    <nav className="mainnav" aria-label="Galvenā navigācija">
      <div className="container nav-inner">
        {PRIMARY.map((v) => (
          <button key={v} className={`navtab ${!selected && view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {labelOf(v)}
          </button>
        ))}
        <span className="nav-sep" aria-hidden="true" />
        <button ref={moreBtnRef} className={`navtab navdrop-btn ${moreActive ? 'active' : ''}`}
          onClick={toggleMore} onBlur={() => setTimeout(() => setMoreOpen(false), 160)}
          aria-haspopup="true" aria-expanded={moreOpen}>
          Vairāk <span aria-hidden="true" style={{ fontSize: 11, opacity: .7 }}>▾</span>
        </button>
      </div>
      {moreOpen && menuPos && (
        <div className="navmenu" role="menu" style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}>
          {MORE.map((v) => (
            <button key={v} role="menuitem" className={`navmenu-item ${!selected && view === v ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); setView(v); setMoreOpen(false); }}>
              {labelOf(v)}
            </button>
          ))}
        </div>
      )}
    </nav>
  );

  const searchBar = index ? (
    <GlobalSearchBar buyers={index.buyers} winners={searchIndex?.winners ?? null} persons={searchIndex?.persons ?? null}
      routeKey={`${view}|${selected ?? ''}|${selectedWinner ?? ''}`}
      onFocusLoad={ensureGlobalData} onBuyer={setSelected} onWinner={setWinner} onPerson={goPerson} />
  ) : null;

  if (error) return <Shell nav={nav} search={searchBar}><div className="loading">Neizdevās ielādēt datus: {error}</div></Shell>;
  if (!index) return (
    <Shell nav={nav} search={searchBar}>
      <div className="section" aria-busy="true" aria-label="Ielādē datus">
        <div className="grid cols-3" style={{ marginBottom: 16 }}>
          <div className="skeleton sk-kpi" /><div className="skeleton sk-kpi" /><div className="skeleton sk-kpi" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton sk-row" />)}
      </div>
    </Shell>
  );

  const nat = index.national.singleBidRate;
  const scored = index.buyers.filter((b) => b.combinedScore !== null).length;
  const red = index.buyers.filter((b) => b.combinedLevel === 'red').length;

  // ── Pasūtītāja profils ──
  if (selected) {
    return (
      <Shell nav={nav} search={searchBar} meta={index.meta}>
        <nav className="crumbs" aria-label="Atrašanās vieta">
          <button className="btn-link" onClick={() => setSelected(null)}>Pasūtītāji</button>
          <span className="crumb-sep">/</span>
          <span className="crumb-cur">{detail?.buyerName ?? selected}</span>
        </nav>
        {detailLoading && <div className="loading">Ielādē pasūtītāja datus…</div>}
        {detail && <BuyerProfile buyer={detail} nationalSingleBidRate={nat} activeTenders={(active?.tenders ?? []).filter((t) => t.buyerId === selected)} onSelectWinner={setWinner} />}
        {!detailLoading && !detail && <div className="loading">Neizdevās ielādēt pasūtītāja datus.</div>}
        <div className="section"><Disclaimer /></div>
      </Shell>
    );
  }

  // ── Piegādātāja profils ──
  if (selectedWinner) {
    return (
      <Shell nav={nav} search={searchBar} meta={index.meta}>
        <nav className="crumbs" aria-label="Atrašanās vieta">
          <button className="btn-link" onClick={() => setWinner(null)}>Piegādātāji</button>
          <span className="crumb-sep">/</span>
          <span className="crumb-cur">{winnerDetail?.winnerName ?? selectedWinner}</span>
        </nav>
        {winnerLoading && <div className="loading">Ielādē piegādātāja datus…</div>}
        {winnerDetail && <SupplierProfile winner={winnerDetail} onSelectBuyer={setSelected} />}
        {!winnerLoading && !winnerDetail && <div className="loading">Neizdevās ielādēt piegādātāja datus.</div>}
      </Shell>
    );
  }

  // ── Sadaļu skati ──
  return (
    <Shell nav={nav} search={searchBar} meta={index.meta}>
      {view === 'overview' && (
        <div className="section">
          {overview
            ? <OverviewView data={overview} cartelTop={cartel?.pairs?.[0] ?? null} onSelectBuyer={setSelected} onSelectWinner={setWinner} onPickSector={pickSector} onPickRegion={pickRegion} onNav={setView} />
            : <div className="loading">Ielādē pārskatu…</div>}
        </div>
      )}

      {view === 'analysis' && (
        <div className="section">
          {overview ? <AnalysisView buyers={index.buyers} overview={overview} markets={markets} onSelectBuyer={setSelected} /> : <div className="loading">Ielādē analīzi…</div>}
        </div>
      )}

      {view === 'buyers' && (
        <>
          <div className="section"><InfoPanel /></div>
          <div className="section grid cols-3">
            <div className="card stat">
              <div className="num">{pct(nat, 1)}</div>
              <div className="lbl">Nacionālais viena pretendenta īpatsvars ({index.national.singleBidLots}/{index.national.winnerChosenLots})</div>
            </div>
            <div className="card stat">
              <div className="num">{scored}</div>
              <div className="lbl">Pasūtītāji ar pietiekamu paraugu (≥10 iepirkumu)</div>
            </div>
            <div className="card stat">
              <div className="num" style={{ color: 'var(--red)' }}>{red}</div>
              <div className="lbl">Pasūtītāji ar augstu kopējo risku</div>
            </div>
          </div>
          {index.meta?.coverage && (
            <p className="muted small" style={{ margin: '0 0 10px' }}>
              Dati: publicēti {index.meta.coverage}
              {index.meta.lots ? ` · ${index.meta.lots.toLocaleString('lv-LV')} iepirkumi` : ''}
              {index.meta.buyers ? ` · ${index.meta.buyers} pasūtītāji` : ''}
              {' · '}<strong>atjaunojas automātiski katru dienu</strong>
            </p>
          )}
          <div className="section"><GlobalSearch buyers={index.buyers} query={query} setQuery={setQuery} onSelect={setSelected} /></div>
          <div className="section"><BuyerList buyers={index.buyers} query={query} onSelect={setSelected} sectorFilter={sectorFilter} onClearSector={() => setSectorFilter(null)} regionFilter={regionFilter} onClearRegion={() => setRegionFilter(null)} /></div>
        </>
      )}

      {view === 'suppliers' && <div className="section">{winners ? <SupplierView data={winners} onSelect={setWinner} sectorFilter={sectorFilter} onClearSector={() => setSectorFilter(null)} /> : <div className="loading">Ielādē piegādātājus…</div>}</div>}
      {view === 'persons' && <div className="section">{persons ? <PersonView data={persons} onSelectWinner={setWinner} initialQuery={personQuery} /> : <div className="loading">Ielādē personas…</div>}</div>}
      {view === 'contacts' && <div className="section">{contacts ? <ContactView data={contacts} onSelectWinner={setWinner} /> : <div className="loading">Ielādē kontaktpersonas…</div>}</div>}
      {view === 'cfla' && <div className="section">{cfla ? <CflaView data={cfla} onSelectWinner={setWinner} /> : <div className="loading">Ielādē ES fondu datus…</div>}</div>}
      {view === 'cartel' && <div className="section">{cartel ? <CartelView data={cartel} onSelectWinner={setWinner} /> : <div className="loading">Ielādē karteļa datus…</div>}</div>}
      {view === 'sectors' && <div className="section">{sectors ? <SectorView data={sectors} onSelect={pickSector} onSelectBuyer={setSelected} /> : <div className="loading">Ielādē nozares…</div>}</div>}
      {view === 'markets' && <div className="section">{markets ? <MarketView data={markets} /> : <div className="loading">Ielādē tirgus…</div>}</div>}
      {view === 'active' && <div className="section">{active ? <ActiveView data={active} buyers={index.buyers} onSelectBuyer={setSelected} /> : <div className="loading">Ielādē konkursus…</div>}</div>}
      {view === 'quality' && <div className="section"><QualityView data={quality} /></div>}
      {view === 'method' && <div className="section"><MethodologyView /></div>}
      {view === 'about' && <AboutView />}

      <div className="section"><Disclaimer /></div>
    </Shell>
  );
}

function Shell({ children, nav, search, meta }: { children: React.ReactNode; nav?: React.ReactNode; search?: React.ReactNode; meta?: { coverage?: string; generatedAt?: string } }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const loadedVersion = useRef<number | null>(null);
  useEffect(() => {
    let stop = false;
    const check = () => fetch(`${BASE}data/version.json`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((v) => {
        if (!v || stop) return;
        if (loadedVersion.current == null) loadedVersion.current = v.build;
        else if (v.build !== loadedVersion.current) setUpdateAvailable(true);
      }).catch(() => {});
    check();
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    const iv = window.setInterval(check, 5 * 60 * 1000);
    return () => { stop = true; window.removeEventListener('focus', onFocus); window.clearInterval(iv); };
  }, []);
  return (
    <>
      {updateAvailable && (
        <div className="update-bar" role="status">
          <span>Pieejama jaunāka versija ar svaigākiem datiem.</span>
          <button onClick={() => window.location.reload()}>Atjaunot</button>
        </div>
      )}
      <header className="top">
        <div className="container top-inner">
          <a href="#/" className="brand">
            <h1>Publisko iepirkumu risku platforma</h1>
            <p>Neatkarīga Latvijas publisko iepirkumu risku analīze · dati: IUB, Uzņēmumu reģistrs, CFLA, EIS</p>
            {meta?.coverage && (
              <p className="coverage" title="Analizēto iepirkumu periods un datu atjaunošanas brīdis">
                Dati: {meta.coverage}{meta.generatedAt ? ` · atjaunots ${new Date(meta.generatedAt).toLocaleDateString('lv-LV')}` : ''}
              </p>
            )}
          </a>
          {search}
        </div>
      </header>
      {nav}
      <main className="container">{children}</main>
      <footer className="container">
        <div>Izpētes prioritizēšanas rīks · metodoloģija balstīta uz OCP “Red Flags” un Fazekas/DIGIWHIST integritātes indikatoriem.</div>
        {REPORT_EMAIL && (
          <div style={{ marginTop: 6 }}>
            Pamanīji neprecizitāti? Katram karogam ir saite uz oriģinālu pārbaudei. Labojumi un jautājumi:{' '}
            <a href={`mailto:${REPORT_EMAIL}?subject=Iepirkumu%20risku%20platforma`}>{REPORT_EMAIL}</a>
          </div>
        )}
        <div style={{ marginTop: 6 }}>Izstrādāja <strong>Jānis Rupeiks</strong>, Liepājā 2026. gadā.</div>
        <div style={{ marginTop: 4, fontStyle: 'italic' }}>„Acti labores jucundi" — padarītie darbi ir patīkami.</div>
        <VisitorCount />
      </footer>
    </>
  );
}
