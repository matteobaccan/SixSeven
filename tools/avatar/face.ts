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

/**
 * Ritaglio usato dalla superficie: testa e collo.
 *
 * Il bordo inferiore cade dove passa la costina del girocollo, che lo copre.
 */
export const FACE_CROP = { x0: 100, x1: 462, y0: 12, y1: 448 } as const;

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

/**
 * Altezza del mento nel mondo. Più è alta, più collo resta scoperto sopra il
 * maglione: è il parametro con cui si regola quanto il corpo sta in basso
 * rispetto alla testa.
 */
export const CHIN_Y = 1.46;

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

/**
 * Bordo laterale della superficie, misurato sull'immagine.
 *
 * Serve perché il personaggio indossi il solo maglione: nella caricatura le
 * punte del colletto della camicia risalgono lungo il collo fino all'altezza
 * della mascella, quindi nessun taglio orizzontale può escluderle. Sotto il
 * mento il bordo segue allora l'estensione dell'incarnato, rilevata riga per
 * riga sui pixel dell'asset; sopra, resta il ritaglio pieno e ci pensa il
 * canale alfa.
 *
 * Il contorno nero dipinto sul collo resta fuori insieme al colletto: non è un
 * problema, perché il filtro dei bordi disegna comunque una linea lungo la
 * sagoma.
 */
const FACE_EDGE: readonly (readonly [number, number, number])[] = [
  [0, FACE_CROP.x0, FACE_CROP.x1],
  [376, FACE_CROP.x0, FACE_CROP.x1],
  [398, 179, 388],
  [410, 182, 378],
  [422, 181, 366],
  [434, 181, 352],
  [448, 183, 347],
];

/** Estensione orizzontale della superficie a una data riga dell'immagine. */
export function faceSpanAt(imgY: number): { x0: number; x1: number } {
  let i = 0;
  while (i < FACE_EDGE.length - 2 && imgY > FACE_EDGE[i + 1][0]) i += 1;
  const [ya, ax0, ax1] = FACE_EDGE[i];
  const [yb, bx0, bx1] = FACE_EDGE[i + 1];
  const t = yb === ya ? 1 : Math.min(1, Math.max(0, (imgY - ya) / (yb - ya)));
  return { x0: ax0 + (bx0 - ax0) * t, x1: ax1 + (bx1 - ax1) * t };
}
