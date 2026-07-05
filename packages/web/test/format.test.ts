import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, pct, eur, bandFromScore, fmtRatio, levLE, queryTokens, tokenMatch } from '../src/format.ts';

test('norm — noņem diakritiku un mazina burtus', () => {
  assert.equal(norm('Rīga'), 'riga');
  assert.equal(norm('Ķekava'), 'kekava');
  assert.equal(norm('JĒKABPILS'), 'jekabpils');
  assert.equal(norm('Ludzas NOVADS'), 'ludzas novads');
  assert.equal(norm(''), '');
});

test('norm — saglabā garumu precomponētam ievadam (izcēluma indeksi paliek saskaņoti)', () => {
  for (const s of ['Rīga', 'Ķekava', 'Jēkabpils', 'Ādaži', 'Users123']) {
    assert.equal(norm(s).length, s.length, `garums ${s}`);
  }
});

test('norm — diakritikas-nejutīga apakšvirknes atbilstība', () => {
  assert.ok(norm('Ķekavas novada pašvaldība').includes(norm('kekava')));
  assert.ok(norm('Jēkabpils').includes(norm('jekab')));
});

test('pct — procenti ar noklusējuma 0 zīmēm', () => {
  assert.equal(pct(0.246), '25%');
  assert.equal(pct(0.5, 1), '50.0%');
  assert.equal(pct(null), '–');
  assert.equal(pct(undefined), '–');
});

test('eur — EUR bez decimāldaļām, null → domuzīme', () => {
  assert.equal(eur(null), '–');
  assert.equal(eur(undefined), '–');
  assert.match(eur(1000), /1/); // saturs atkarīgs no ICU, bet nav "–"
  assert.notEqual(eur(0), '–');
});

test('fmtRatio — reizinātājs ar 2 zīmēm', () => {
  assert.equal(fmtRatio(2), '2.00×');
  assert.equal(fmtRatio(null), '–');
});

test('levLE — robežota Levenšteina distance', () => {
  assert.ok(levLE('kalnins', 'kalnin', 1)); // 1 izdzēsts burts
  assert.ok(levLE('valts', 'valsts', 1)); // 1 iesprausts burts
  assert.ok(levLE('abc', 'abx', 1)); // 1 aizvietots
  assert.ok(!levLE('abc', 'xyz', 1)); // distance 3
  assert.ok(!levLE('kaut', 'pavisam', 1));
});

test('queryTokens — normalizēti tokeni ≥2 simboli', () => {
  assert.deepEqual(queryTokens('Jānis Kalniņš'), ['janis', 'kalnins']);
  assert.deepEqual(queryTokens('  a  Rīga '), ['riga']); // "a" izmests (<2)
});

test('tokenMatch — tokeni jebkurā secībā + typo tolerance', () => {
  const hay = norm('Jānis Kalniņš');
  assert.ok(tokenMatch(hay, queryTokens('kalnins janis'))); // apgriezta secība
  assert.ok(tokenMatch(hay, queryTokens('janis')));
  assert.ok(tokenMatch(norm('Latvijas valsts meži'), queryTokens('valsts mezi')));
  assert.ok(tokenMatch(norm('Latvijas valsts meži'), queryTokens('valts'))); // typo (≥5 → Levenšteins)
  assert.ok(!tokenMatch(hay, queryTokens('berzins')));
});

test('bandFromScore — sliekšņi un null', () => {
  assert.equal(bandFromScore(null, null), 'gray');
  assert.equal(bandFromScore(80, 'red'), 'red');
  assert.equal(bandFromScore(40, 'yellow'), 'yellow');
  assert.equal(bandFromScore(10, null), 'green');
});
