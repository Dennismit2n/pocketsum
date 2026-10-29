// Tests für den Rechenkern von Pocketsum.
// Der Kern steht als <script id="kg-mathe"> in index.html (eine Datei, läuft offline).
// Hier wird er herausgeschnitten und in Node ausgeführt – so bleibt die Auslieferung
// eine einzige HTML-Datei und die Formeln sind trotzdem geprüft.
//
// Ausführen:  node --test "tests/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(hier, '..', 'index.html'), 'utf8');
const treffer = html.match(/<script id="kg-mathe">([\s\S]*?)<\/script>/);
assert.ok(treffer, 'Block <script id="kg-mathe"> fehlt in index.html');
const KG = new Function(treffer[1] + '\n;return KG;')();

const nah = (ist, soll, toleranz = 1e-6) =>
  assert.ok(Math.abs(ist - soll) < toleranz, `erwartet ${soll}, bekommen ${ist}`);

// ---------- Zahlen einlesen ----------

test('parseZahl: deutsche und englische Schreibweisen', () => {
  assert.equal(KG.parseZahl('250'), 250);
  assert.equal(KG.parseZahl('1.234,56'), 1234.56);
  assert.equal(KG.parseZahl('1,234.56'), 1234.56);
  assert.equal(KG.parseZahl('1,899'), 1.899);
  assert.equal(KG.parseZahl('1.234.567'), 1234567);
  assert.equal(KG.parseZahl('1 500'), 1500);
  assert.equal(KG.parseZahl('12 €'), 12);
  assert.equal(KG.parseZahl('19 %'), 19);
  assert.equal(KG.parseZahl('-5'), -5);
  assert.equal(KG.parseZahl(',5'), 0.5);
  assert.equal(KG.parseZahl('1.5'), 1.5);
  assert.equal(KG.parseZahl('1.50'), 1.5);
  assert.equal(KG.parseZahl(42), 42);
});

test('parseZahl: ein Punkt mit drei Ziffern ist ein Tausenderpunkt – außer im €/l-Feld', () => {
  assert.equal(KG.parseZahl('5.000'), 5000);
  assert.equal(KG.parseZahl('1.000'), 1000);
  assert.equal(KG.parseZahl('95.000'), 95000);
  assert.equal(KG.parseZahl('0.512'), 0.512, 'führende Null bleibt Dezimalbruch');
  assert.equal(KG.parseZahl('1.899', true), 1.899, 'dez3: Spritpreis');
  assert.equal(KG.parseZahl('1,899', true), 1.899);
  assert.equal(KG.parseZahl('1.899'), 1899);
});

test('parseZahl: Sprachen mit Dezimalpunkt (Englisch, Hindi, Chinesisch, Japanisch, Koreanisch)', () => {
  const p = (s, dez3) => KG.parseZahl(s, dez3, true);
  assert.equal(p('5,000'), 5000);
  assert.equal(p('95,000'), 95000);
  assert.equal(p('1,234,567'), 1234567);
  assert.equal(p('1.5'), 1.5);
  assert.equal(p('1.899'), 1.899);
  assert.equal(p('1,234.56'), 1234.56);
  assert.equal(p('1.234,56'), 1234.56, 'beide Zeichen: das hintere ist das Dezimalzeichen');
  assert.equal(p('2,00'), 2, 'kein Dreiergruppen-Muster: Komma bleibt Dezimalzeichen');
  assert.equal(p('1,5'), 1.5);
  assert.equal(p('0,125'), 0.125, 'führende Null: nie ein Tausendertrenner');
  assert.equal(p('1,899', true), 1.899, 'dez3: Spritpreis');
  assert.equal(p('1.799', true), 1.799);
  assert.equal(p('€250'), 250);
  assert.equal(p('19%'), 19);
});

