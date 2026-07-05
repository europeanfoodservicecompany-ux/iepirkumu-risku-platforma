// Ģenerē statiskas "dalīšanās" lapas ar per-lapas og: tagiem sociālo tīklu priekšskatījumam.
// SPA izmanto hash-maršrutus (#/buyer/<id>), ko roboti (Twitter/FB/Slack) neredz — tie lasa tikai
// statisko HTML. Tāpēc katram pasūtītājam/piegādātājam uztaisām mazu statisku lapu /p/buyer/<id>
// (un /p/winner/<id>) ar pareizajiem og: tagiem; cilvēkus JS pāradresē uz SPA hash-maršrutu.
// Palaiž PĒC vite build (dist jau eksistē ar datiem). Clean URL: dist/p/buyer/123.html → /p/buyer/123
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dir, '..', 'dist');
const DATA = join(DIST, 'data');
const SITE = 'https://iepirkumurisks.lv';

if (!existsSync(join(DATA, 'index.json'))) {
  console.warn('gen-share-pages: nav dist/data/index.json — izlaižu (palaid pēc vite build).');
  process.exit(0);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (n) => { const v = Math.round(Number(n) || 0); return v >= 1e6 ? `€${(v / 1e6).toFixed(1)} milj.` : `€${v.toLocaleString('lv-LV')}`; };

// HTML ar per-lapas og: tagiem + pāradrese uz SPA hash-maršrutu. noindex — lai Google neindeksē
// plānās pāradreses lapas (galvenā vietne paliek indeksēta caur sitemap); soc. roboti og: lasa tāpat.
function page({ title, desc, hash }) {
  const url = `${SITE}${hash.replace('#/', 'p/').replace(/^p\//, '/p/')}`; // nelietots; saite = /p/...
  void url;
  return `<!doctype html>
<html lang="lv"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} — Iepirkumu risku platforma</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="noindex, follow" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="lv_LV" />
<meta property="og:site_name" content="Iepirkumu risku platforma" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${SITE}/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${SITE}/og.png" />
<link rel="canonical" href="${SITE}/${hash}" />
<script>location.replace(${JSON.stringify('/' + hash)});</script>
<meta http-equiv="refresh" content="0;url=/${hash}" />
</head><body style="font-family:sans-serif;padding:2rem">Pāradresē uz <a href="/${hash}">${esc(title)}</a>…</body></html>`;
}

let nb = 0, nw = 0;
mkdirSync(join(DIST, 'p', 'buyer'), { recursive: true });
mkdirSync(join(DIST, 'p', 'winner'), { recursive: true });

// Pasūtītāji — no index.json (buyerName + combinedScore).
const idx = JSON.parse(readFileSync(join(DATA, 'index.json'), 'utf8'));
for (const b of idx.buyers ?? []) {
  const name = b.buyerName ?? b.buyerId;
  const score = b.combinedScore;
  const desc = score != null
    ? `Kopējais iepirkumu riska rādītājs ${score}/100. Publiska Latvijas publisko iepirkumu risku analīze — viena pretendenta īpatsvars, uzvarētāju koncentrācija, saistītās puses u.c. Karogs nav pārkāpuma pierādījums.`
    : `Pasūtītāja publisko iepirkumu risku profils. Publiska Latvijas iepirkumu analīze.`;
  writeFileSync(join(DIST, 'p', 'buyer', `${b.buyerId}.html`), page({ title: name, desc, hash: `#/buyer/${encodeURIComponent(b.buyerId)}` }));
  nb++;
}

// Piegādātāji — no winners-index.json (winnerName + contracts + value + buyers).
const wi = JSON.parse(readFileSync(join(DATA, 'winners-index.json'), 'utf8'));
for (const w of wi.winners ?? []) {
  const name = w.winnerName ?? w.fileId;
  const desc = `Iepirkumu uzvarētājs: ${w.contracts} līgumi par ${eur(w.value)} no ${w.buyers} pasūtītājiem. Publiska Latvijas iepirkumu risku analīze — īpašnieki, holdinga ķēdes, viena pretendenta īpatsvars.`;
  writeFileSync(join(DIST, 'p', 'winner', `${w.fileId}.html`), page({ title: name, desc, hash: `#/winner/${encodeURIComponent(w.fileId)}` }));
  nw++;
}

console.log(`gen-share-pages: izveidotas ${nb} pasūtītāju + ${nw} piegādātāju dalīšanās lapas → dist/p/`);
