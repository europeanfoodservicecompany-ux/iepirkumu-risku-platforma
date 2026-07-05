// Publisko personu un iestāžu saraksts (UR, data.gov.lv, CC0, dienā).
// Sniedz par katru PASŪTĪTĀJU (pēc reģ.nr) kontekstu: iestādes tips, augstākā (mātes) iestāde,
// oficiālais e-pasts un statuss. SVARĪGI: tas ir AKTUĀLAIS momentuzņēmums (nav vēsturisko versiju
// pa datumiem), tāpēc UI marķē kā "pēc UR aktuālā saraksta". Reģistrā NAV iestādes vadītāja vārda.
import { writeFileSync } from 'node:fs';

export const PPI_URL =
  'https://data.gov.lv/dati/dataset/2e4926ea-8648-44e6-9227-3cb20604ec31/resource/190ba502-08d1-4c4c-b1b9-b58299bf9a9f/download/ppi_public_persons_institutions.csv';

// authorityType kodi → latviskās etiķetes (fallback uz pašu kodu, ja nezināms).
const TYPE_LABELS: Record<string, string> = {
  INSTITUTION_OF_DIRECT_ADMINISTRATION: 'Tiešās pārvaldes iestāde',
  INSTITUTION_OF_INDIRECT_ADMINISTRATION: 'Pastarpinātās pārvaldes iestāde',
  DERIVED_PUBLIC_PERSON: 'Atvasināta publiska persona',
  DERIVED_PUBLIC_PERSON_PARISH: 'Pašvaldība (atvasināta publiska persona)',
  COURT: 'Tiesa',
  PROSECUTOR_OFFICE: 'Prokuratūra',
  OTHER: 'Cita valsts institūcija',
};

export type PpiInfo = {
  type: string | null;          // latviskā etiķete
  typeRaw: string | null;       // oriģinālais kods
  higherName: string | null;    // augstākā (mātes) iestāde
  higherNr: string | null;      // mātes iestādes reģ.nr
  email: string | null;         // oficiālais e-pasts
  status: string | null;        // REGISTERED / REMOVED
  removedOn: string | null;     // ISO datums, ja izslēgta
};

// Pret-pēdiņu drošs CSV rindas dalītājs (atbalsta "..." ar iekšējiem atdalītājiem un "" kā pēdiņu).
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const clean = (s: string | undefined): string | null => {
  const t = (s ?? '').trim();
  return t === '' ? null : t;
};
const isoDate = (s: string | undefined): string | null => {
  const t = (s ?? '').trim();
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

// Parsē CSV un atgriež reg → PpiInfo TIKAI dotajiem pasūtītāju reģ. numuriem.
export function parsePpi(csv: string, buyerRegs: Set<string>): Record<string, PpiInfo> {
  const lines = csv.split(/\r?\n/);
  if (lines.length < 2) return {};
  const delim = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const h = splitCsvLine(lines[0], delim);
  const ix = (name: string) => h.indexOf(name);
  const iReg = ix('registrationNumber'), iType = ix('authorityType'),
    iHName = ix('higherAuthorityName'), iHNr = ix('higherAuthorityNumber'),
    iEmail = ix('email'), iStatus = ix('Status'), iRemoved = ix('removedOn');
  const out: Record<string, PpiInfo> = {};
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const c = splitCsvLine(lines[i], delim);
    const reg = (c[iReg] ?? '').trim();
    if (!reg || !buyerRegs.has(reg)) continue;
    const typeRaw = clean(c[iType]);
    // Patur jaunāko/aktīvāko: ja jau ir REGISTERED ieraksts, neaizstāj ar REMOVED.
    const status = clean(c[iStatus]);
    const prev = out[reg];
    if (prev && prev.status === 'REGISTERED' && status !== 'REGISTERED') continue;
    out[reg] = {
      type: typeRaw ? (TYPE_LABELS[typeRaw] ?? typeRaw) : null,
      typeRaw,
      higherName: clean(c[iHName]),
      higherNr: clean(c[iHNr]),
      email: clean(c[iEmail]),
      status,
      removedOn: isoDate(c[iRemoved]),
    };
  }
  return out;
}

// Lejupielādē PPI sarakstu, parsē un saglabā kompaktu karti tikai pasūtītājiem (ppi.json).
export async function buildPpiMap(buyerRegs: Set<string>, savePath: string): Promise<void> {
  const r = await fetch(PPI_URL);
  if (!r.ok) throw new Error(`PPI fetch HTTP ${r.status}`);
  const csv = await r.text();
  writeFileSync(savePath, JSON.stringify(parsePpi(csv, buyerRegs)));
}