test('parseZahl: indische Gruppierung (Hindi) und Vollbreite (ja/zh/ko)', () => {
  assert.equal(KG.parseZahl('1,00,000', false, true), 100000);
  assert.equal(KG.parseZahl('12,34,567.50', false, true), 1234567.5);
  assert.equal(KG.parseZahl('€1,23,456.78', false, true), 123456.78);
  assert.ok(Number.isNaN(KG.parseZahl('1,23,4567', false, true)));
  assert.equal(KG.parseZahl('１００'), 100);
  assert.equal(KG.parseZahl('１２．５', false, true), 12.5);
  assert.equal(KG.parseZahl('１９％'), 19);
});

test('parseZahl: kopierte Werte mit Vorzeichen und Wortverbinder', () => {
  assert.equal(KG.parseZahl('−⁠9,76 €'), -9.76);
  assert.equal(KG.parseZahl('+⁠4,06 %'), 4.06);
  assert.equal(KG.parseZahl('-⁠€9.76', false, true), -9.76);
});

test('parseZahl: Leerzeichen als Tausendertrenner (Französisch, Polnisch, Russisch)', () => {
  assert.equal(KG.parseZahl('1 234,56'), 1234.56);
  assert.equal(KG.parseZahl('1 234,56'), 1234.56);
  assert.equal(KG.parseZahl('12 500'), 12500);
});

test('parseZahl: typografisches Minus und „250,-“', () => {
  assert.equal(KG.parseZahl('−5'), -5);
  assert.equal(KG.parseZahl('−5,00 €'), -5);
  assert.equal(KG.parseZahl('250,-'), 250);
  assert.equal(KG.parseZahl('250,–'), 250);
});

test('parseZahl: Unsinn ergibt NaN, nie einen Wurf', () => {
  assert.ok(Number.isNaN(KG.parseZahl('')));
  assert.ok(Number.isNaN(KG.parseZahl('abc')));
  assert.ok(Number.isNaN(KG.parseZahl('1,2,3.4')));
  assert.ok(Number.isNaN(KG.parseZahl('1.23.4')));
  assert.ok(Number.isNaN(KG.parseZahl('1e3')));
  assert.ok(Number.isNaN(KG.parseZahl(null)));
  assert.ok(Number.isNaN(KG.parseZahl(undefined)));
  assert.ok(Number.isNaN(KG.parseZahl('.')));
});

// ---------- Mehrwertsteuer ----------

test('mwst: netto → brutto bei 19 %', () => {
  const r = KG.mwst(100, 19, false);
  nah(r.netto, 100); nah(r.steuer, 19); nah(r.brutto, 119);
});

test('mwst: brutto → netto bei 19 % und 7 %', () => {
  let r = KG.mwst(119, 19, true);
  nah(r.netto, 100); nah(r.steuer, 19); nah(r.brutto, 119);
  r = KG.mwst(107, 7, true);
  nah(r.netto, 100); nah(r.steuer, 7);
});

test('mwst: 0 %, leere Eingabe, unsinniger Satz', () => {
  const r = KG.mwst(50, 0, true);
  nah(r.netto, 50); nah(r.steuer, 0);
  const l = KG.mwst(NaN, 19, false);
  nah(l.netto, 0); nah(l.brutto, 0);
  assert.doesNotThrow(() => KG.mwst(100, -100, true));
});

// ---------- Trinkgeld ----------

test('trinkgeld: 10 % ohne Runden', () => {
  const r = KG.trinkgeld(45, 10, 1, 0);
  nah(r.trinkgeld, 4.5); nah(r.gesamt, 49.5); nah(r.proPerson, 49.5);
  nah(r.effektivProzent, 10);
});

test('trinkgeld: Aufrunden auf volle Euro und auf 5 Euro', () => {
  let r = KG.trinkgeld(45, 10, 1, 1);
  nah(r.gesamt, 50); nah(r.trinkgeld, 5);
  r = KG.trinkgeld(45, 10, 1, 5);
  nah(r.gesamt, 50); nah(r.trinkgeld, 5);
  r = KG.trinkgeld(45, 10, 1, 0.5);
  nah(r.gesamt, 49.5); nah(r.trinkgeld, 4.5);
});

