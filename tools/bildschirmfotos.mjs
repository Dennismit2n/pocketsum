// Bildschirmfotos und Bedienprobe aller fünf Rechner.
//
//   node tools/bildschirmfotos.mjs [--url http://localhost:8625/pocketsum/] [--sprachen de,en] [--breiten 412,1100] [--hell]
//
// Ohne --sprachen: alle vierzehn. Ergebnis: tools/shots/<sprache>/<rechner>-<breite>.png
// (der Ordner ist nicht versioniert). Meldet je Ansicht seitlichen Überlauf, Konsolenfehler,
// Zahlen, die als „NaN“ oder „undefined“ auf der Seite landen, und Texte, die wie
// unübersetzte Schlüssel aussehen.
//
// Playwright wird nicht installiert, sondern aus dem Nachbar-Repo collective-calc geladen
// (so halten es auch die anderen Werkzeuge der Werkstatt).

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(hier, '..', '..', 'collective-calc', 'node_modules', 'playwright'));

const arg = (name, standard) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standard;
};
const basis = arg('--url', 'http://localhost:8625/pocketsum/');
const SPRACHEN = arg('--sprachen', 'de,en,es,fr,it,nl,pl,pt,tr,ru,hi,zh,ja,ko').split(',');
const BREITEN = arg('--breiten', '412,1100').split(',').map(Number);
const HELL = process.argv.includes('--hell');
const TABS = ['mwst', 'tip', 'sprit', 'divi', 'trade'];

const browser = await chromium.launch();
let probleme = 0;
for (const sprache of SPRACHEN) {
  const ziel = path.join(hier, 'shots', sprache);
  mkdirSync(ziel, { recursive: true });
  for (const breite of BREITEN) {
    const handy = breite < 768;
    const ctx = await browser.newContext({
      viewport: { width: breite, height: handy ? 915 : 820 },
      deviceScaleFactor: handy ? 2 : 1, isMobile: handy, hasTouch: handy,
      locale: sprache, colorScheme: HELL ? 'light' : 'dark',
    });
    await ctx.addInitScript((code) => { try { localStorage.setItem('pocketsum.lang', code); } catch (e) {} }, sprache);
    const page = await ctx.newPage();
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });
    for (const tab of TABS) {
      await page.goto(basis + '#' + tab, { waitUntil: 'load' });
      await page.waitForTimeout(120);
      const befund = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          scroll: document.documentElement.scrollWidth, innen: window.innerWidth,
          nan: /NaN|undefined|Infinity/.test(text),
          roh: (text.match(/\b[a-z]+[A-Z][A-Za-z]+\b/g) || []).filter((w) => !/^(iPhone|macOS|iOS)$/.test(w)),
          lang: document.documentElement.lang,
          versteckt: document.documentElement.classList.contains('i18n-wartet'),
        };
      });
      const datei = path.join(ziel, `${tab}-${breite}.png`);
      await page.screenshot({ path: datei, fullPage: true });
      const meldung = [];
      if (befund.scroll > befund.innen) meldung.push(`ÜBERLAUF ${befund.scroll}/${befund.innen}`);
      if (befund.nan) meldung.push('NaN/undefined im Text');
      if (befund.roh.length) meldung.push('Rohschlüssel? ' + befund.roh.slice(0, 5).join(' '));
      if (befund.lang !== sprache) meldung.push(`lang=${befund.lang}`);
      if (befund.versteckt) meldung.push('Seite noch versteckt');
      if (meldung.length) { probleme++; console.log(`${sprache} ${breite} ${tab}: ${meldung.join(' · ')}`); }
    }
    if (fehler.length) { probleme++; console.log(`${sprache} ${breite}: Konsolenfehler:\n  ` + fehler.join('\n  ')); }
    await ctx.close();
  }
}
await browser.close();
console.log(probleme ? `${probleme} Auffälligkeiten` : `ohne Befund: ${SPRACHEN.length} Sprachen × ${BREITEN.length} Breiten × ${TABS.length} Rechner`);
