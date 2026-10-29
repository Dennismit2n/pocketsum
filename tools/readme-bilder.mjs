// Bildschirmfotos für README und Werkstatt-Anleitung: drei Handy-Ansichten nebeneinander
// (Trade-Kosten mit Bitcoin-Kurs, Dividende, Spritpreis), je Sprache ein Bild.
//
//   node tools/readme-bilder.mjs [--url http://localhost:8625/pocketsum/] [--sprachen de,en]
//
// Ergebnis: docs/screens-<sprache>.webp. Braucht Python mit Pillow (für WebP).

import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(hier, '..');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(wurzel, '..', 'collective-calc', 'node_modules', 'playwright'));

const arg = (name, standard) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standard;
};
const basis = arg('--url', 'http://localhost:8625/pocketsum/');
const SPRACHEN = arg('--sprachen', 'de,en').split(',');
const ANSICHTEN = [
  { tab: 'trade', ziel: '#trade-kosten', vorher: (p) => p.fill('#trade-kurs', '95000') },
  { tab: 'divi', ziel: '#divi-netto' },
  { tab: 'sprit', ziel: '#sprit-prozent' },
];

const tmp = path.join(os.tmpdir(), 'pocketsum-readme-bilder');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(path.join(wurzel, 'docs'), { recursive: true });

const browser = await chromium.launch();
for (const sprache of SPRACHEN) {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    locale: sprache, colorScheme: 'dark',
  });
  await ctx.addInitScript((code) => { try { localStorage.clear(); localStorage.setItem('pocketsum.lang', code); } catch (e) {} }, sprache);
  const page = await ctx.newPage();
  const dateien = [];
  for (const a of ANSICHTEN) {
    await page.goto(basis + '#' + a.tab, { waitUntil: 'load' });
    if (a.vorher) await a.vorher(page);
    await page.evaluate((sel) => {
      const karte = document.querySelector(sel).closest('.karte');
      window.scrollTo(0, karte.getBoundingClientRect().top + window.scrollY - 92);
    }, a.ziel);
    await page.waitForTimeout(150);
    const datei = path.join(tmp, `${sprache}-${a.tab}.png`);
    await page.screenshot({ path: datei });
    dateien.push(datei);
  }
  await ctx.close();
  const ziel = path.join(wurzel, 'docs', `screens-${sprache}.webp`);
  execFileSync('python', [path.join(hier, 'zusammensetzen.py'), ziel, ...dateien], { stdio: 'inherit' });
}
await browser.close();
