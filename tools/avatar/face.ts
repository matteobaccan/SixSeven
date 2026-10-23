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
export const FACE_CROP = { x0: 100, x1: 462, y0: 12, y1: 467 } as const;

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
 * Altezza, nel mondo, della riga 430 dell'immagine. Alzandola sale la testa
 * senza spostare il corpo: insieme all'arco del mento regola la distanza fra i
 * due.
 */
/**
 * Margine attorno alla regione usata, in pixel dell'immagine sorgente.
 *
 * La texture esportata è `FACE_CROP` allargato di questo margine, non
 * l'immagine intera: dei 540x773 originali se ne usa meno della metà, e il
 * resto erano 285 kB scaricati per niente. Il margine serve perché ai bordi il
 * filtraggio bilineare campiona anche appena fuori dalla regione mappata;
 * senza, prenderebbe il pixel di bordo ripetuto e il contorno del viso
 * cambierebbe di un pixel — proprio il dettaglio più lavorato.
 */
export const FACE_TEXTURE_MARGIN = 3;

/** Regione dell'immagine sorgente effettivamente esportata nella texture. */
export const FACE_TEXTURE_CROP = {
  x0: Math.max(0, FACE_CROP.x0 - FACE_TEXTURE_MARGIN),
  y0: Math.max(0, FACE_CROP.y0 - FACE_TEXTURE_MARGIN),
  x1: Math.min(FACE_IMAGE.width, FACE_CROP.x1 + FACE_TEXTURE_MARGIN),
  y1: Math.min(FACE_IMAGE.height, FACE_CROP.y1 + FACE_TEXTURE_MARGIN),
} as const;

export const CHIN_Y = 1.547;

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
 * La testa finisce al mento: niente collo. È il trucco del burattino — testa
 * sospesa sopra il corpo, con un po' d'aria in mezzo — e risolve in un colpo
 * solo il colletto della camicia, l'ombra dipinta sul collo e la giunzione fra
 * disegno e geometria, che erano tre problemi distinti dello stesso punto.
 *
 * Il bordo inferiore cade appena sotto la piega del mento: il filtro dei bordi
 * gli disegna attorno il suo contorno, quindi il taglio legge come la base
 * della testa e non come una sezione.
 */
const FACE_EDGE: readonly (readonly [number, number, number])[] = [
  [0, FACE_CROP.x0, FACE_CROP.x1],
  [380, FACE_CROP.x0, FACE_CROP.x1],
  [390, 160, 403],
  [398, 165, 397],
  [406, 170, 390],
  [414, 171, 383],
  [422, 173, 375],
  [430, 174, 366],
  [FACE_CROP.y1, 176, 362],
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

/**
 * Bordo inferiore della testa: il contorno disegnato della mascella.
 *
 * Con la testa staccata dal corpo il bordo inferiore è una linea di contorno
 * vera e propria. Non può quindi essere un taglio arbitrario: segue il tratto
 * nero che nella caricatura chiude il mento, misurato colonna per colonna.
 * Scende fino a y≈466 al centro e risale ai lati, perché il viso è leggermente
 * girato.
 *
 * Le coppie sono (x nell'immagine, ultima riga inclusa).
 */
const CHIN_EDGE: readonly (readonly [number, number])[] = [
  [162, 394],
  [176, 412],
  [186, 420],
  [205, 434],
  [235, 455],
  [265, 466],
  [295, 467],
  [325, 459],
  [348, 447],
  [368, 430],
  [382, 416],
  [401, 392],
];

/**
 * Riga dell'immagine su cui finisce la superficie, a una data ascissa.
 *
 * Prende la x e non la colonna della griglia: l'estensione delle righe varia
 * (vedi `FACE_EDGE`), quindi la stessa colonna cade su x diverse a altezze
 * diverse, e l'arco risulterebbe sfalsato rispetto al disegno.
 */
export function chinBottomAt(imgX: number): number {
  let i = 0;
  while (i < CHIN_EDGE.length - 2 && imgX > CHIN_EDGE[i + 1][0]) i += 1;
  const [xa, ya] = CHIN_EDGE[i];
  const [xb, yb] = CHIN_EDGE[i + 1];
  const t = xb === xa ? 1 : Math.min(1, Math.max(0, (imgX - xa) / (xb - xa)));
  return ya + (yb - ya) * t;
}
