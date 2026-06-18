import { useEffect, useState } from 'react';
import type { IndexData, SectorsData, MarketsData, ActiveData, BuyerDetail } from './types.ts';
import { pct } from './format.ts';
import { InfoPanel } from './components/InfoPanel.tsx';
import { BuyerList } from './components/BuyerList.tsx';
import { GlobalSearch } from './components/GlobalSearch.tsx';
import { BuyerProfile } from './components/BuyerProfile.tsx';
import { SectorView } from './components/SectorView.tsx';
import { MarketView } from './components/MarketView.tsx';
import { ActiveView } from './components/ActiveView.tsx';
import { MethodologyView } from './components/MethodologyView.tsx';
import { Disclaimer } from './components/Disclaimer.tsx';

const BASE = import.meta.env.BASE_URL;

function parseHash(): { view: 'buyers' | 'sectors' | 'markets' | 'active' | 'method'; buyerId: string | null } {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h.startsWith('buyer/')) return { view: 'buyers', buyerId: decodeURIComponent(h.slice(6)) };
  if (h === 'sectors') return { view: 'sectors', buyerId: null };
  if (h === 'markets') return { view: 'markets', buyerId: null };
  if (h === 'active') return { view: 'active', buyerId: null };
  if (h === 'method') return { view: 'method', buyerId: null };
  return { view: 'buyers', buyerId: null };
}

export function App() {
  const [index, setIndex] = useState<IndexData | null>(null);
  const [sectors, setSectors] = useState<SectorsData | null>(null);
  const [markets, setMarkets] = useState<MarketsData | null>(null);
  const [active, setActive] = useState<ActiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState(parseHash());
  const view = route.view;
  const selected = route.buyerId;
  const setView = (v: 'buyers' | 'sectors' | 'markets' | 'active' | 'method') => { window.location.hash = v === 'buyers' ? '#/' : `#/${v}`; };
  const setSelected = (id: string | null) => { window.location.hash = id ? `#/buyer/${encodeURIComponent(id)}` : '#/'; };
  const [detail, setDetail] = useState<BuyerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch(`${BASE}data/index.json`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setIndex).catch((e) => setError(String(e)));
  }, []);

  // Pasūtītāja detaļas ielādē pēc pieprasījuma.
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setDetailLoading(true); setDetail(null);
    fetch(`${BASE}data/buyers/${selected}.json`)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setDetail).catch(() => setDetail(null)).finally(() => setDetailLoading(false));
  }, [selected]);

  // Nozares ielādē, kad pirmoreiz atver cilni.
  useEffect(() => {
    if (view === 'sectors' && !sectors) {
      fetch(`${BASE}data/sectors.json`).then((r) => r.json()).then(setSectors).catch(() => {});
    }
    if (view === 'markets' && !markets) {
      fetch(`${BASE}data/markets.json`).then((r) => r.json()).then(setMarkets).catch(() => {});
    }
    if ((view === 'active' || selected) && !active) {
      fetch(`${BASE}data/active.json`).then((r) => r.json()).then(setActive).catch(() => {});
    }
  }, [view, sectors, markets, active, selected]);

  if (error) return <Shell><div className="loading">Neizdevās ielādēt datus: {error}<br /><span className="small">Palaid datu plūsmu: <code>npm run pipeline</code></span></div></Shell>;
  if (!index) return <Shell><div className="loading">Ielādē datus…</div></Shell>;

  const nat = index.national.singleBidRate;
  const scored = index.buyers.filter((b) => b.combinedScore !== null).length;
  const red = index.buyers.filter((b) => b.combinedLevel === 'red').length;

  return (
    <Shell>
      <GlobalSearch buyers={index.buyers} query={query} setQuery={setQuery} onSelect={setSelected} />

      {selected ? (
        <>
          <button className="btn-link btn-back" onClick={() => setSelected(null)}>← Atpakaļ uz sarakstu</button>
          {detailLoading && <div className="loading">Ielādē pasūtītāja datus…</div>}
          {detail && <BuyerProfile buyer={detail} nationalSingleBidRate={nat} activeTenders={(active?.tenders ?? []).filter((t) => t.buyerId === selected)} />}
          {!detailLoading && !detail && <div className="loading">Neizdevās ielādēt pasūtītāja datus.</div>}
        </>
      ) : (
        <>
          <div className="section"><InfoPanel /></div>

          {index.meta?.coverage && (
            <p className="muted small" style={{ margin: '0 0 -4px' }}>
              Dati: publicēti {index.meta.coverage}
              {index.meta.lots ? ` · ${index.meta.lots.toLocaleString('lv-LV')} iepirkumi` : ''}
              {index.meta.buyers ? ` · ${index.meta.buyers} pasūtītāji` : ''}
            </p>
          )}

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

          <div className="tabs">
            <button className={`tab ${view === 'buyers' ? 'active' : ''}`} onClick={() => setView('buyers')}>Pasūtītāji</button>
            <button className={`tab ${view === 'sectors' ? 'active' : ''}`} onClick={() => setView('sectors')}>Nozares</button>
            <button className={`tab ${view === 'markets' ? 'active' : ''}`} onClick={() => setView('markets')}>Slēgtie tirgi</button>
            <button className={`tab ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>Aktuālie konkursi</button>
            <button className={`tab ${view === 'method' ? 'active' : ''}`} onClick={() => setView('method')}>Metodoloģija</button>
          </div>

          <div className="section">
            {view === 'buyers' && <BuyerList buyers={index.buyers} query={query} onSelect={setSelected} />}
            {view === 'sectors' && (sectors ? <SectorView data={sectors} /> : <div className="loading">Ielādē nozares…</div>)}
            {view === 'markets' && (markets ? <MarketView data={markets} /> : <div className="loading">Ielādē tirgus…</div>)}
            {view === 'active' && (active ? <ActiveView data={active} buyers={index.buyers} onSelectBuyer={setSelected} /> : <div className="loading">Ielādē konkursus…</div>)}
            {view === 'method' && <MethodologyView />}
          </div>

          <div className="section"><Disclaimer /></div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="container">
          <h1>Publisko iepirkumu risku platforma</h1>
          <p>Indikatori B1, B2, A, C, E, D · dati: Iepirkumu uzraudzības birojs un Uzņēmumu reģistrs</p>
        </div>
      </header>
      <main className="container">{children}</main>
      <footer className="container">
        <div>Izpētes prioritizēšanas rīks · metodoloģija balstīta uz OCP “Red Flags” un Fazekas/DIGIWHIST integritātes indikatoriem.</div>
        <div style={{ marginTop: 6 }}>Izstrādāja <strong>Jānis Rupeiks</strong> Liepājā, lai glābtu valsti 🙂</div>
        <div style={{ marginTop: 4, fontStyle: 'italic' }}>„Acti labores jucundi" — padarītie darbi ir patīkami.</div>
      </footer>
    </>
  );
}
