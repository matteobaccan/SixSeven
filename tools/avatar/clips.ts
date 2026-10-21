/**
 * Clip di animazione dell'avatar.
 *
 * Le pose sono in gradi per bone; `compileClip` le trasforma in curve fluide
 * (vedi timeline.ts). Ogni clip parte e termina sulla posa di riposo, quindi le
 * transizioni da e verso Idle non producono salti (spec 4.3).
 *
 * Convenzioni utili per aggiungere nuove mosse:
 *  - a riposo il braccio pende a 20° dalla verticale, palmo in avanti;
 *  - una rotazione su Y della spalla orienta il piano in cui si piega il
 *    gomito: con -35° il gomito punta all'indietro e la mano va verso il
 *    centro del corpo;
 *  - ruotare l'avambraccio su X di circa -105° porta la mano davanti al
 *    petto con il palmo in alto;
 *  - le dita si chiudono con rotazioni negative su Z (il lato del palmo) e si
 *    aprono a ventaglio con rotazioni su X;
 *  - il palmo guarda verso l'interno a riposo: serve una supinazione
 *    dell'avambraccio (rotazione su Y) per rivoltarlo verso l'alto.
 */
import type * as THREE from 'three';
import { compileClip, sym, type Key, type Pose } from './timeline.ts';

// ---------------------------------------------------------------------------
// RX-05 Idle — respiro, spostamento del peso e micro-movimenti
// ---------------------------------------------------------------------------

const idle = (): THREE.AnimationClip =>
  compileClip('Idle', [
    { t: 0, pose: sym({ Chest: [0, 0, 0] }), hips: [0, 0, 0] },
    {
      t: 1.3,
      pose: {
        Spine: [-1.2, 1.5, 1],
        Chest: [-2.6, 1, -1.2],
        Neck: [1.6, -2, 0.8],
        Head: [1.2, -4.5, 1.6],
        Shoulder_L: [0, 0, 2.2],
        Shoulder_R: [0, 0, -1],
        UpperArm_L: [0, 0, 2.6],
        UpperArm_R: [0, 0, -1.6],
        LowerArm_L: [-4, 0, 3],
        LowerArm_R: [-2, 0, -2],
      },
      hips: [0.008, 0.007, 0],
    },
    {
      t: 2.5,
      pose: {
        Spine: [0.4, -0.8, -0.6],
        Chest: [0.6, -0.6, 0.8],
        Neck: [-0.6, 1.2, -0.5],
        Head: [-1.6, 3.2, -1.2],
        Brow_L: [-5, 0, 0],
        Brow_R: [-3, 0, 0],
        UpperArm_L: [0, 0, 0.6],
        UpperArm_R: [0, 0, -0.4],
        LowerArm_L: [-1, 0, 1],
        LowerArm_R: [-1, 0, -1],
      },
      hips: [-0.006, -0.004, 0],
    },
    {
      t: 3.7,
      pose: {
        Spine: [-1, -1.4, -0.8],
        Chest: [-2.2, -1, 1],
        Neck: [1.2, 2, -0.6],
        Head: [1.6, 3.6, -1.8],
        Shoulder_R: [0, 0, -2],
        UpperArm_L: [0, 0, 1.6],
        UpperArm_R: [0, 0, -2.4],
        LowerArm_L: [-3, 0, 2],
        LowerArm_R: [-4, 0, -3],
      },
      hips: [-0.008, 0.006, 0],
    },
    { t: 4.9, pose: sym({ Chest: [0, 0, 0] }), hips: [0, 0, 0] },
  ]);

// ---------------------------------------------------------------------------
// S7-01 Classic Weighing — la bilancia, con tutto il corpo in gioco
// ---------------------------------------------------------------------------

