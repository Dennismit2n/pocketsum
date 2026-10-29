// Rendert die Bilder von Pocketsum aus favicon.svg und einer HTML-Vorlage:
//   icon-192.png, icon-512.png   – App-Symbol (abgerundet, wie favicon.svg)
//   icon-maskable.png            – für Android: Motiv im sicheren Kreis, Fläche bis zum Rand
//   og.png                       – Link-Vorschau 1200 × 630 im dunklen Familien-Entwurf der Werkstatt
//
//   node tools/bilder.mjs
//
// Playwright kommt aus dem Nachbar-Repo collective-calc (wird nicht installiert).

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(hier, '..');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(wurzel, '..', 'collective-calc', 'node_modules', 'playwright'));

const svg = readFileSync(path.join(wurzel, 'favicon.svg'), 'utf8');
const svgOhneEcken = svg.replace(/<rect width="44" height="44" rx="11"/, '<rect width="44" height="44"');
const daten = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function rendere(html, breite, hoehe, datei) {
  await page.setViewportSize({ width: breite, height: hoehe });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(wurzel, datei), omitBackground: true });
  console.log(datei, `${breite}×${hoehe}`);
}

const nurSymbol = (src, groesse, rand = 0, grund = 'transparent') => `<!doctype html><html><body style="margin:0;background:${grund}">
  <img src="${src}" style="display:block;width:${groesse - 2 * rand}px;height:${groesse - 2 * rand}px;margin:${rand}px"></body></html>`;

await rendere(nurSymbol(daten(svg), 192), 192, 192, 'icon-192.png');
await rendere(nurSymbol(daten(svg), 512), 512, 512, 'icon-512.png');
// Maskable: die Fläche reicht bis zum Rand, das Motiv bleibt im sicheren Kreis (80 %).
await rendere(nurSymbol(daten(svgOhneEcken), 512, 0, '#181831').replace('width:512px;height:512px;margin:0px', 'width:400px;height:400px;margin:56px'), 512, 512, 'icon-maskable.png');

// Link-Vorschau im Familien-Entwurf (wie og.png von Spectroton und wifi-qr).
const og = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:radial-gradient(ellipse 70% 80% at 50% 18%, #1c1a44 0%, #0F0F21 62%);
       font-family:"Segoe UI", system-ui, sans-serif;color:#E2E2F6;display:flex;flex-direction:column;align-items:center}
  img{width:132px;height:132px;margin-top:62px;border-radius:30px}
  h1{margin:28px 0 0;font-size:96px;line-height:1;font-weight:800;letter-spacing:-1px;color:#E2E2F6}
  .en{margin:22px 0 0;font-size:38px;color:#A5A5FF}
  .de{margin:12px 0 0;font-size:27px;color:#9C9ECD}
  .fuenf{margin:34px 0 0;display:flex;gap:14px;font-size:24px;font-weight:600}
  .fuenf span{padding:8px 18px;border-radius:999px;border:2px solid var(--f);color:var(--f);background:#181831}
  .balken{position:absolute;bottom:52px;left:470px;width:260px;height:6px;border-radius:3px;
          background:linear-gradient(90deg,#A5A5FF 0 20%,#FFC97A 20% 40%,#75C7FF 40% 60%,#7EE0A0 60% 80%,#FF9FB5 80% 100%)}
</style></head><body>
  <img src="${daten(svg)}" alt="">
  <h1>Pocketsum</h1>
  <p class="en">Five small calculators that want nothing from you</p>
  <p class="de">Fünf kleine Rechner, die nichts von dir wollen.</p>
  <div class="fuenf">
    <span style="--f:#A5A5FF">VAT</span><span style="--f:#FFC97A">Tips</span><span style="--f:#75C7FF">Fuel</span><span style="--f:#7EE0A0">Dividends</span><span style="--f:#FF9FB5">Trading costs</span>
  </div>
  <div class="balken"></div>
</body></html>`;
await rendere(og, 1200, 630, 'og.png');

await browser.close();