test('trinkgeld: Runden macht aus einem runden Betrag nicht mehr', () => {
  const r = KG.trinkgeld(50, 0, 1, 1);
  nah(r.gesamt, 50); nah(r.trinkgeld, 0);
});

test('trinkgeld: Aufteilen auf Personen, krumme Personenzahlen', () => {
  const r = KG.trinkgeld(45, 10, 2, 1);
  nah(r.gesamt, 50); nah(r.proPerson, 25); nah(r.tipProPerson, 2.5);
  assert.equal(KG.trinkgeld(45, 10, 0, 1).personen, 1);
  assert.equal(KG.trinkgeld(45, 10, -3, 1).personen, 1);
  assert.equal(KG.trinkgeld(45, 10, 2.5, 1).personen, 3);
});

test('trinkgeld: Gleitkomma-Kante beim Aufrunden', () => {
  // 0,1 + 0,2 ist in JS 0,30000000000000004 – darf nicht auf 0,40 springen
  const r = KG.trinkgeld(0.1, 200, 1, 0.1);
  nah(r.gesamt, 0.3, 1e-9);
});

// ---------- Sprit ----------

test('sprit: Vergleich alt/neu', () => {
  const r = KG.sprit(1.8, 1.9, 50, 7, 1000);
  nah(r.alt.fuellung, 90); nah(r.neu.fuellung, 95); nah(r.diff.fuellung, 5);
  nah(r.alt.pro100, 12.6); nah(r.neu.pro100, 13.3); nah(r.diff.pro100, 0.7);
  nah(r.alt.monat, 126); nah(r.neu.monat, 133); nah(r.diff.monat, 7);
  nah(r.diff.jahr, 84);
  nah(r.prozent, 100 / 18);
  nah(r.cent, 10);
});

test('sprit: Preis 0 ergibt keine Division durch null', () => {
  const r = KG.sprit(0, 1.9, 50, 7, 1000);
  assert.ok(!Number.isFinite(r.prozent) || r.prozent === 0);
});

test('spritTabelle: 5-Cent-Schritte um den aktuellen Preis', () => {
  const zeilen = KG.spritTabelle(1.8, 0.05, 50, 7, 1000);
  assert.equal(zeilen.length, 15);
  nah(zeilen[0].preis, 1.6);
  nah(zeilen[zeilen.length - 1].preis, 2.3);
  const aktuell = zeilen.find(z => z.aktuell);
  assert.ok(aktuell); nah(aktuell.preis, 1.8); nah(aktuell.monat, 126); nah(aktuell.diffMonat, 0);
  const plus10 = zeilen.find(z => Math.abs(z.preis - 1.9) < 1e-9);
  nah(plus10.diffMonat, 7);
});

test('spritTabelle: 1- und 10-Cent-Schritte, auch als Text „0.10“', () => {
  assert.equal(KG.spritTabelle(1.8, 0.01, 50, 7, 1000).length, 31);
  assert.equal(KG.spritTabelle(1.8, 0.1, 50, 7, 1000).length, 14);
  assert.equal(KG.spritTabelle(1.8, '0.10', 50, 7, 1000).length, 14);
});

test('spritTabelle: neuer Preis außerhalb verlängert die Tabelle, gedeckelt', () => {
  const zeilen = KG.spritTabelle(1.799, 0.01, 50, 7, 1000, 2.299);
  nah(zeilen[zeilen.length - 1].preis, 2.299);
  assert.equal(zeilen.length, 61);
  const runter = KG.spritTabelle(1.799, 0.05, 50, 7, 1000, 1.299);
  nah(runter[0].preis, 1.299);
  const extrem = KG.spritTabelle(1.8, 0.01, 50, 7, 1000, 9.99);
  assert.ok(extrem.length <= 71);
});

