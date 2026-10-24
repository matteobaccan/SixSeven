/**
 * Reazioni del catalogo (RX-xx).
 *
 * Le reazioni non sono legate a una singola mossa: la logica di gioco sceglie
 * quale usare in base al contesto (spec 4.2). Le convenzioni del rig sono
 * documentate in poses.ts.
 */
import type * as THREE from 'three';
import { compileClip, sym, type Pose } from './timeline.ts';
import { FLAT, OFFER, oneSide, OPEN_FINGERS, POINT, poke, SPREAD } from './poses.ts';

// ---------------------------------------------------------------------------
// RX-05 Idle — respiro, spostamento del peso e micro-movimenti
// ---------------------------------------------------------------------------

export const idle = (): THREE.AnimationClip =>
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

export const taunt = (): THREE.AnimationClip =>
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

export const sixSevenFace = (): THREE.AnimationClip =>
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


// ---------------------------------------------------------------------------
// RX-03 Celebration — reazione festosa
// ---------------------------------------------------------------------------

export const celebration = (): THREE.AnimationClip =>
  compileClip('Celebration', [
    { t: 0, pose: {} },
    // Si accuccia un istante: senza carica il salto non si legge.
    {
      t: 0.18,
      pose: sym({ Spine: [6, 0, 0], Chest: [8, 0, 0], Head: [-6, 0, 0], Shoulder_L: [0, 0, -8] }),
      hips: [0, -0.035, 0],
      ease: 'out',
    },
    // Braccia in alto e testa indietro.
    {
      t: 0.48,
      pose: sym({
        Spine: [-6, 0, 0],
        Chest: [-10, 0, 0],
        Neck: [-8, 0, 0],
        Head: [-14, 0, 0],
        Brow_L: [-22, 0, 0],
        Jaw: [16, 0, 0],
        Eye_L: [-6, 0, 0],
        Shoulder_L: [0, -4, 26],
        UpperArm_L: [-18, -14, 58],
        LowerArm_L: [-30, 10, 26],
        Hand_L: [0, -6, 8],
        ...SPREAD,
      }),
      hips: [0, 0.05, 0],
      ease: 'overshoot',
    },
    // Due scrolloni di giubilo.
    {
      t: 0.78,
      pose: sym({
        Spine: [-4, 0, 0],
        Chest: [-7, 0, 0],
        Head: [-10, 0, 0],
        Brow_L: [-20, 0, 0],
        Jaw: [12, 0, 0],
        Shoulder_L: [0, -4, 20],
        UpperArm_L: [-10, -14, 48],
        LowerArm_L: [-20, 10, 22],
        ...SPREAD,
      }),
      hips: [0, 0.02, 0],
    },
    {
      t: 1.06,
      pose: sym({
        Spine: [-6, 0, 0],
        Chest: [-10, 0, 0],
        Head: [-14, 0, 0],
        Brow_L: [-22, 0, 0],
        Jaw: [16, 0, 0],
        Shoulder_L: [0, -4, 26],
        UpperArm_L: [-18, -14, 58],
        LowerArm_L: [-30, 10, 26],
        ...SPREAD,
      }),
      hips: [0, 0.05, 0],
      ease: 'out',
    },
    // Scende con le braccia che continuano per inerzia.
    {
      t: 1.5,
      pose: sym({
        Chest: [-2, 0, 0],
        Head: [-4, 0, 0],
        Brow_L: [-16, 0, 0],
        Jaw: [8, 0, 0],
        Shoulder_L: [0, 0, 12],
        UpperArm_L: [-4, -20, 22],
        LowerArm_L: [-40, 30, 12],
        ...OPEN_FINGERS,
      }),
      hips: [0, -0.01, 0],
      ease: 'out',
    },
    { t: 1.95, pose: sym({ Shoulder_L: [0, 0, 4], UpperArm_L: [0, -8, 6], LowerArm_L: [-14, 12, 4] }) },
    { t: 2.35, pose: {}, ease: 'in' },
  ]);

// ---------------------------------------------------------------------------
// RX-04 Disappointed — reazione ironica quando non arriva niente
// ---------------------------------------------------------------------------

