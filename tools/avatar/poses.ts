/**
 * Pose condivise fra le clip.
 *
 * Convenzioni del rig, valide per tutte le animazioni:
 *  - a riposo il braccio pende a 20° dalla verticale, palmo verso il corpo;
 *  - una rotazione su Y della spalla orienta il piano in cui si piega il
 *    gomito: con -35° il gomito punta all'indietro e la mano va verso il
 *    centro del corpo;
 *  - ruotare l'avambraccio su X di circa -105° porta la mano davanti al petto;
 *  - servono poi circa +68° su Y dell'avambraccio per rivoltare il palmo verso
 *    l'alto (supinazione): senza, la mano resta di taglio;
 *  - le dita si chiudono con rotazioni negative su Z (il lato del palmo) e si
 *    aprono a ventaglio con rotazioni su X.
 */
import { sym, type Key, type Pose } from './timeline.ts';

/** Dita aperte a ventaglio, con un po' di irregolarità: palmi in su. */
export const OPEN_FINGERS: Pose = sym({
  Thumb1_L: [0, -26, -16],
  Thumb2_L: [0, 0, -12],
  Index1_L: [-7, 0, -9],
  Index2_L: [0, 0, -7],
  Middle1_L: [-2, 0, -7],
  Middle2_L: [0, 0, -6],
  Ring1_L: [3, 0, -10],
  Ring2_L: [0, 0, -8],
  Pinky1_L: [8, 0, -14],
  Pinky2_L: [0, 0, -10],
});

/**
 * Posa della bilancia. `lift` positivo alza la mano sinistra e abbassa la
 * destra; il resto del corpo accompagna il movimento con controrotazioni di
 * bacino, busto, spalle e testa.
 */
export function weigh(lift: number): Pose {
  const l = lift;
  return {
    ...OPEN_FINGERS,

    // Il peso si sposta sulla gamba opposta al piatto che sale.
    Hips: [0, l * 0.14, -l * 0.06],
    Spine: [-2, -l * 0.1, -l * 0.12],
    Chest: [-5, -l * 0.16, l * 0.18],
    Neck: [3, l * 0.14, -l * 0.2],
    Head: [1, l * 0.28, -l * 0.4],
    Jaw: [2, 0, -l * 0.06],
    Brow_L: [-11 - l * 0.22, 0, 0],
    Brow_R: [-11 + l * 0.22, 0, 0],
    Eye_L: [0, -l * 0.12, 0],
    Eye_R: [0, -l * 0.12, 0],

    // Spalla ruotata su Y: il gomito resta al fianco e la mano arriva
    // davanti al petto invece che di lato.
    Shoulder_L: [0, -4, 3 + l * 0.32],
    UpperArm_L: [-38 - l * 0.5, -24, -16 - l * 0.12],
    LowerArm_L: [-112 - l * 1.4, 68, 4],
    Hand_L: [-4 - l * 0.2, -6, 4],

    Shoulder_R: [0, 4, -3 + l * 0.32],
    UpperArm_R: [-38 + l * 0.5, 24, 16 - l * 0.12],
    LowerArm_R: [-112 + l * 1.4, -68, -4],
    Hand_R: [-4 + l * 0.2, 6, -4],
  };
}

/** Un'oscillazione completa della bilancia, con il rimbalzo del bacino. */
export function weighKey(t: number, lift: number, ease?: Key['ease']): Key {
  return {
    t,
    pose: weigh(lift),
    hips: [-lift * 0.0009, -0.004 - Math.abs(lift) * 0.00016, 0],
    ...(ease ? { ease } : {}),
  };
}

/** Indice teso verso il giocatore, le altre dita chiuse nel palmo. */
export const POINT: Pose = {
  Spine: [6, 0, 0],
  Chest: [8, 0, -3],
  Neck: [-4, 0, 0],
  Head: [-6, 6, -4],
  Brow_L: [-15, 0, 0],
  Brow_R: [9, 0, 0],
  Jaw: [4, 0, 2],
  Eye_L: [0, -6, 0],
  Eye_R: [0, -6, 0],

  Shoulder_L: [0, -10, 6],
  UpperArm_L: [2, -34, -10],
  LowerArm_L: [-80, -4, 2],
  Hand_L: [-6, -14, 0],
  Index1_L: [-4, 0, -6],
  Index2_L: [0, 0, -4],
  Middle1_L: [0, 0, -92],
  Middle2_L: [0, 0, -86],
  Ring1_L: [4, 0, -94],
  Ring2_L: [0, 0, -86],
  Pinky1_L: [8, 0, -92],
  Pinky2_L: [0, 0, -86],
  Thumb1_L: [0, -34, -46],
  Thumb2_L: [0, 0, -30],

  // Il braccio libero resta rilassato ma non immobile.
  UpperArm_R: [-4, 6, 6],
  LowerArm_R: [-18, 4, -8],
};

