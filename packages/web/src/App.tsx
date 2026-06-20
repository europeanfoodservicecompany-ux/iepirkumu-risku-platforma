import { useEffect, useState, useRef } from 'react';
import type { IndexData, SectorsData, MarketsData, ActiveData, BuyerDetail, WinnersIndex, WinnerDetail, OverviewData, PersonsData } from './types.ts';
import { pct } from './format.ts';
import { OverviewView } from './components/OverviewView.tsx';
import { AnalysisView } from './components/AnalysisView.tsx';
import { InfoPanel } from './components/InfoPanel.tsx';
import { BuyerList } from './components/BuyerList.tsx';
import { GlobalSearch } from './components/GlobalSearch.tsx';
import { BuyerProfile } from './components/BuyerProfile.tsx';
import { SectorView } from './components/SectorView.tsx';
import { MarketView } from './components/MarketView.tsx';
import { ActiveView } from './components/ActiveView.tsx';
import { SupplierView } from './components/SupplierView.tsx';
import { PersonView } from './components/PersonView.tsx';
import { SupplierProfile } from './components/SupplierProfile.tsx';
import { MethodologyView } from './components/MethodologyView.tsx';
import { Disclaimer } from './components/Disclaimer.tsx';

const BASE = import.meta.env.BASE_URL;
// Atbildes tiesības / kļūdu ziņošana — nomaini uz vēlamo e-pastu (vai iztukšo, lai paslēptu).
const REPORT_EMAIL = 'janis.rupeiks@inbox.lv';

type View = 'overview' | 'analysis' | 'buyers' | 'suppliers' | 'persons' | 'sectors' | 'markets' | 'active' | 'method';

const TABS: { v: View; label: string }[] = [
  { v: 'overview', label: 'Pārskats' },
  { v: 'analysis', label: 'Analīze' },
  { v: 'buyers', label: 'Pasūtītāji' },
  { v: 'suppliers', label: 'Piegādātāji' },
  { v: 'persons', label: 'Personas' },
  { v: 'sectors', label: 'Nozares' },
  { v: 'markets', label: 'Slēgtie tirgi' },
  { v: 'active', label: 'Aktuālie konkursi' },
  { v: 'method', label: 'Metodoloģija' },
];

function parseHash(): { view: View; buyerId: string | null; winnerId: string | null } {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h.startsWith('buyer/')) return { view: 'buyers', buyerId: decodeURIComponent(h.slice(6)), winnerId: null };
  if (h.startsWith('winner/')) return { view: 'suppliers', buyerId: null, winnerId: decodeURIComponent(h.slice(7)) };
  if (h === 'analysis' || h === 'buyers' || h === 'suppliers' || h === 'persons' || h === 'sectors' || h === 'markets' || h === 'active' || h === 'method') return { view: h, buyerId: null, winnerId: null };
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

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch(`${BASE}data/index.json`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setIndex).catch((e) => setError(String(e)));
    fetch(`${BASE}data/overview.json`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setOverview).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true); setDetail(null);
    fetch(`${BASE}data/buyers/${selected}.json`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setDetail).catch(() => setDetail(null)).finally(() => setDetailLoading(false));
  }, [selected]);

  useEffect(() => {
    if (view === 'sectors' && !sectors) fetch(`${BASE}data/sectors.json`, { cache: 'no-cache' }).then((r) => r.json()).then(setSectors).catch(() => {});
    if ((view === 'markets' || view === 'analysis') && !markets) fetch(`${BASE}data/markets.json`, { cache: 'no-cache' }).then((r) => r.json()).then(setMarkets).catch(() => {});
    if ((view === 'active' || selected) && !active) fetch(`${BASE}data/active.json`, { cache: 'no-cache' }).then((r) => r.json()).then(setActive).catch(() => {});
    if ((view === 'suppliers' || selectedWinner) && !winners) fetch(`${BASE}data/winners-index.json`, { cache: 'no-cache' }).then((r) => r.json()).then(setWinners).catch(() => {});
    if (view === 'persons' && !persons) fetch(`${BASE}data/persons-index.json`, { cache: 'no-cache' }).then((r) => r.json()).then(setPersons).catch(() => {});
  }, [view, sectors, markets, active, selected, selectedWinner, winners]);

  useEffect(() => {
    if (!selectedWinner) { setWinnerDetail(null); return; }
    setWinnerLoading(true); setWinnerDetail(null);
    fetch(`${BASE}data/winners/${selectedWinner}.json`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setWinnerDetail).catch(() => setWinnerDetail(null)).finally(() => setWinnerLoading(false));
  }, [selectedWinner]);

  const nav = (
    <nav className="mainnav" aria-label="Galvenā navigācija">
      <div className="container nav-inner">
        {TABS.map((t) => (
          <button key={t.v} className={`navtab ${!selected && view === t.v ? 'active' : ''}`} onClick={() => setView(t.v)}>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );

  if (error) return <Shell nav={nav}><div className="loading">Neizdevās ielādēt datus: {error}</div></Shell>;
  if (!index) return <Shell nav={nav}><div className="loading">Ielādē datus…</div></Shell>;

  const nat = index.national.singleBidRate;
  const scored = index.buyers.filter((b) => b.combinedScore !== null).length;
  const red = index.buyers.filter((b) => b.combinedLevel === 'red').length;

  // ── Pasūtītāja profils ──
  if (selected) {
    return (
      <Shell nav={nav}>
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
      <Shell nav={nav}>
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
    <Shell nav={nav}>
      {view === 'overview' && (
        <div className="section">
          {overview
            ? <OverviewView data={overview} onSelectBuyer={setSelected} onPickSector={pickSector} onPickRegion={pickRegion} onNav={setView} />
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
      {view === 'persons' && <div className="section">{persons ? <PersonView data={persons} onSelectWinner={setWinner} /> : <div className="loading">Ielādē personas…</div>}</div>}
      {view === 'sectors' && <div className="section">{sectors ? <SectorView data={sectors} onSelect={pickSector} onSelectBuyer={setSelected} /> : <div className="loading">Ielādē nozares…</div>}</div>}
      {view === 'markets' && <div className="section">{markets ? <MarketView data={markets} /> : <div className="loading">Ielādē tirgus…</div>}</div>}
      {view === 'active' && <div className="section">{active ? <ActiveView data={active} buyers={index.buyers} onSelectBuyer={setSelected} /> : <div className="loading">Ielādē konkursus…</div>}</div>}
      {view === 'method' && <div className="section"><MethodologyView /></div>}

      <div className="section"><Disclaimer /></div>
    </Shell>
  );
}

function Shell({ children, nav }: { children: React.ReactNode; nav?: React.ReactNode }) {
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
        <div className="container">
          <a href="#/" className="brand">
            <h1>Publisko iepirkumu risku platforma</h1>
            <p>Indikatori B1, B2, A, C, E, D, G · dati: Iepirkumu uzraudzības birojs un Uzņēmumu reģistrs</p>
          </a>
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
      </footer>
    </>
  );
}
