"""Setzt Handy-Bildschirmfotos nebeneinander auf dunklen Grund und speichert sie als WebP.

    python tools/zusammensetzen.py ziel.webp bild1.png bild2.png bild3.png

Jedes Bild bekommt abgerundete Ecken und einen feinen Rahmen in der Randfarbe von Pocketsum.
Das Ergebnis ist 1440 px breit; die Höhe folgt aus dem Seitenverhältnis der Bilder.
"""
import sys
from PIL import Image, ImageDraw

GRUND = (15, 15, 33)        # --bg dunkel
RAND = (45, 44, 79)         # --border dunkel
ZIELBREITE = 1440


def gerundet(bild, radius):
    maske = Image.new('L', bild.size, 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, bild.width - 1, bild.height - 1], radius=radius, fill=255)
    aus = Image.new('RGBA', bild.size, (0, 0, 0, 0))
    aus.paste(bild, (0, 0), maske)
    return aus


def main():
    ziel, *quellen = sys.argv[1:]
    bilder = [Image.open(q).convert('RGB') for q in quellen]
    b, h = bilder[0].size
    luecke, rand, radius = 48, 48, 44
    breite = len(bilder) * b + (len(bilder) - 1) * luecke + 2 * rand
    hoehe = h + 2 * rand
    blatt = Image.new('RGB', (breite, hoehe), GRUND)
    zeichnen = ImageDraw.Draw(blatt)
    for i, bild in enumerate(bilder):
        x = rand + i * (b + luecke)
        zeichnen.rounded_rectangle([x - 3, rand - 3, x + b + 2, rand + h + 2], radius=radius + 3, fill=RAND)
        g = gerundet(bild, radius)
        blatt.paste(g, (x, rand), g)
    faktor = ZIELBREITE / breite
    blatt = blatt.resize((ZIELBREITE, round(hoehe * faktor)), Image.LANCZOS)
    blatt.save(ziel, 'WEBP', quality=86, method=6)
    print(ziel, blatt.size)


if __name__ == '__main__':
    main()
