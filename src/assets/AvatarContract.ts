/**
 * Contratto dell'asset avatar.
 *
 * Il motore non conosce la pipeline che ha prodotto il GLB: conosce soltanto
 * dei nomi. Qui sono elencati, in un unico posto, i nomi di clip e bone su cui
 * il codice fa affidamento, insieme a una funzione di verifica che dice cosa
 * manca in un modello caricato.
 *
 * È ciò che rende sostituibile il modello: chi lo realizza (a mano in Blender,
 * generato, o altro) deve rispettare questi nomi, non leggere il codice.
 * Tutto quello che non è `required` degrada senza errori — l'avatar funziona
 * lo stesso, con meno espressività.
 */
import type { Object3D } from 'three';
import { allEntries } from './AssetCatalog.ts';

export interface BoneRequirement {
  name: string;
  required: boolean;
  purpose: string;
}

export const BONE_CONTRACT: readonly BoneRequirement[] = [
  { name: 'Hips', required: true, purpose: 'radice dello scheletro' },
  { name: 'Spine', required: true, purpose: 'inclinazioni del busto' },
  { name: 'Chest', required: true, purpose: 'respiro e torsioni' },
  { name: 'Neck', required: true, purpose: 'collo' },
  { name: 'Head', required: true, purpose: 'testa, deriva procedurale' },
  { name: 'Shoulder_L', required: true, purpose: 'alzata di spalle' },
  { name: 'Shoulder_R', required: true, purpose: 'alzata di spalle' },
  { name: 'UpperArm_L', required: true, purpose: 'braccio' },
  { name: 'UpperArm_R', required: true, purpose: 'braccio' },
  { name: 'LowerArm_L', required: true, purpose: 'avambraccio, supinazione' },
  { name: 'LowerArm_R', required: true, purpose: 'avambraccio, supinazione' },
  { name: 'Hand_L', required: true, purpose: 'mano' },
  { name: 'Hand_R', required: true, purpose: 'mano' },

  { name: 'Jaw', required: false, purpose: 'apertura della bocca' },
  { name: 'Brow_L', required: false, purpose: 'sopracciglio' },
  { name: 'Brow_R', required: false, purpose: 'sopracciglio' },
  { name: 'Eye_L', required: false, purpose: 'sguardo, saccadi' },
  { name: 'Eye_R', required: false, purpose: 'sguardo, saccadi' },
  { name: 'Lid_L', required: false, purpose: 'battito di palpebre' },
  { name: 'Lid_R', required: false, purpose: 'battito di palpebre' },

  { name: 'UpperLeg_L', required: false, purpose: 'gamba' },
  { name: 'UpperLeg_R', required: false, purpose: 'gamba' },
  { name: 'LowerLeg_L', required: false, purpose: 'gamba' },
  { name: 'LowerLeg_R', required: false, purpose: 'gamba' },
  { name: 'Foot_L', required: false, purpose: 'piede' },
  { name: 'Foot_R', required: false, purpose: 'piede' },
];

/** Dita: opzionali in blocco, servono alle mosse basate sulle mani (S7-03). */
export const FINGER_BONES: readonly string[] = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap(
  (finger) => ['L', 'R'].flatMap((side) => [`${finger}1_${side}`, `${finger}2_${side}`]),
);

export interface AvatarReport {
  /** Bone richiesti assenti: l'avatar si anima male o per niente. */
  missingRequiredBones: string[];
  missingOptionalBones: string[];
  /** Dita mancanti: le mosse con le dita non saranno realizzabili. */
  missingFingerBones: string[];
  /** Clip dichiarate nel catalogo e presenti nel modello. */
  availableClips: string[];
  /** Clip dichiarate nel catalogo ma assenti dal modello. */
  missingClips: string[];
  /** Clip nel modello che il catalogo non conosce: non verranno mai usate. */
  unknownClips: string[];
  ok: boolean;
}

/** Confronta un modello caricato con il contratto e restituisce un referto. */
export function inspectAvatar(root: Object3D, clipNames: readonly string[]): AvatarReport {
  const bones = new Set<string>();
  root.traverse((child) => {
    if (child.name) bones.add(child.name);
  });

  const missingRequiredBones = BONE_CONTRACT.filter((b) => b.required && !bones.has(b.name)).map(
    (b) => b.name,
  );
  const missingOptionalBones = BONE_CONTRACT.filter((b) => !b.required && !bones.has(b.name)).map(
    (b) => b.name,
  );
  const missingFingerBones = FINGER_BONES.filter((name) => !bones.has(name));

  const catalogClips = allEntries()
    .map((e) => e.clip)
    .filter((c): c is string => c !== null);
  const present = new Set(clipNames);

  return {
    missingRequiredBones,
    missingOptionalBones,
    missingFingerBones,
    availableClips: catalogClips.filter((c) => present.has(c)),
    missingClips: catalogClips.filter((c) => !present.has(c)),
    unknownClips: clipNames.filter((c) => !catalogClips.includes(c)),
    ok: missingRequiredBones.length === 0 && present.size > 0,
  };
}
