// Testvektoren aus Segment 0 gegen den Deep-Link-Parser (K1).
// Die Fixture ist in allen drei Site-Repos byte-identisch; jeder Fall traegt
// sein eigenes "today" und seine eigene Site-Konfiguration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const deeplink = require('../js/deeplink.js');

const cases = JSON.parse(
  readFileSync(new URL('./fixtures/deeplink-cases.json', import.meta.url), 'utf8')
);

// 'YYYY-MM-DD' als lokale Mitternacht, wie der Parser sie auch aus dem
// Browserdatum bildet. new Date('YYYY-MM-DD') waere UTC und verschoebe die
// Grenzfaelle "Anreise heute" und "Anreise gestern" um einen Tag.
function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

test('Fixture traegt die 46 Faelle aus Segment 0', () => {
  assert.equal(cases.length, 46);
});

test('window-freie Einbindung liefert parse und VERSION', () => {
  assert.equal(typeof deeplink.parse, 'function');
  assert.equal(deeplink.VERSION, '1');
});

for (const c of cases) {
  test(`deeplink-case: ${c.name}`, () => {
    const cfg = {
      today: localDate(c.today),
      properties: c.site.properties,
      langs: c.site.langs,
      defaultProperty: c.site.defaultProperty
    };
    assert.deepEqual(deeplink.parse(c.query, cfg), c.expect);
  });
}

test('kaputte Eingaben werfen nicht', () => {
  const cfg = {
    today: localDate('2026-09-06'),
    properties: { HCSI: 4 },
    langs: ['de', 'en'],
    defaultProperty: 'HCSI'
  };
  for (const q of [undefined, null, '', '?', '?&&=', '?arrival=%E0%A4%A', '?adults']) {
    const r = deeplink.parse(q, cfg);
    assert.equal(r.search, null);
    assert.equal(r.source, null);
  }
  assert.equal(deeplink.parse('?room=DZSU').preselect.room, 'DZSU');
});

test('doppelter Parameter: der erste Wert gewinnt', () => {
  const cfg = {
    today: localDate('2026-09-06'),
    properties: { HCSI: 4 },
    langs: ['de', 'en'],
    defaultProperty: 'HCSI'
  };
  const r = deeplink.parse('?arrival=2026-10-10&departure=2026-10-12&adults=3&adults=4', cfg);
  assert.equal(r.search.adults, 3);
});