test('spritTabelle: Preise fallen nie unter 0', () => {
  const zeilen = KG.spritTabelle(0.1, 0.05, 50, 7, 1000);
  assert.ok(zeilen.every(z => z.preis >= 0));
});

// ---------- Dividende ----------

const basis = {
  modus: 'aktien', anzahl: 100, betrag: 0, kurs: 50,
  divModus: 'je', divJeAktie: 2, rendite: 0, ausschuettungen: 4,
  steuer: { aktiv: false, kist: 0, pauschbetrag: 1000, genutzt: 0, quellensteuer: 0, teilfrei: 0 }
};
const mitSteuer = (extra) => ({ ...basis, steuer: { aktiv: true, kist: 0, pauschbetrag: 1000, genutzt: 0, quellensteuer: 0, teilfrei: 0, ...extra } });

test('dividende: ohne Steuer', () => {
  const r = KG.dividende(basis);
  nah(r.anzahl, 100); nah(r.kapital, 5000); nah(r.brutto, 200);
  nah(r.bruttoJeAusschuettung, 50); nah(r.renditeBrutto, 4);
  nah(r.netto, 200); nah(r.nettoMonat, 200 / 12);
});

test('dividende: Anlagebetrag statt Stückzahl, Rendite statt Dividende je Aktie', () => {
  const r = KG.dividende({ ...basis, modus: 'betrag', betrag: 5000, divModus: 'rendite', rendite: 4 });
  nah(r.anzahl, 100); nah(r.divJeAktie, 2); nah(r.brutto, 200);
});

test('dividende: Sparer-Pauschbetrag deckt alles ab', () => {
  const r = KG.dividende(mitSteuer({}));
  nah(r.steuer.gesamt, 0); nah(r.netto, 200);
});

test('dividende: 25 % Abgeltungsteuer + 5,5 % Soli = 26,375 %', () => {
  const r = KG.dividende(mitSteuer({ genutzt: 1000 }));
  nah(r.steuer.est, 50); nah(r.steuer.soli, 2.75); nah(r.steuer.kist, 0);
  nah(r.steuer.gesamt, 52.75); nah(r.netto, 147.25);
});

test('dividende: Kirchensteuer 9 % nach § 32d Abs. 1 EStG (≈ 27,995 %)', () => {
  const r = KG.dividende(mitSteuer({ kist: 0.09, genutzt: 1000 }));
  const est = 200 / 4.09;
  nah(r.steuer.est, est, 1e-6);
  nah(r.steuer.soli, est * 0.055, 1e-6);
  nah(r.steuer.kist, est * 0.09, 1e-6);
  nah(r.steuer.gesamt / 200 * 100, 27.995, 0.001);
});

test('dividende: Kirchensteuer 8 % ergibt ≈ 27,82 %', () => {
  const r = KG.dividende(mitSteuer({ kist: 0.08, genutzt: 1000 }));
  nah(r.steuer.gesamt / 200 * 100, 27.82, 0.005);
});

test('dividende: Pauschbetrag teilweise verbraucht', () => {
  const r = KG.dividende(mitSteuer({ genutzt: 900 }));
  nah(r.steuerpflichtig, 100); nah(r.steuer.est, 25); nah(r.netto, 200 - 26.375);
});

test('dividende: US-Quellensteuer 15 % wird angerechnet', () => {
  const r = KG.dividende(mitSteuer({ genutzt: 1000, quellensteuer: 15 }));
  nah(r.steuer.quellen, 30); nah(r.steuer.est, 20); nah(r.steuer.soli, 1.1);
  nah(r.steuer.gesamt, 51.1); nah(r.netto, 148.9);
});

test('dividende: Quellensteuer über 15 % wird nur bis 15 % angerechnet', () => {
  const r = KG.dividende(mitSteuer({ genutzt: 1000, quellensteuer: 35 }));
  nah(r.steuer.quellen, 70); nah(r.steuer.est, 20); nah(r.netto, 200 - 70 - 21.1);
});

