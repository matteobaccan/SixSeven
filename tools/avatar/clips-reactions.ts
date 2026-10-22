/**
 * Reazioni del catalogo (RX-xx).
 *
 * Le reazioni non sono legate a una singola mossa: la logica di gioco sceglie
 * quale usare in base al contesto (spec 4.2). Le convenzioni del rig sono
 * documentate in poses.ts.
 */
import type * as THREE from 'three';
import { compileClip, sym } from './timeline.ts';
import { OFFER, oneSide, OPEN_FINGERS, POINT, poke, SPREAD } from './poses.ts';

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
