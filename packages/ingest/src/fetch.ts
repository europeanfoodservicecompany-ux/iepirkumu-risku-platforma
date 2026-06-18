// Reālā IUB atvērto datu ievākšana no open.iub.gov.lv.
// Faili: /data/notice/YYYY/MM/DD-MM-YYYY.json — viens fails dienā ar visiem tās dienas paziņojumiem.
// Dati pieejami no 2023-10-25, bez autorizācijas, atjaunoti reizi dienā 04:00 EET.

const BASE = process.env.IUB_OPENDATA_BASE_URL || 'https://open.iub.gov.lv/data/notice';

function pad(n: number): string { return String(n).padStart(2, '0'); }

export function dayUrl(d: Date): string {
  const y = d.getUTCFullYear(); const m = pad(d.getUTCMonth() + 1); const day = pad(d.getUTCDate());
  return `${BASE}/${y}/${m}/${day}-${m}-${y}.json`;
}

export async function fetchDay(d: Date): Promise<any[]> {
  const url = dayUrl(d);
  try {
    const res = await fetch(url);
    if (res.status === 404) return [];          // tajā dienā nav publikāciju
    if (!res.ok) { console.warn(`  ! ${url} → HTTP ${res.status}`); return []; }
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (e) {
    console.warn(`  ! ${url} → ${(e as Error).message}`);
    return [];
  }
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) days.push(new Date(t));
  return days;
}

// Ievāc visus paziņojumus norādītajā datumu diapazonā (ieskaitot).
export async function fetchRange(fromISO: string, toISO: string): Promise<any[]> {
  const from = new Date(fromISO + 'T00:00:00Z');
  const to = new Date(toISO + 'T00:00:00Z');
  const days = eachDay(from, to);
  const all: any[] = [];
  let done = 0;
  for (const d of days) {
    const notices = await fetchDay(d);
    all.push(...notices);
    done++;
    if (done % 5 === 0 || done === days.length) {
      process.stdout.write(`\r  ievākts ${done}/${days.length} dienas, ${all.length} paziņojumi…`);
    }
  }
  process.stdout.write('\n');
  return all;
}

// CLI: node fetch.ts 2025-01-01 2025-01-31 [izvades.json]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [from, to, out] = process.argv.slice(2);
  if (!from || !to) { console.error('Lietošana: node fetch.ts <no-YYYY-MM-DD> <līdz-YYYY-MM-DD> [izvades.json]'); process.exit(1); }
  const data = await fetchRange(from, to);
  const target = out || `iub_${from}_${to}.json`;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(target, JSON.stringify(data));
  console.log(`Saglabāti ${data.length} paziņojumi → ${target}`);
}