/** Dita aperte a ventaglio, con un po' di irregolarità: palmi in su. */
const OPEN_FINGERS: Pose = sym({
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
function weigh(lift: number): Pose {
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
    UpperArm_L: [-2, -35, -10 - l * 0.12],
    LowerArm_L: [-118 - l, 68, 4],
    Hand_L: [-4 - l * 0.2, -6, 4],

    Shoulder_R: [0, 4, -3 + l * 0.32],
    UpperArm_R: [-2, 35, 10 - l * 0.12],
    LowerArm_R: [-118 + l, -68, -4],
    Hand_R: [-4 + l * 0.2, 6, -4],
  };
}

/** Un'oscillazione completa della bilancia, con il rimbalzo del bacino. */
function weighKey(t: number, lift: number, ease?: Key['ease']): Key {
  return {
    t,
    pose: weigh(lift),
    hips: [-lift * 0.0009, -0.004 - Math.abs(lift) * 0.00016, 0],
    ...(ease ? { ease } : {}),
  };
}

const classicWeighing = (): THREE.AnimationClip =>
  compileClip('ClassicWeighing', [
    { t: 0, pose: {} },
    // Anticipo: prima di salire, le braccia e il busto scendono un istante.
    {
      t: 0.18,
      pose: sym({
        Chest: [3, 0, 0],
        Spine: [2, 0, 0],
        Shoulder_L: [0, 0, -5],
        UpperArm_L: [-2, -6, -2],
        LowerArm_L: [-10, 8, 1],
        Brow_L: [4, 0, 0],
      }),
      hips: [0, -0.016, 0],
      ease: 'out',
    },
    // Le mani arrivano in posizione con un leggero scavalcamento.
    { ...weighKey(0.56, 0), ease: 'overshoot' },
    // Esecuzione: sei oscillazioni, le centrali più ampie.
    weighKey(0.98, 21),
    weighKey(1.37, -21),
    weighKey(1.76, 30),
    weighKey(2.15, -30),
    weighKey(2.54, 24),
    weighKey(2.92, -16),
    // Si assesta al centro e tiene la posa: è il fermo immagine della mossa.
    { ...weighKey(3.24, 5), ease: 'out' },
    weighKey(3.6, 0),
    // Rientro.
    {
      t: 3.98,
      pose: sym({ UpperArm_L: [2, -16, -5], LowerArm_L: [-34, 24, 3], Chest: [-1, 0, 0] }),
      ease: 'in',
    },
    { t: 4.4, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// RX-02 Taunt — provocazione verso il giocatore
// ---------------------------------------------------------------------------

/** Indice teso verso il giocatore, le altre dita chiuse nel palmo. */
const POINT: Pose = {
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
function poke(amount: number): Pose {
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

const taunt = (): THREE.AnimationClip =>
  compileClip('Taunt', [
    { t: 0, pose: {} },
    // Anticipo: si carica indietro prima di puntare il dito.
    {
      t: 0.16,
      pose: { Spine: [-4, 0, 0], Chest: [-5, 0, 2], Head: [4, -4, 2], Brow_L: [6, 0, 0] },
      hips: [0, 0, -0.018],
      ease: 'out',
    },
    { t: 0.46, pose: POINT, hips: [0, 0, 0.022], ease: 'overshoot' },
    { t: 0.82, pose: poke(17), hips: [0, -0.012, 0.05], ease: 'out' },
    { t: 1.16, pose: POINT, hips: [0, 0, 0.022] },
    { t: 1.5, pose: poke(17), hips: [0, -0.012, 0.05], ease: 'out' },
    { t: 1.82, pose: POINT, hips: [0, 0, 0.022] },
    // Scrollata di spalle: palmi aperti, sopracciglia alzate.
    {
      t: 2.26,
      pose: sym({
        Chest: [-3, 0, 0],
        Head: [-4, 0, 0],
        Brow_L: [-16, 0, 0],
        Jaw: [6, 0, 0],
        Shoulder_L: [0, 0, 16],
        UpperArm_L: [4, -28, -12],
        LowerArm_L: [-86, 62, 6],
        Hand_L: [-6, -10, 4],
        ...OPEN_FINGERS,
      }),
      hips: [0, 0.014, 0],
      ease: 'overshoot',
    },
    { t: 2.72, pose: sym({ Shoulder_L: [0, 0, 5], UpperArm_L: [2, -12, -3], LowerArm_L: [-28, 0, 3] }) },
    { t: 3.1, pose: {}, ease: 'in' },
  ]);

// ---------------------------------------------------------------------------
// RX-01 Six Seven Face — smorfia esagerata
// ---------------------------------------------------------------------------

const sixSevenFace = (): THREE.AnimationClip =>
  compileClip('SixSevenFace', [
    { t: 0, pose: {} },
    // Carica: testa indietro, sopracciglia su, spalle che salgono.
    {
      t: 0.26,
      pose: sym({
        Neck: [-9, 0, 0],
        Head: [-12, 0, 0],
        Brow_L: [-24, 0, 0],
        Jaw: [3, 0, 0],
        Eye_L: [-7, 0, 0],
        Shoulder_L: [0, 0, 6],
        UpperArm_L: [0, 0, 5],
      }),
      hips: [0, 0.008, -0.012],
      ease: 'out',
    },
    // Smorfia: mandibola aperta, occhi strizzati, testa in avanti.
    {
      t: 0.52,
      pose: sym({
        Spine: [5, 0, 0],
        Chest: [7, 0, 0],
        Neck: [9, 0, 0],
        Head: [12, 0, 0],
        Brow_L: [18, 0, 0],
        Jaw: [20, 0, 0],
        Eye_L: [11, 0, 0],
        Shoulder_L: [0, 0, 10],
        UpperArm_L: [-4, -8, 14],
        LowerArm_L: [-30, 0, 10],
      }),
      hips: [0, -0.018, 0.026],
      ease: 'overshoot',
    },
    // Scuotimento laterale della testa, due passate.
    {
      t: 0.84,
      pose: sym({
        Spine: [5, -4, 0],
        Chest: [7, -2, 0],
        Neck: [6, 14, 0],
        Head: [9, 16, -7],
        Brow_L: [15, 0, 0],
        Jaw: [15, 0, 0],
        Eye_L: [9, 0, 0],
        Shoulder_L: [0, 0, 10],
        UpperArm_L: [-4, -8, 14],
        LowerArm_L: [-30, 0, 10],
      }),
      hips: [0, -0.014, 0.026],
    },
    {
      t: 1.14,
      pose: sym({
        Spine: [5, 4, 0],
        Chest: [7, 2, 0],
        Neck: [6, -14, 0],
        Head: [9, -16, 7],
        Brow_L: [15, 0, 0],
        Jaw: [15, 0, 0],
        Eye_L: [9, 0, 0],
        Shoulder_L: [0, 0, 10],
        UpperArm_L: [-4, -8, 14],
        LowerArm_L: [-30, 0, 10],
      }),
      hips: [0, -0.014, 0.026],
    },
    // Posa finale: mezzo sorriso di sufficienza, asimmetrico.
    {
      t: 1.58,
      pose: {
        Chest: [2, 0, 0],
        Neck: [2, 0, 0],
        Head: [2, -3, -4],
        Brow_L: [-18, 0, 0],
        Brow_R: [7, 0, 0],
        Jaw: [5, 0, 4],
        Eye_L: [4, -4, 0],
        Eye_R: [4, -4, 0],
      },
      ease: 'out',
    },
    { t: 2.3, pose: {}, ease: 'in' },
  ]);

export function buildClips(): THREE.AnimationClip[] {
  return [idle(), classicWeighing(), taunt(), sixSevenFace()];
}
