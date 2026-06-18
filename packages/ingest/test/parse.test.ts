import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseNotice, parseNotices } from '../src/parse.ts';
import { computeNationalBaseline } from '../../engine/src/aggregate.ts';
import { IndicatorB1 } from '../../engine/src/indicators/B1.ts';

const __dir = dirname(fileURLToPath(import.meta.url));
const notices = JSON.parse(readFileSync(join(__dir, 'fixtures', 'raw_day.sample.json'), 'utf8'));

test('parsē reālus IUB result paziņojumus uz lots', () => {
  const lots = parseNotices(notices);
  assert.ok(lots.length > 0, 'jābūt vismaz dažām daļām');
  const l = lots[0];
  assert.equal(typeof l.id, 'string');
  assert.match(l.buyerId, /^\d{6,}$/, 'buyerId = reģistrācijas numurs');
  assert.ok(l.sourceUrl?.startsWith('https://info.iub.gov.lv/lv/eforms/'), 'saite uz IUB oriģinālu');
});

test('winnerChosen un receivedBids tiek korekti izvilkti', () => {
  const lots = parseNotices(notices);
  // selec-w → winnerChosen true; clos-nw → false
  assert.ok(lots.some((l) => l.winnerChosen === true));
  assert.ok(lots.some((l) => l.winnerChosen === false));
  // receivedBids ir vesels skaitlis vai null
  for (const l of lots) {
    assert.ok(l.receivedBids === null || Number.isInteger(l.receivedBids));
  }
});

test('ne-result veidlapas tiek izlaistas', () => {
  assert.equal(parseNotice({ formType: 'planning' }).length, 0);
  assert.equal(parseNotice({ formType: 'competition' }).length, 0);
});

test('nacionālā bāze uz reāliem datiem ir ticamā diapazonā (~15–40%)', () => {
  // Pašpārbaude (B1 spec 8): aprēķinātā bāze jāsalīdzina ar zināmo ~26%.
  const bundled = JSON.parse(readFileSync(join(__dir, '..', 'sample', 'lots.sample.json'), 'utf8'));
  const b1 = new IndicatorB1();
  const base = computeNationalBaseline(bundled, (l) => b1.appliesTo(l));
  assert.ok(base.singleBidRate > 0.15 && base.singleBidRate < 0.40,
    `nacionālā bāze ārpus diapazona: ${(base.singleBidRate * 100).toFixed(1)}%`);
});
