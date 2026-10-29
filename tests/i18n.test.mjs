// Prüft die Übersetzungen in index.html (<script id="kg-i18n">):
// vierzehn Sprachen in der Werkstatt-Reihenfolge, überall dieselben Schlüssel, dieselben
// Platzhalter wie im Deutschen, keine leeren Texte, keine geraden Apostrophe – und dass jeder
// Schlüssel, den die Seite benutzt, auch existiert (und umgekehrt).
//
// Ausführen:  node --test "tests/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(hier, '..', 'index.html'), 'utf8');
const block = html.match(/<script id="kg-i18n">([\s\S]*?)<\/script>/);
assert.ok(block, 'Block <script id="kg-i18n"> fehlt in index.html');
const I18N = new Function(block[1] + '\n;return I18N;')();

const REIHENFOLGE = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'tr', 'ru', 'hi', 'zh', 'ja', 'ko'];
const platzhalter = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');

test('vierzehn Sprachen in der Reihenfolge der Werkstatt', () => {
  assert.deepEqual(Object.keys(I18N), REIHENFOLGE);
});

test('die Sprachliste im Kopf-Skript stimmt mit I18N überein', () => {
  const kopf = html.match(/var codes = \[([^\]]+)\]/);
  assert.ok(kopf, 'Sprachliste im Kopf-Skript nicht gefunden');
  const codes = kopf[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepEqual(codes, REIHENFOLGE);
});

test('jede Sprache hat genau die Schlüssel des Deutschen', () => {
  const soll = Object.keys(I18N.de).sort();
  for (const code of REIHENFOLGE) {
    const ist = Object.keys(I18N[code]).sort();
    const fehlt = soll.filter((k) => !ist.includes(k));
    const zuviel = ist.filter((k) => !soll.includes(k));
    assert.deepEqual({ code, fehlt, zuviel }, { code, fehlt: [], zuviel: [] });
  }
});

test('keine leeren Texte, keine geraden Apostrophe, gleiche Platzhalter wie im Deutschen', () => {
  for (const code of REIHENFOLGE) {
    for (const [key, wert] of Object.entries(I18N[code])) {
      assert.equal(typeof wert, 'string', `${code}.${key}`);
      assert.ok(wert.trim().length > 0, `${code}.${key} ist leer`);
      assert.ok(!wert.includes("'"), `${code}.${key} enthält einen geraden Apostroph: ${wert}`);
      assert.equal(platzhalter(wert), platzhalter(I18N.de[key]), `${code}.${key}: Platzhalter weichen ab`);
    }
  }
});

test('Sprachnamen sind eindeutig', () => {
  const namen = REIHENFOLGE.map((c) => I18N[c]._name);
  assert.equal(new Set(namen).size, namen.length);
});

test('jeder Schlüssel der Seite existiert, und jeder Schlüssel wird benutzt', () => {
  const benutzt = new Set();
  for (const m of html.matchAll(/data-i18n(?:-ph|-aria)?="([A-Za-z0-9]+)"/g)) benutzt.add(m[1]);
  // Schlüssel, die das Skript selbst einsetzt: t('…') und fmt('…', …) sowie Tabellen im Skript
  const ui = html.split('<script id="kg-i18n">')[1].split('</script>').slice(1).join('</script>');
  for (const m of ui.matchAll(/\b(?:t|fmt)\('([A-Za-z0-9]+)'/g)) benutzt.add(m[1]);
  const bekannt = (k) => I18N.de[k] !== undefined;
  for (const m of ui.matchAll(/\b\w+: '([a-z][A-Za-z0-9]+)'/g)) if (bekannt(m[1])) benutzt.add(m[1]);
  for (const m of ui.matchAll(/'([a-z][A-Za-z0-9]+)' : '([a-z][A-Za-z0-9]+)'/g)) {
    if (bekannt(m[1])) benutzt.add(m[1]);
    if (bekannt(m[2])) benutzt.add(m[2]);
  }
  const vorhanden = new Set(Object.keys(I18N.de).filter((k) => k !== '_name'));
  const fehlend = [...benutzt].filter((k) => !vorhanden.has(k));
  const unbenutzt = [...vorhanden].filter((k) => !benutzt.has(k));
  assert.deepEqual({ fehlend, unbenutzt }, { fehlend: [], unbenutzt: [] });
});
