// Kopē dzinēja izvadi (index.json, sectors.json, buyers/<id>.json) frontend public/ mapē.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../../..');
const src = join(root, 'data');
const destDir = join(__dir, '..', 'public', 'data');

if (!existsSync(join(src, 'index.json'))) {
  console.error('Trūkst data/index.json — palaid: npm run pipeline');
  process.exit(1);
}
// Izveido mērķi (pārraksta failus; dzēšana nav vajadzīga)
mkdirSync(join(destDir, 'buyers'), { recursive: true });

// Iztīra lielos/liekos failus, ko frontend NEizmanto — citādi Vite tos iekopē dist un
// lots.json (~37 MB) pārsniedz Cloudflare Pages 25 MiB faila limitu un salauž deploy.
for (const junk of ['lots.json', 'engine_output.json', 'modifications.json', 'ur_registration.json']) {
  try { rmSync(join(destDir, junk), { force: true }); } catch { /* nav kritiski */ }
}

copyFileSync(join(src, 'index.json'), join(destDir, 'index.json'));
for (const f of ['overview.json', 'sectors.json', 'markets.json', 'active.json', 'search-index.json', 'winners-index.json', 'persons-index.json', 'contacts-index.json', 'cfla-index.json', 'cartel-index.json', 'quality.json']) {
  if (existsSync(join(src, f))) copyFileSync(join(src, f), join(destDir, f));
}

let n = 0;
for (const f of readdirSync(join(src, 'buyers'))) {
  copyFileSync(join(src, 'buyers', f), join(destDir, 'buyers', f));
  n++;
}
let wn = 0;
if (existsSync(join(src, 'winners'))) {
  mkdirSync(join(destDir, 'winners'), { recursive: true });
  for (const f of readdirSync(join(src, 'winners'))) {
    copyFileSync(join(src, 'winners', f), join(destDir, 'winners', f));
    wn++;
  }
}
// Versijas marķieris (katrs deploys → jauns laiks). Frontend to pārbauda un piedāvā atjaunot.
writeFileSync(join(destDir, 'version.json'), JSON.stringify({ build: Date.now() }));

// sitemap.xml ar aktuālu lastmod (dati atjaunojas katru dienu). SPA hash-maršruti nav
// atsevišķi URL meklētājiem, tāpēc sitemap norāda kanonisko sākumlapu.
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://iepirkumurisks.lv/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
writeFileSync(join(__dir, '..', 'public', 'sitemap.xml'), sitemap);
console.log(`Dati nokopēti: index.json, ${n} pasūtītāju faili, ${wn} piegādātāju faili → web/public/data/`);