/** Colpetto in avanti dell'indice, accompagnato dal busto. */
export function poke(amount: number): Pose {
  return {
    ...POINT,
    Spine: [6 + amount * 0.45, 0, 0],
    Chest: [8 + amount * 0.6, 0, -3],
    Head: [-6 - amount * 0.3, 8, -6],
    Jaw: [4 + amount * 0.35, 0, 3],
    Brow_L: [-18, 0, 0],
    Brow_R: [12, 0, 0],
    UpperArm_L: [2 - amount * 0.35, -34, -10],
    LowerArm_L: [-80 - amount * 0.6, -4, 2],
  };
}


/** Pugno chiuso. */
export const FIST: Pose = sym({
  Thumb1_L: [0, -30, -48],
  Thumb2_L: [0, 0, -34],
  Index1_L: [0, 0, -92],
  Index2_L: [0, 0, -86],
  Middle1_L: [0, 0, -94],
  Middle2_L: [0, 0, -88],
  Ring1_L: [4, 0, -94],
  Ring2_L: [0, 0, -88],
  Pinky1_L: [8, 0, -92],
  Pinky2_L: [0, 0, -86],
});

/** Dita tese e larghe: la posa più leggibile a distanza. */
export const SPREAD: Pose = sym({
  Thumb1_L: [0, -34, -10],
  Thumb2_L: [0, 0, -4],
  Index1_L: [-14, 0, -2],
  Middle1_L: [-4, 0, 0],
  Ring1_L: [6, 0, -2],
  Pinky1_L: [16, 0, -4],
});

/** Solo l'indice teso, verso l'alto: serve per indicare il cielo. */
export const INDEX_ONLY: Pose = sym({
  Thumb1_L: [0, -30, -46],
  Thumb2_L: [0, 0, -32],
  Index1_L: [-6, 0, -2],
  Index2_L: [0, 0, 0],
  Middle1_L: [0, 0, -92],
  Middle2_L: [0, 0, -86],
  Ring1_L: [4, 0, -94],
  Ring2_L: [0, 0, -86],
  Pinky1_L: [8, 0, -92],
  Pinky2_L: [0, 0, -86],
});

/** Mano piatta, dita unite: il taglio della mano che misura un'altezza. */
export const FLAT: Pose = sym({
  Thumb1_L: [0, -18, -26],
  Thumb2_L: [0, 0, -16],
  Index1_L: [-2, 0, -2],
  Middle1_L: [0, 0, -2],
  Ring1_L: [2, 0, -2],
  Pinky1_L: [5, 0, -4],
});

/** Solo indice e medio tesi, le altre chiuse. */
export const TWO: Pose = sym({
  Thumb1_L: [0, -30, -48],
  Thumb2_L: [0, 0, -34],
  Index1_L: [-10, 0, -2],
  Middle1_L: [4, 0, -2],
  Ring1_L: [4, 0, -94],
  Ring2_L: [0, 0, -88],
  Pinky1_L: [8, 0, -92],
  Pinky2_L: [0, 0, -86],
});

/** Mano aperta e girata verso il giocatore, come per dire "tocca a te". */
export const OFFER: Pose = {
  ...sym({
    Shoulder_L: [0, -8, 6],
    UpperArm_L: [-32, -26, -14],
    LowerArm_L: [-88, 52, 6],
    Hand_L: [-4, -8, 2],
  }),
  ...SPREAD,
};

/** Variante di una posa limitata a un solo lato: l'altro braccio resta fermo. */
export function oneSide(pose: Pose, side: 'L' | 'R'): Pose {
  const drop = side === 'L' ? '_R' : '_L';
  const out: Pose = {};
  for (const [name, rot] of Object.entries(pose)) {
    if (!name.endsWith(drop)) out[name] = rot;
  }
  return out;
}
