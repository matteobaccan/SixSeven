/**
 * Mosse del catalogo (S7-xx).
 *
 * Ogni clip è un elenco di pose in gradi; `compileClip` ne ricava curve fluide
 * (vedi timeline.ts). Le convenzioni del rig sono documentate in poses.ts.
 *
 * Tutte iniziano e finiscono sulla posa di riposo, così le transizioni da e
 * verso Idle non producono salti (spec 4.3), e sono costruite in tre fasi —
 * preparazione, esecuzione, posa finale — come chiede la specifica.
 */
import type * as THREE from 'three';
import { compileClip } from './timeline.ts';
import {
  FIST,
  FLAT,
  INDEX_ONLY,
  OFFER,
  oneSide,
  OPEN_FINGERS,
  SPREAD,
  TWO,
  weigh,
  weighKey,
} from './poses.ts';
import { sym, type Pose } from './timeline.ts';

export const classicWeighing = (): THREE.AnimationClip =>
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
// S7-02 Reverse Weighing — la bilancia scomposta: più ampia e più rapida
// ---------------------------------------------------------------------------

/**
 * Stessa meccanica della bilancia classica, ma l'ampiezza quasi raddoppia e il
 * ritmo accelera; il busto accompagna con una torsione che nella versione
 * classica non c'è. L'effetto "scomposto" viene dal sovrascavalcamento su ogni
 * estremo, non da un movimento casuale.
 */
function reverseWeigh(lift: number): Pose {
  return {
    ...weigh(lift),
    Hips: [0, lift * 0.26, -lift * 0.1],
    Spine: [-3, -lift * 0.22, -lift * 0.2],
    Chest: [-6, -lift * 0.3, lift * 0.28],
    Head: [2, lift * 0.34, -lift * 0.5],
    Brow_L: [-14 - lift * 0.3, 0, 0],
    Brow_R: [-14 + lift * 0.3, 0, 0],
  };
}

