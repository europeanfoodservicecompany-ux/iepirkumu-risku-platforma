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
for (const f of ['sectors.json', 'markets.json', 'active.json', 'winners-index.json']) {
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
console.log(`Dati nokopēti: index.json, ${n} pasūtītāju faili, ${wn} piegādātāju faili → web/public/data/`);