test('dividende: Quellensteuer bei vollem Pauschbetrag bleibt trotzdem weg', () => {
  const r = KG.dividende(mitSteuer({ quellensteuer: 15 }));
  nah(r.steuer.est, 0); nah(r.netto, 170);
});

test('dividende: Teilfreistellung 30 % für Aktien-ETF (§ 20 InvStG)', () => {
  const r = KG.dividende(mitSteuer({ genutzt: 1000, teilfrei: 0.3 }));
  nah(r.steuerpflichtig, 140); nah(r.steuer.est, 35); nah(r.steuer.gesamt, 36.925);
  nah(r.netto, 200 - 36.925);
  const m = KG.dividende(mitSteuer({ genutzt: 1000, teilfrei: 0.15 }));
  nah(m.steuerpflichtig, 170);
  // Pauschbetrag greift nach der Teilfreistellung
  const p = KG.dividende(mitSteuer({ genutzt: 900, teilfrei: 0.3 }));
  nah(p.steuerpflichtig, 40);
});

test('dividendeZiel: Stückzahl für ein Netto-Ziel', () => {
  const z = KG.dividendeZiel(100, basis);
  nah(z.anzahl, 600, 0.01); nah(z.kapital, 30000, 0.5);
  const zs = KG.dividendeZiel(100, mitSteuer({ genutzt: 1000 }));
  // 1200 € netto bei 26,375 % Steuer braucht 1629,88 € brutto = 814,94 Aktien
  nah(zs.anzahl, 1200 / 0.73625 / 2, 0.01);
  // mit Pauschbetrag: die ersten 1000 € steuerfrei → 1271,60 € brutto = 635,80 Aktien
  const zp = KG.dividendeZiel(100, mitSteuer({}));
  nah(zp.anzahl, (1000 + 200 / 0.73625) / 2, 0.01);
});

test('dividendeZiel: Kirchensteuer plus Quellensteuer, Netto trifft das Ziel exakt', () => {
  const o = mitSteuer({ kist: 0.09, genutzt: 1000, quellensteuer: 15 });
  const z = KG.dividendeZiel(100, o);
  nah(KG.dividende({ ...o, modus: 'aktien', anzahl: z.anzahl }).netto / 12, 100, 1e-6);
});

test('dividendeZiel: ohne Dividende kein Ziel, ohne Zielbetrag null', () => {
  assert.equal(KG.dividendeZiel(100, { ...basis, divJeAktie: 0 }), null);
  assert.equal(KG.dividendeZiel(0, basis), null);
});

test('dividende: Kurs 0 ergibt keine NaN-Werte', () => {
  const r = KG.dividende({ ...basis, kurs: 0, modus: 'betrag', betrag: 1000 });
  assert.ok(Number.isFinite(r.brutto));
});

// ---------- Trade-Kosten ----------

test('trade: Gebühren im Betrag enthalten (Krypto-Beispiel 1,49 % + 0,5 % Spread)', () => {
  const r = KG.trade({ betrag: 250, modus: 'inkl', prozent: 1.49, fix: 0, min: 0, spread: 0.5, kurs: 100000, runde: true });
  nah(r.kauf.angelegt, 250 / 1.0199);
  nah(r.kauf.gebuehr + r.kauf.spread + r.kauf.angelegt, 250);
  nah(r.kauf.gezahlt, 250);
  nah(r.kauf.einheiten, 250 / 1.0199 / 100000);
  nah(r.breakEvenProzent, (250 / (1 - 0.0199) / (250 / 1.0199) - 1) * 100);
  assert.equal(r.warnung, false);
});

test('trade: Gebühren obendrauf', () => {
  const r = KG.trade({ betrag: 250, modus: 'plus', prozent: 1.49, fix: 0, min: 0, spread: 0.5, kurs: 0, runde: false });
  nah(r.kauf.angelegt, 250); nah(r.kauf.gezahlt, 254.975);
  assert.equal(r.kauf.einheiten, null);
});

