/**
 * Preparazione della texture del viso.
 *
 * `face-source.png` è la caricatura originale, intatta. Da lì si ricava
 * `public/assets/face.png` con due interventi circoscritti alla zona del collo:
 * il colletto della camicia reso trasparente e l'incarnato uniformato.
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

/** Righe interessate dall'uniformatura dell'incarnato del collo. */
const NECK_ROWS = { from: 404, to: 452 } as const;

/**
 * Righe in cui il colletto della camicia viene reso trasparente.
 *
 * Fra il contorno nero della mascella e le punte del colletto c'è una fessura
 * di *un solo pixel*: con il filtraggio bilineare della texture, qualunque
 * bordo della superficie pesca comunque il pixel accanto, e sul viso compare
 * una scheggia di colletto. Inseguire il pixel giusto è una battaglia persa:
 * si toglie il colletto dalla texture, e il canale alfa fa da sagoma.
 */
const COLLAR_ROWS = { from: 378, to: 472 } as const;

/** Ascissa da cui parte la ricerca del tratto di viso: il centro della testa. */
const HEAD_CENTRE_X = 280;

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
  erased: number;
} {
  const png = PNG.sync.read(readFileSync(sourcePath));
  let changed = 0;
  let erased = 0;

  const isFace = (i: number): boolean =>
    png.data[i + 3] > 128 &&
    (isFlesh(png.data[i], png.data[i + 1], png.data[i + 2]) ||
      isInk(png.data[i], png.data[i + 1], png.data[i + 2]));

  // 1) Colletto via dalla zona della testa. Per ogni riga si cammina dal centro
  // verso l'esterno finché il viso è contiguo — ammessi stacchi di un paio di
  // pixel, che sono l'antialiasing del tratto — e tutto ciò che sta oltre
  // diventa trasparente.
  for (let y = COLLAR_ROWS.from; y <= COLLAR_ROWS.to && y < png.height; y++) {
    for (const direction of [-1, 1] as const) {
      let edge = HEAD_CENTRE_X;
      let gap = 0;
      for (let x = HEAD_CENTRE_X; x >= 0 && x < png.width; x += direction) {
        if (isFace((png.width * y + x) << 2)) {
          edge = x;
          gap = 0;
        } else if (++gap > 3) {
          break;
        }
      }
      for (let x = edge + direction; x >= 0 && x < png.width; x += direction) {
        const i = (png.width * y + x) << 2;
        if (png.data[i + 3] === 0) continue;
        png.data[i + 3] = 0;
        erased += 1;
      }
    }
  }

  // 2) Incarnato del collo uniformato (vedi sopra).
  for (let y = NECK_ROWS.from; y <= NECK_ROWS.to && y < png.height; y++) {
    const runs: [number, number][] = [];
    let start: number | null = null;

    for (let x = 0; x <= png.width; x++) {
      const inside = x < png.width && isFace((png.width * y + x) << 2);
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
  return { width: png.width, height: png.height, changed, erased };
}