export const disappointed = (): THREE.AnimationClip =>
  compileClip('Disappointed', [
    { t: 0, pose: {} },
    // Resta immobile un attimo: è la pausa a fare la battuta.
    { t: 0.3, pose: sym({ Brow_L: [-6, 0, 0] }) },
    // Spalle giù, testa che cade di lato, sguardo in basso.
    {
      t: 0.85,
      pose: {
        Spine: [3, 0, 0],
        Chest: [5, 0, -2],
        Neck: [5, 0, 3],
        Head: [7, -5, 8],
        Brow_L: [10, 0, 0],
        Brow_R: [-10, 0, 0],
        Jaw: [3, 0, -2],
        Eye_L: [7, 0, 0],
        Eye_R: [7, 0, 0],
        Shoulder_L: [0, 0, -12],
        Shoulder_R: [0, 0, 12],
        UpperArm_L: [2, -6, -6],
        UpperArm_R: [2, 6, 6],
        LowerArm_L: [-10, 6, 2],
        LowerArm_R: [-10, -6, -2],
      },
      hips: [0, -0.022, 0],
      ease: 'out',
    },
    // Sospiro: il petto si alza e ricade.
    {
      t: 1.4,
      pose: {
        Spine: [0, 0, 0],
        Chest: [-3, 0, -2],
        Neck: [3, 0, 3],
        Head: [4, -5, 8],
        Brow_L: [8, 0, 0],
        Brow_R: [-8, 0, 0],
        Jaw: [6, 0, -2],
        Eye_L: [5, 0, 0],
        Eye_R: [5, 0, 0],
        Shoulder_L: [0, 0, 6],
        Shoulder_R: [0, 0, -6],
      },
      hips: [0, 0.008, 0],
      ease: 'inOut',
    },
    {
      t: 2.0,
      pose: {
        Spine: [4, 0, 0],
        Chest: [6, 0, -2],
        Neck: [6, 0, 4],
        Head: [8, -6, 10],
        Brow_L: [12, 0, 0],
        Brow_R: [-12, 0, 0],
        Jaw: [2, 0, -3],
        Eye_L: [8, 0, 0],
        Eye_R: [8, 0, 0],
        Shoulder_L: [0, 0, -14],
        Shoulder_R: [0, 0, 14],
      },
      hips: [0, -0.028, 0],
      ease: 'out',
    },
    { t: 2.6, pose: sym({ Chest: [2, 0, 0], Head: [3, 0, 3], Brow_L: [4, 0, 0] }), hips: [0, -0.01, 0] },
    { t: 3.05, pose: {}, ease: 'in' },
  ]);

// ---------------------------------------------------------------------------
// RX-06 Turn Transition — passaggio di turno al giocatore
// ---------------------------------------------------------------------------

/**
 * Breve e univoca: la mano si apre verso il giocatore. La clip più corta del
 * repertorio, perché sta fra una mossa e l'altra e non deve far aspettare.
 */
