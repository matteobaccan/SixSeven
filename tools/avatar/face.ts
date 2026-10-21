/**
 * Riferimenti del viso sulla caricatura originale.
 *
 * Il volto non è modellato: è la caricatura `public/assets/face.png` applicata
 * come texture a una superficie leggermente curva agganciata al bone `Head`.
 * Una caricatura disegnata non si riproduce accostando primitive 3D — il naso,
 * gli occhi socchiusi e il tratto sono scelte di disegno — mentre il corpo ha
 * bisogno di essere vero 3D per i gesti. Da qui la soluzione mista.
 *
 * Le coordinate qui sotto sono in pixel dell'immagine (540 × 773), misurate
 * sull'asset: servono a piazzare i bone facciali esattamente sopra occhi,
 * sopracciglia e bocca disegnati. Se l'immagine cambia vanno rimisurate.
 */

export interface Landmark {
  x: number;
  y: number;
}

export const FACE_IMAGE = { width: 540, height: 773 } as const;

/** Ritaglio usato dalla superficie: testa e collo, fino a prima del colletto. */
export const FACE_CROP = { x0: 100, x1: 462, y0: 12, y1: 452 } as const;

/** Punti misurati sull'immagine. `_L` è la sinistra anatomica del personaggio. */
export const FACE_LANDMARKS = {
  skullTop: { x: 280, y: 20 },
  chin: { x: 280, y: 430 },
  eye_L: { x: 353, y: 200 },
  eye_R: { x: 231, y: 194 },
  brow_L: { x: 362, y: 153 },
  brow_R: { x: 213, y: 148 },
  mouth: { x: 268, y: 344 },
} as const satisfies Record<string, Landmark>;

/** Metri per pixel: fissa la larghezza della testa a 0,60 m. */
export const FACE_SCALE = 0.6 / (FACE_CROP.x1 - FACE_CROP.x0 - 24);

/** Altezza del mento nel mondo: sopra l'apertura del maglione resta il collo. */
export const CHIN_Y = 1.4;

/** Profondità della superficie al centro e rientro ai bordi (dà volume). */
export const FACE_Z = 0.09;
export const FACE_CURVE = 0.085;

/** Mezza larghezza utile, per normalizzare la curvatura. */
export const FACE_HALF_WIDTH = ((FACE_CROP.x1 - FACE_CROP.x0) * FACE_SCALE) / 2;

/** Da pixel dell'immagine a coordinate mondo sulla superficie del viso. */
export function faceToWorld(p: Landmark): [number, number, number] {
  const x = (p.x - FACE_LANDMARKS.chin.x) * FACE_SCALE;
  const y = CHIN_Y + (FACE_LANDMARKS.chin.y - p.y) * FACE_SCALE;
  return [x, y, faceDepth(x)];
}

/** Profondità della superficie a una data ascissa: parabola morbida. */
export function faceDepth(x: number): number {
  const t = x / FACE_HALF_WIDTH;
  return FACE_Z - FACE_CURVE * t * t;
}