export const reverseWeighing = (): THREE.AnimationClip =>
  compileClip('ReverseWeighing', [
    { t: 0, pose: {} },
    {
      t: 0.14,
      pose: sym({ Chest: [4, 0, 0], Shoulder_L: [0, 0, -7], LowerArm_L: [-12, 10, 0] }),
      hips: [0, -0.02, 0],
      ease: 'out',
    },
    { t: 0.42, pose: reverseWeigh(0), ease: 'overshoot' },
    { t: 0.72, pose: reverseWeigh(40), ease: 'overshoot' },
    { t: 1.0, pose: reverseWeigh(-42), ease: 'overshoot' },
    { t: 1.28, pose: reverseWeigh(44), ease: 'overshoot' },
    { t: 1.56, pose: reverseWeigh(-40), ease: 'overshoot' },
    { t: 1.84, pose: reverseWeigh(36), ease: 'overshoot' },
    { t: 2.12, pose: reverseWeigh(-30), ease: 'overshoot' },
    // Si inchioda al centro: il contrasto col ritmo precedente è la battuta.
    { t: 2.44, pose: reverseWeigh(0), ease: 'out' },
    { t: 2.72, pose: reverseWeigh(0) },
    { t: 3.04, pose: sym({ UpperArm_L: [2, -16, -5], LowerArm_L: [-34, 24, 3] }), ease: 'in' },
    { t: 3.4, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// S7-03 Finger Six-Seven — il gesto fatto con le dita
// ---------------------------------------------------------------------------

/** Mani davanti al petto, palmi verso il giocatore: le dita restano leggibili. */
const FINGERS_UP: Pose = sym({
  Chest: [-3, 0, 0],
  Neck: [3, 0, 0],
  Shoulder_L: [0, -5, 8],
  UpperArm_L: [-42, -22, -18],
  LowerArm_L: [-104, 34, 6],
  Hand_L: [-4, -6, 2],
});

export const fingerSixSeven = (): THREE.AnimationClip =>
  compileClip('FingerSixSeven', [
    { t: 0, pose: {} },
    { t: 0.18, pose: sym({ Chest: [3, 0, 0], Shoulder_L: [0, 0, -6] }), hips: [0, -0.015, 0], ease: 'out' },
    // Le mani salgono già aperte.
    { t: 0.52, pose: { ...FINGERS_UP, ...SPREAD }, ease: 'overshoot' },
    { t: 0.8, pose: { ...FINGERS_UP, ...SPREAD } },
    // Sei: una mano mostra due dita, l'altra resta chiusa. Pose tenute, perché
    // una conta fatta di dita si legge solo se si ferma.
    {
      t: 1.1,
      pose: { ...FINGERS_UP, ...oneSide(TWO, 'L'), ...oneSide(FIST, 'R'), Head: [0, 10, -6] },
      ease: 'out',
    },
    { t: 1.45, pose: { ...FINGERS_UP, ...oneSide(TWO, 'L'), ...oneSide(FIST, 'R'), Head: [0, 10, -6] } },
    // Sette: si invertono.
    {
      t: 1.75,
      pose: { ...FINGERS_UP, ...oneSide(FIST, 'L'), ...oneSide(TWO, 'R'), Head: [0, -10, 6] },
      ease: 'out',
    },
    { t: 2.1, pose: { ...FINGERS_UP, ...oneSide(FIST, 'L'), ...oneSide(TWO, 'R'), Head: [0, -10, 6] } },
    // Posa finale: tutte e due aperte, sopracciglia alzate.
    {
      t: 2.45,
      pose: { ...FINGERS_UP, ...SPREAD, Brow_L: [-18, 0, 0], Brow_R: [-18, 0, 0], Jaw: [6, 0, 0] },
      ease: 'overshoot',
    },
    { t: 2.8, pose: { ...FINGERS_UP, ...SPREAD, Brow_L: [-14, 0, 0], Brow_R: [-14, 0, 0] } },
    { t: 3.15, pose: sym({ UpperArm_L: [2, -14, -6], LowerArm_L: [-36, 16, 3] }), ease: 'in' },
    { t: 3.5, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// S7-04 67 Handshake — la mano tesa che diventa una presa in giro
// ---------------------------------------------------------------------------

export const handshake67 = (): THREE.AnimationClip =>
  compileClip('Handshake67', [
    { t: 0, pose: {} },
    // Si apre al giocatore: busto in avanti, mano tesa.
    {
      t: 0.4,
      pose: {
        ...oneSide(OFFER, 'L'),
        Spine: [5, -4, 0],
        Chest: [7, -6, -3],
        Neck: [-3, 3, 0],
        Head: [-5, 6, -3],
        Brow_L: [-16, 0, 0],
        Brow_R: [-16, 0, 0],
        Jaw: [4, 0, 0],
      },
      hips: [0, 0, 0.03],
      ease: 'out',
    },
    // Resta tesa: è l'invito, e deve durare abbastanza da essere creduto.
    {
      t: 1.0,
      pose: {
        ...oneSide(OFFER, 'L'),
        Spine: [6, -4, 0],
        Chest: [8, -6, -3],
        Head: [-6, 7, -4],
        Brow_L: [-16, 0, 0],
        Brow_R: [-16, 0, 0],
        Jaw: [5, 0, 0],
      },
      hips: [0, 0, 0.035],
    },
    // Ritira la mano di scatto e la porta alla nuca: il classico "troppo lento".
    {
      t: 1.3,
      pose: {
        Spine: [-4, 6, 0],
        Chest: [-6, 8, 4],
        Neck: [4, -4, 0],
        Head: [6, -8, 5],
        Brow_L: [-20, 0, 0],
        Brow_R: [6, 0, 0],
        Jaw: [8, 0, 3],
        Shoulder_L: [0, -4, 20],
        UpperArm_L: [-38, -52, -24],
        LowerArm_L: [-128, 20, 10],
        Hand_L: [-10, -20, 0],
        ...oneSide(SPREAD, 'L'),
      },
      hips: [0, 0.01, -0.03],
      ease: 'out',
    },
    {
      t: 1.75,
      pose: {
        Spine: [-3, 5, 0],
        Chest: [-5, 7, 3],
        Head: [5, -7, 4],
        Brow_L: [-18, 0, 0],
        Brow_R: [5, 0, 0],
        Jaw: [6, 0, 3],
        Shoulder_L: [0, -4, 18],
        UpperArm_L: [-36, -50, -22],
        LowerArm_L: [-126, 18, 10],
        Hand_L: [-10, -20, 0],
        ...oneSide(SPREAD, 'L'),
      },
      hips: [0, 0.008, -0.025],
    },
    // Chiude con una scrollata di spalle a palmi in su.
    {
      t: 2.2,
      pose: sym({
        Chest: [-3, 0, 0],
        Head: [-4, 0, 0],
        Brow_L: [-16, 0, 0],
        Jaw: [6, 0, 0],
        Shoulder_L: [0, 0, 16],
        UpperArm_L: [-30, -22, -14],
        LowerArm_L: [-84, 62, 6],
        Hand_L: [-6, -10, 4],
        ...OPEN_FINGERS,
      }),
      hips: [0, 0.014, 0],
      ease: 'overshoot',
    },
    { t: 2.65, pose: sym({ Shoulder_L: [0, 0, 5], UpperArm_L: [2, -12, -3], LowerArm_L: [-28, 20, 3] }) },
    { t: 3.0, pose: {}, ease: 'in' },
  ]);

// ---------------------------------------------------------------------------
// S7-05 Extreme Six Seven — la versione caricaturale, tutto il corpo
// ---------------------------------------------------------------------------

/** Bilancia portata all'eccesso: braccia larghe, busto e testa fuori asse. */
function extreme(lift: number): Pose {
  const l = lift;
  return {
    ...OPEN_FINGERS,
    Hips: [0, l * 0.3, -l * 0.12],
    Spine: [-4, -l * 0.26, -l * 0.24],
    Chest: [-8, -l * 0.34, l * 0.34],
    Neck: [4, l * 0.2, -l * 0.3],
    Head: [2, l * 0.4, -l * 0.62],
    Jaw: [10, 0, -l * 0.12],
    Brow_L: [-20 - l * 0.4, 0, 0],
    Brow_R: [-20 + l * 0.4, 0, 0],
    Eye_L: [0, -l * 0.2, 0],
    Eye_R: [0, -l * 0.2, 0],

    Shoulder_L: [0, -6, 6 + l * 0.5],
    UpperArm_L: [-36 - l * 0.6, -20, -14 - l * 0.3],
    LowerArm_L: [-100 - l * 1.3, 62, 8],
    Hand_L: [-6 - l * 0.3, -8, 6],

    Shoulder_R: [0, 6, -6 + l * 0.5],
    UpperArm_R: [-36 + l * 0.6, 20, 14 - l * 0.3],
    LowerArm_R: [-100 + l * 1.3, -62, -8],
    Hand_R: [-6 + l * 0.3, 8, -6],
  };
}

export const extremeSixSeven = (): THREE.AnimationClip =>
  compileClip('ExtremeSixSeven', [
    { t: 0, pose: {} },
    // Carica profonda: si accuccia prima di esplodere.
    {
      t: 0.22,
      pose: sym({
        Spine: [7, 0, 0],
        Chest: [9, 0, 0],
        Neck: [-6, 0, 0],
        Head: [-8, 0, 0],
        Shoulder_L: [0, 0, -10],
        UpperArm_L: [-2, -8, -4],
        LowerArm_L: [-14, 10, 0],
        Brow_L: [8, 0, 0],
      }),
      hips: [0, -0.045, -0.01],
      ease: 'out',
    },
    { t: 0.52, pose: extreme(0), hips: [0, 0.02, 0], ease: 'overshoot' },
    { t: 0.86, pose: extreme(34), hips: [-0.03, 0.01, 0], ease: 'overshoot' },
    { t: 1.2, pose: extreme(-34), hips: [0.03, 0.01, 0], ease: 'overshoot' },
    { t: 1.52, pose: extreme(40), hips: [-0.035, 0.015, 0], ease: 'overshoot' },
    { t: 1.84, pose: extreme(-40), hips: [0.035, 0.015, 0], ease: 'overshoot' },
    // Posa finale tenuta, braccia spalancate e smorfia.
    {
      t: 2.2,
      pose: {
        ...extreme(0),
        Jaw: [18, 0, 0],
        Brow_L: [16, 0, 0],
        Brow_R: [16, 0, 0],
        Eye_L: [8, 0, 0],
        Eye_R: [8, 0, 0],
      },
      hips: [0, 0.03, 0.02],
      ease: 'overshoot',
    },
    { t: 2.62, pose: { ...extreme(0), Jaw: [12, 0, 0], Brow_L: [10, 0, 0], Brow_R: [10, 0, 0] }, hips: [0, 0.02, 0.015] },
    { t: 3.0, pose: sym({ UpperArm_L: [2, -16, -6], LowerArm_L: [-34, 24, 3], Jaw: [4, 0, 0] }), ease: 'in' },
    { t: 3.45, pose: {} },
  ]);


// ---------------------------------------------------------------------------
// S7-06 To Di World — il braccio teso al cielo
// ---------------------------------------------------------------------------

/**
 * La posa di Usain Bolt, di origine dancehall: un braccio punta in alto e di
 * lato, l'altro resta piegato davanti al petto come chi tende un arco. Il
 * `reach` porta più in alto il braccio teso e accompagna la testa.
 */
function toDiWorld(reach: number): Pose {
  return {
    ...INDEX_ONLY,
    Hips: [0, -6, 2],
    Spine: [-4, -5, 7],
    Chest: [-7, -8, 10],
    Neck: [-4, 7, -6],
    Head: [-9 - reach * 0.1, 11, -9],
    Jaw: [7, 0, 0],
    Brow_L: [-21, 0, 0],
    Brow_R: [-21, 0, 0],
    Eye_L: [-7, 9, 0],
    Eye_R: [-7, 9, 0],

    // Braccio che punta: abdotto quasi in verticale, gomito quasi disteso.
    Shoulder_L: [0, 0, 20],
    UpperArm_L: [-12, -6, 80 + reach * 0.22],
    LowerArm_L: [-16, 12, 4],
    Hand_L: [-10, 0, 6],

    // Braccio dell'arco: piegato davanti al petto, pugno chiuso.
    Shoulder_R: [0, 6, 10],
    UpperArm_R: [-36, 24, 24],
    LowerArm_R: [-116, -38, -6],
    Hand_R: [-6, 12, -4],
    ...oneSide(FIST, 'R'),
  };
}

export const toDiWorldMove = (): THREE.AnimationClip =>
  compileClip('ToDiWorld', [
    { t: 0, pose: {} },
    // Carica: si raccoglie e abbassa le spalle prima di scattare.
    {
      t: 0.24,
      pose: sym({
        Spine: [6, 0, 0],
        Chest: [8, 0, 0],
        Neck: [-5, 0, 0],
        Head: [-7, 0, 0],
        Shoulder_L: [0, 0, -9],
        UpperArm_L: [-4, -8, -6],
        LowerArm_L: [-16, 10, 0],
        Brow_L: [7, 0, 0],
      }),
      hips: [0, -0.04, -0.01],
      ease: 'out',
    },
    // Scatto nella posa, con scavalcamento: il braccio supera e rientra.
    { t: 0.62, pose: toDiWorld(40), hips: [0, 0.03, 0], ease: 'overshoot' },
    { t: 0.9, pose: toDiWorld(0), hips: [0, 0.02, 0] },
    // Tenuta: è il fermo immagine della mossa, e deve durare.
    { t: 1.5, pose: toDiWorld(6), hips: [0, 0.022, 0] },
    { t: 2.1, pose: toDiWorld(0), hips: [0, 0.02, 0] },
    // Doppio rilancio del braccio, come nella posa originale.
    { t: 2.42, pose: toDiWorld(30), hips: [0, 0.03, 0], ease: 'overshoot' },
    { t: 2.78, pose: toDiWorld(4), hips: [0, 0.02, 0], ease: 'out' },
    { t: 3.2, pose: sym({ UpperArm_L: [2, -14, 6], LowerArm_L: [-30, 18, 3] }), ease: 'in' },
    { t: 3.6, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// S7-07 Six Foot Seven — l'altezza misurata con la mano
// ---------------------------------------------------------------------------

/**
 * Il numero del meme nasce da un'altezza: sei piedi e sette pollici, due metri
 * e uno. La mano piatta che misura sopra la testa è il gesto che la racconta.
 */
function heightCheck(raise: number): Pose {
  return {
    ...FLAT,
    Hips: [0, -5, 2],
    Spine: [-4, -5, 6],
    Chest: [-6, -8, 9],
    Neck: [-5, 5, -4],
    Head: [-15 - raise * 0.14, 8, -6],
    Jaw: [5, 0, 0],
    Brow_L: [-19 - raise * 0.1, 0, 0],
    Brow_R: [-19 - raise * 0.1, 0, 0],
    Eye_L: [-10, 8, 0],
    Eye_R: [-10, 8, 0],

    // Il braccio sale in diagonale, dentro la sagoma: di lato uscirebbe
    // dall'inquadratura, che è tarata sul primo piano. La mano resta piatta e
    // orizzontale sopra il capo, è lei a dare la misura.
    Shoulder_L: [0, 0, 20],
    UpperArm_L: [-12, -6, 96 + raise * 0.3],
    LowerArm_L: [-16, 16, 2],
    Hand_L: [16, -12, -36],

    // L'altra mano resta al fianco, chiusa.
    Shoulder_R: [0, 4, 6],
    UpperArm_R: [-16, 28, 14],
    LowerArm_R: [-80, -52, -4],
    Hand_R: [-4, 8, -4],
    ...oneSide(FIST, 'R'),
  };
}

export const sixFootSeven = (): THREE.AnimationClip =>
  compileClip('SixFootSeven', [
    { t: 0, pose: {} },
    { t: 0.2, pose: sym({ Chest: [4, 0, 0], Shoulder_L: [0, 0, -7] }), hips: [0, -0.018, 0], ease: 'out' },
    // La mano sale e si ferma sopra la testa.
    { t: 0.6, pose: heightCheck(18), ease: 'overshoot' },
    { t: 0.9, pose: heightCheck(0), ease: 'out' },
    // Due colpetti verso il basso: sta prendendo la misura.
    { t: 1.18, pose: heightCheck(-14) },
    { t: 1.42, pose: heightCheck(8) },
    { t: 1.66, pose: heightCheck(-10) },
    // Si ferma sulla misura e guarda il giocatore dall'alto.
    { t: 2.0, pose: { ...heightCheck(0), Head: [-10, 9, -5], Eye_L: [-4, 10, 0], Eye_R: [-4, 10, 0] } },
    { t: 2.5, pose: { ...heightCheck(2), Head: [-10, 9, -5], Jaw: [8, 0, 0], Eye_L: [-4, 10, 0], Eye_R: [-4, 10, 0] } },
    { t: 2.9, pose: sym({ UpperArm_L: [2, -12, 10], LowerArm_L: [-34, 14, 2] }), ease: 'in' },
    { t: 3.3, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// S7-08 Three Pointer — il tiro da tre, poi il gesto
// ---------------------------------------------------------------------------

/** Mani che reggono il pallone sopra la spalla, prima del rilascio. */
const SHOT_LOAD: Pose = {
  ...SPREAD,
  Spine: [5, 0, 0],
  Chest: [6, -4, 0],
  Neck: [-4, 0, 0],
  Head: [-6, 4, -2],
  Brow_L: [-14, 0, 0],
  Brow_R: [-14, 0, 0],

  Shoulder_L: [0, -4, 16],
  UpperArm_L: [-46, -18, 34],
  LowerArm_L: [-126, 46, 8],
  Hand_L: [-18, -8, 4],

  Shoulder_R: [0, 8, 6],
  UpperArm_R: [-30, 30, 18],
  LowerArm_R: [-118, -50, -6],
  Hand_R: [-14, 10, -6],
};

/** Rilascio: il braccio si distende verso l'alto e il polso ricade. */
const SHOT_RELEASE: Pose = {
  ...SPREAD,
  Spine: [-5, 0, 0],
  Chest: [-8, -3, 0],
  Neck: [-6, 0, 0],
  Head: [-14, 3, -2],
  Jaw: [6, 0, 0],
  Brow_L: [-20, 0, 0],
  Brow_R: [-20, 0, 0],
  Eye_L: [-10, 0, 0],
  Eye_R: [-10, 0, 0],

  // Braccio del tiro quasi verticale, polso abbandonato in avanti.
  Shoulder_L: [0, -4, 22],
  UpperArm_L: [-20, -10, 80],
  LowerArm_L: [-26, 20, 4],
  Hand_L: [-42, -6, 4],

  // L'altra mano accompagna e resta più bassa.
  Shoulder_R: [0, 6, 12],
  UpperArm_R: [-26, 26, 34],
  LowerArm_R: [-84, -46, -6],
  Hand_R: [-10, 10, -6],
};

export const threePointer = (): THREE.AnimationClip =>
  compileClip('ThreePointer', [
    { t: 0, pose: {} },
    // Piega le gambe e carica il tiro.
    { t: 0.26, pose: SHOT_LOAD, hips: [0, -0.05, 0], ease: 'out' },
    { t: 0.5, pose: SHOT_LOAD, hips: [0, -0.055, 0] },
    // Rilascio: sale sulle punte, il corpo si distende.
    { t: 0.78, pose: SHOT_RELEASE, hips: [0, 0.055, 0.01], ease: 'overshoot' },
    // Resta "nel canestro": il tiratore che non abbassa il braccio.
    { t: 1.25, pose: SHOT_RELEASE, hips: [0, 0.03, 0.008] },
    // Poi le mani cadono nella bilancia: il gesto arriva dopo il canestro.
    { t: 1.7, pose: weigh(0), hips: [0, 0, 0], ease: 'out' },
    weighKey(2.02, 26),
    weighKey(2.34, -26),
    weighKey(2.66, 22),
    { ...weighKey(2.98, 0), ease: 'out' },
    { t: 3.3, pose: weigh(0) },
    { t: 3.62, pose: sym({ UpperArm_L: [2, -16, -5], LowerArm_L: [-34, 24, 3] }), ease: 'in' },
    { t: 4.0, pose: {} },
  ]);