export const turnTransition = (): THREE.AnimationClip =>
  compileClip('TurnTransition', [
    { t: 0, pose: {} },
    {
      t: 0.3,
      pose: {
        ...oneSide(OFFER, 'L'),
        Chest: [4, -5, 0],
        Neck: [-2, 4, 0],
        Head: [-4, 8, -4],
        Brow_L: [-14, 0, 0],
        Brow_R: [-14, 0, 0],
        Jaw: [4, 0, 0],
      },
      hips: [0, 0, 0.02],
      ease: 'overshoot',
    },
    {
      t: 0.75,
      pose: {
        ...oneSide(OFFER, 'L'),
        Chest: [4, -5, 0],
        Head: [-4, 8, -4],
        Brow_L: [-12, 0, 0],
        Brow_R: [-12, 0, 0],
        Jaw: [3, 0, 0],
      },
      hips: [0, 0, 0.02],
    },
    { t: 1.1, pose: sym({ UpperArm_L: [0, -12, -4], LowerArm_L: [-24, 18, 2] }), ease: 'in' },
    { t: 1.4, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// RX-07 Applauso — reazione forte, alternativa alla festa
// ---------------------------------------------------------------------------

/**
 * Mani che battono davanti al petto.
 *
 * Serve perché con quattro reazioni in rotazione — e una sola per fascia — si
 * rivede sempre la stessa: le reazioni si vedono una per turno, quattro-otto a
 * partita, mentre una mossa torna solo a mazzo esaurito. Il batter le mani ha
 * una sagoma grande e inequivocabile, che è il criterio che conta a questa
 * distanza.
 *
 * `clap` da 0 a 1 chiude le mani al centro.
 */
function clapping(clap: number): Pose {
  const c = clap;
  return {
    ...SPREAD,
    Spine: [-2 - c * 2, 0, 0],
    Chest: [-4 - c * 3, 0, 0],
    Neck: [2, 0, 0],
    Head: [-2 - c * 3, 0, 0],
    Jaw: [4 + c * 4, 0, 0],
    Brow_L: [-18 - c * 4, 0, 0],
    Brow_R: [-18 - c * 4, 0, 0],
    Eye_L: [-4, 0, 0],
    Eye_R: [-4, 0, 0],

    // Le mani si avvicinano ruotando la spalla verso il centro, non
    // traslando: è l'unico modo che un rig a rotazioni abbia di farle toccare.
    Shoulder_L: [0, -6, 14],
    UpperArm_L: [-46, -20 - c * 12, -6],
    LowerArm_L: [-110, 58 + c * 10, 6],
    Hand_L: [-6, -10 - c * 8, 6],

    Shoulder_R: [0, 6, -14],
    UpperArm_R: [-46, 20 + c * 12, 6],
    LowerArm_R: [-110, -58 - c * 10, -6],
    Hand_R: [-6, 10 + c * 8, -6],
  };
}

export const applause = (): THREE.AnimationClip =>
  compileClip('Applause', [
    { t: 0, pose: {} },
    { t: 0.26, pose: clapping(0), ease: 'overshoot' },
    // Quattro battute, le prime due più rapide: un applauso non è un metronomo.
    { t: 0.44, pose: clapping(1), ease: 'out' },
    { t: 0.62, pose: clapping(0.1) },
    { t: 0.8, pose: clapping(1), ease: 'out' },
    { t: 1.0, pose: clapping(0.1) },
    { t: 1.22, pose: clapping(1), ease: 'out' },
    { t: 1.46, pose: clapping(0.15) },
    { t: 1.68, pose: clapping(1), ease: 'out' },
    { t: 1.94, pose: clapping(0.2) },
    { t: 2.3, pose: sym({ UpperArm_L: [-10, -16, -2], LowerArm_L: [-40, 28, 3] }), ease: 'in' },
    { t: 2.65, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// RX-08 Non male — approvazione tiepida, per la fascia media
// ---------------------------------------------------------------------------

/**
 * Labbro in giù non si può fare — la bocca è disegnata — quindi il «non male»
 * lo dicono il cenno del capo e le mani che si allargano appena, come chi
 * concede un punto senza entusiasmo. È volutamente piccolo: la fascia media è
 * quella in cui l'avatar non si sbilancia.
 */
const NOT_BAD: Pose = {
  ...OPEN_FINGERS,
  Spine: [-1, 0, 0],
  Chest: [-3, 0, 0],
  Neck: [2, 0, 0],
  Head: [2, 6, -3],
  Jaw: [3, 0, 0],
  // Sopracciglia alzate e simmetriche: sorpresa contenuta, non ironia.
  Brow_L: [-16, 0, 0],
  Brow_R: [-16, 0, 0],
  Eye_L: [-2, 4, 0],
  Eye_R: [-2, 4, 0],

  Shoulder_L: [0, -4, 10],
  UpperArm_L: [-24, -18, -10],
  LowerArm_L: [-84, 60, 4],
  Hand_L: [-4, -10, 6],

  Shoulder_R: [0, 4, -10],
  UpperArm_R: [-24, 18, 10],
  LowerArm_R: [-84, -60, -4],
  Hand_R: [-4, 10, -6],
};

export const notBad = (): THREE.AnimationClip =>
  compileClip('NotBad', [
    { t: 0, pose: {} },
    { t: 0.3, pose: NOT_BAD, ease: 'out' },
    // Due cenni del capo, piccoli.
    { t: 0.54, pose: { ...NOT_BAD, Head: [7, 6, -3], Neck: [4, 0, 0] } },
    { t: 0.78, pose: { ...NOT_BAD, Head: [0, 6, -3] } },
    { t: 1.0, pose: { ...NOT_BAD, Head: [6, 5, -2], Neck: [3, 0, 0] } },
    { t: 1.28, pose: { ...NOT_BAD, Head: [2, 5, -2] } },
    { t: 1.62, pose: NOT_BAD },
    { t: 1.95, pose: sym({ UpperArm_L: [-6, -14, -4], LowerArm_L: [-30, 24, 2] }), ease: 'in' },
    { t: 2.3, pose: {} },
  ]);

// ---------------------------------------------------------------------------
// RX-09 Braccia conserte — reazione bassa, alternativa alla delusione
// ---------------------------------------------------------------------------

/**
 * Braccia incrociate sul petto e sguardo di lato: non impressionato.
 *
 * Era nata come facepalm, che è il gesto più ovvio per questa fascia. Non è
 * realizzabile: la spalla sta a 1,268, i due segmenti del braccio misurano
 * 0,278 ciascuno, quindi la punta delle dita arriva a circa 1,92 — mentre gli
 * occhi del disegno stanno fra 1,95 e 2,05. **La mano non raggiunge gli
 * occhi**, e una mano che si ferma al mento legge come un gesto pensieroso,
 * non come resa. È un limite del trucco del burattino: la testa è grande e
 * sospesa in alto, e il braccio resta quello di un corpo normale.
 *
 * Le braccia conserte stanno invece tutte all'altezza del petto, dove la
 * portata abbonda, e hanno una sagoma che si riconosce a colpo d'occhio —
 * criterio che qui conta più dell'espressione, visto che il viso è disegnato.
 */
function arumsCrossed(fold: number): Pose {
  const f = fold;
  return {
    // Dita unite e piatte: a ventaglio sembravano artigli aperti, mentre nelle
    // braccia conserte le mani poggiano sul braccio opposto.
    ...FLAT,
    Spine: [1, 0, 0],
    Chest: [2 + f * 2, 0, 0],
    Neck: [1, -f * 4, 0],
    // Sguardo di lato e mento appena su: è il «non mi hai convinto».
    Head: [-2 - f * 3, -f * 14, f * 4],
    Jaw: [1, 0, 0],
    Brow_L: [8 + f * 6, 0, 0],
    Brow_R: [2 + f * 4, 0, 0],
    Eye_L: [0, -f * 10, 0],
    Eye_R: [0, -f * 10, 0],

    // Gli avambracci si incrociano davanti al petto: la rotazione su Y della
    // spalla porta il gomito all'indietro e la mano verso il centro, e con
    // entrambe le braccia è ciò che le fa sovrapporre.
    // Incrocio all'altezza del **petto**, non della pancia: più in basso
    // leggeva come mani giunte, che è un'altra cosa.
    Shoulder_L: [0, -6 - f * 8, 10 + f * 10],
    UpperArm_L: [-20 - f * 26, -16 - f * 26, -12 - f * 6],
    LowerArm_L: [-78 - f * 40, 34 + f * 22, 4],
    Hand_L: [-4, -6 - f * 12, 4],

    Shoulder_R: [0, 6 + f * 8, -10 - f * 10],
    UpperArm_R: [-20 - f * 18, 16 + f * 24, 12 + f * 6],
    LowerArm_R: [-90 - f * 36, -34 - f * 20, -4],
    Hand_R: [-4, 6 + f * 12, -4],
  };
}

export const armsCrossed = (): THREE.AnimationClip =>
  compileClip('ArmsCrossed', [
    { t: 0, pose: {} },
    // Le braccia si chiudono con calma: la fretta sarebbe fastidio, questa è
    // indifferenza.
    { t: 0.4, pose: arumsCrossed(0.5), ease: 'out' },
    { t: 0.75, pose: arumsCrossed(1), ease: 'out' },
    // Ci resta, e la durata è la battuta.
    { t: 1.45, pose: arumsCrossed(1) },
    { t: 1.95, pose: { ...arumsCrossed(1), Head: [-6, -16, 5] } },
    { t: 2.35, pose: arumsCrossed(0.3), ease: 'in' },
    { t: 2.75, pose: {} },
  ]);
