// Kopē dzinēja izvadi (index.json, sectors.json, buyers/<id>.json) frontend public/ mapē.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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

copyFileSync(join(src, 'index.json'), join(destDir, 'index.json'));
if (existsSync(join(src, 'sectors.json'))) copyFileSync(join(src, 'sectors.json'), join(destDir, 'sectors.json'));
if (existsSync(join(src, 'markets.json'))) copyFileSync(join(src, 'markets.json'), join(destDir, 'markets.json'));
if (existsSync(join(src, 'active.json'))) copyFileSync(join(src, 'active.json'), join(destDir, 'active.json'));

let n = 0;
for (const f of readdirSync(join(src, 'buyers'))) {
  copyFileSync(join(src, 'buyers', f), join(destDir, 'buyers', f));
  n++;
}
console.log(`Dati nokopēti: index.json, sectors.json, ${n} pasūtītāju faili → web/public/data/`);