test('trade: Mindestgebühr greift (Direktbank-Beispiel)', () => {
  let r = KG.trade({ betrag: 250, modus: 'plus', prozent: 0.25, fix: 4.9, min: 9.9, spread: 0, kurs: 0, runde: false });
  nah(r.kauf.gebuehr, 9.9); nah(r.kauf.gezahlt, 259.9);
  r = KG.trade({ betrag: 250, modus: 'inkl', prozent: 0.25, fix: 4.9, min: 9.9, spread: 0, kurs: 0, runde: false });
  nah(r.kauf.angelegt, 240.1); nah(r.kauf.gebuehr, 9.9);
  r = KG.trade({ betrag: 10000, modus: 'inkl', prozent: 0.25, fix: 4.9, min: 9.9, spread: 0, kurs: 0, runde: false });
  nah(r.kauf.angelegt, (10000 - 4.9) / 1.0025);
});

test('trade: Mindestgebühr und Spread zusammen, alles summiert sich zum Betrag', () => {
  const r = KG.trade({ betrag: 250, modus: 'inkl', prozent: 0.25, fix: 4.9, min: 9.9, spread: 0.5, kurs: 0, runde: false });
  nah(r.kauf.angelegt + r.kauf.gebuehr + r.kauf.spread, 250);
  nah(r.kauf.gebuehr, 9.9);
});

test('trade: Break-even stimmt mit Nachrechnung überein', () => {
  const r = KG.trade({ betrag: 250, modus: 'inkl', prozent: 1.49, fix: 0, min: 0, spread: 0.5, kurs: 0, runde: true });
  const faktor = 1 + r.breakEvenProzent / 100;
  const wert = r.kauf.angelegt * faktor;
  const erloes = wert - Math.max(0, 0 + 0.0149 * wert) - 0.005 * wert;
  nah(erloes, 250, 1e-6);
});

test('trade: Break-even mit Mindestgebühr', () => {
  const r = KG.trade({ betrag: 250, modus: 'inkl', prozent: 0.25, fix: 4.9, min: 9.9, spread: 0, kurs: 0, runde: true });
  const wert = r.kauf.angelegt * (1 + r.breakEvenProzent / 100);
  const erloes = wert - Math.max(9.9, 4.9 + 0.0025 * wert);
  nah(erloes, 250, 1e-6);
});

test('trade: Sofortverkauf und Rundreise-Kosten', () => {
  const r = KG.trade({ betrag: 250, modus: 'plus', prozent: 1, fix: 1, min: 0, spread: 0, kurs: 0, runde: true });
  nah(r.kauf.kosten, 3.5); nah(r.verkauf.kosten, 3.5); nah(r.rundeKosten, 7);
  nah(r.verkauf.erloes, 246.5); nah(r.sofortVerlust, 253.5 - 246.5);
});

test('trade: Gebühren größer als Betrag', () => {
  const r = KG.trade({ betrag: 5, modus: 'inkl', prozent: 0, fix: 10, min: 0, spread: 0, kurs: 0, runde: true });
  nah(r.kauf.angelegt, 0);
  assert.ok(r.warnung);
});

test('trade: leerer Betrag ist keine Warnung, Gebühr ab 100 % wirft nicht', () => {
  const leer = KG.trade({ betrag: 0, modus: 'inkl', prozent: 1.49, fix: 0, min: 0, spread: 0.5, kurs: 0, runde: true });
  assert.equal(leer.warnung, false);
  nah(leer.kauf.angelegt, 0);
  const irr = KG.trade({ betrag: 250, modus: 'inkl', prozent: 100, fix: 0, min: 0, spread: 0, kurs: 0, runde: true });
  assert.ok(!Number.isFinite(irr.breakEvenProzent));
});
