/**
 * Preparazione della texture del viso.
 *
 * `face-source.png` è la caricatura originale, intatta. Da lì si ricava
 * `public/assets/face.png` uniformando l'incarnato del collo.
 *
 * Perché serve: nella caricatura il collo è in ombra sul lato sinistro ed è
 * scuro sotto la mascella, perché sotto c'è il colletto della camicia che
 * giustifica quell'ombra. Togliendo il colletto — il personaggio indossa il
 * solo maglione — l'ombra resta sospesa e legge come un angolo scuro
 * innaturale. Non esiste un taglio della superficie che la eviti: l'ombra c'è
 * su ogni riga del collo. Si interviene quindi sui pixel, non sulla geometria.
 *
 * La modifica è circoscritta al collo e riproducibile: il viso non viene
 * toccato, e l'originale resta nel repository.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

/** Righe interessate: dal filo della mascella a prima del colletto. */
const NECK_ROWS = { from: 404, to: 452 } as const;

/** Incarnato in luce, campionato sul collo della caricatura. */
const LIT = [0xfd, 0xab, 0x7b] as const;

/** Un pixel "di carne": caldo. Esclude il colletto, che è bianco e freddo. */
function isFlesh(r: number, g: number, b: number): boolean {
  return r > 120 && r > b + 25 && g > b - 10;
}

/**
 * Il tratto nero disegnato: va conservato. La soglia è bassa di proposito —
 * le ombre più scure del collo arrivano attorno a 300 di somma, e con una
 * soglia alta venivano scambiate per tratto e lasciate lì, come striature.
 */
function isInk(r: number, g: number, b: number): boolean {
  return r + g + b < 130;
}

export function buildFaceTexture(sourcePath: string, outputPath: string): {
  width: number;
  height: number;
  changed: number;
} {
  const png = PNG.sync.read(readFileSync(sourcePath));
  let changed = 0;

  for (let y = NECK_ROWS.from; y <= NECK_ROWS.to && y < png.height; y++) {
    // Tratti di carne sulla riga. Le linee nere del mento spezzano il collo in
    // più segmenti: vanno uniformati tutti, non solo il più lungo, altrimenti
    // restano striature d'ombra fra una linea e l'altra.
    const runs: [number, number][] = [];
    let start: number | null = null;

    for (let x = 0; x <= png.width; x++) {
      const i = (png.width * y + x) << 2;
      const inside =
        x < png.width &&
        png.data[i + 3] > 128 &&
        (isFlesh(png.data[i], png.data[i + 1], png.data[i + 2]) ||
          isInk(png.data[i], png.data[i + 1], png.data[i + 2]));

      if (inside && start === null) start = x;
      if (!inside && start !== null) {
        // I tratti sottili sono contorni del colletto, non collo.
        if (x - start > 10) runs.push([start, x - 1]);
        start = null;
      }
    }

    for (const [from, to] of runs) {
      for (let x = from; x <= to; x++) {
        const i = (png.width * y + x) << 2;
        if (png.data[i + 3] <= 128) continue;
        if (isInk(png.data[i], png.data[i + 1], png.data[i + 2])) continue;
        png.data[i] = LIT[0];
        png.data[i + 1] = LIT[1];
        png.data[i + 2] = LIT[2];
        changed += 1;
      }
    }
  }

  writeFileSync(outputPath, PNG.sync.write(png));
  return { width: png.width, height: png.height, changed };
}
