/**
 * Rimappatura dei nomi dei bone.
 *
 * Il motore lavora su nomi canonici (`UpperArm_L`, `Chest`, …). I modelli di
 * terze parti usano convenzioni diverse: Mixamo (`mixamorig:LeftArm`), Rigify e
 * Blender (`upper_arm.L`, `spine.001`), i pacchetti CC0 (`arm_l`, `Left_Arm`).
 * Senza questo livello, usare un rig altrui significherebbe o rinominare a mano
 * decine di bone, o riscrivere clip e animazioni.
 *
 * La conversione avviene al caricamento, una volta sola: i nodi vengono
 * rinominati e i nomi delle track delle clip già presenti nel file vengono
 * riscritti di conseguenza, così le animazioni di origine continuano a
 * funzionare insieme alle nostre.
 */
import type { AnimationClip, Object3D } from 'three';

/** Prefissi di armature e convenzioni di rigging, rimossi prima del confronto. */
const PREFIXES: readonly RegExp[] = [
  /^mixamorig\d*[:_]/i,
  /^armature[|:_]/i,
  /^rig[|:]/i,
  /^(def|org|mch|ctrl)[-_]/i,
  /^bip\d*[\s_]/i,
];

/** Sinonimi del "nucleo" del nome, senza indicazione di lato. */
const CORE: Readonly<Record<string, string>> = {
  hips: 'Hips',
  hip: 'Hips',
  pelvis: 'Hips',

  spine: 'Spine',
  abdomen: 'Spine',

  // Mixamo numera Spine1/Spine2, Rigify spine.001…: il segmento alto è il torace.
  spine1: 'Chest',
  spine2: 'Chest',
  spine3: 'Chest',
  spine001: 'Chest',
  spine002: 'Chest',
  spine003: 'Chest',
  chest: 'Chest',
  upperchest: 'Chest',
  torso: 'Chest',

  neck: 'Neck',
  neck1: 'Neck',
  head: 'Head',

  shoulder: 'Shoulder',
  clavicle: 'Shoulder',
  collar: 'Shoulder',

  // Attenzione: per Mixamo "Arm" è il braccio e "ForeArm" l'avambraccio.
  upperarm: 'UpperArm',
  arm: 'UpperArm',
  armupper: 'UpperArm',
  lowerarm: 'LowerArm',
  forearm: 'LowerArm',
  armlower: 'LowerArm',
  elbow: 'LowerArm',

  hand: 'Hand',
  wrist: 'Hand',

  // Attenzione: per Mixamo "UpLeg" è la coscia e "Leg" la gamba.
  upperleg: 'UpperLeg',
  upleg: 'UpperLeg',
  thigh: 'UpperLeg',
  lowerleg: 'LowerLeg',
  leg: 'LowerLeg',
  shin: 'LowerLeg',
  calf: 'LowerLeg',
  knee: 'LowerLeg',

  foot: 'Foot',
  ankle: 'Foot',
  toe: 'Toe',
  toebase: 'Toe',
  toes: 'Toe',

  jaw: 'Jaw',
  brow: 'Brow',
  eyebrow: 'Brow',
  eye: 'Eye',
  lid: 'Lid',
  eyelid: 'Lid',
};

/** Nomi delle dita, con i sinonimi più diffusi. */
const FINGERS: Readonly<Record<string, string>> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
  little: 'Pinky',
};

/** Parti che esistono in coppia e richiedono il suffisso di lato. */
const SIDED = new Set([
  'Shoulder',
  'UpperArm',
  'LowerArm',
  'Hand',
  'UpperLeg',
  'LowerLeg',
  'Foot',
  'Toe',
  'Brow',
  'Eye',
  'Lid',
]);

function stripPrefix(name: string): string {
  let out = name;
  for (const prefix of PREFIXES) out = out.replace(prefix, '');
  return out;
}

/** Separa l'indicazione di lato dal resto del nome. */
function splitSide(name: string): { core: string; side: 'L' | 'R' | null } {
  // Mixamo scrive `LeftForeArm` senza separatori, quindi non si può pretendere
  // un confine di parola: in un nome di bone "left"/"right" è sempre il lato.
  const word = /(left|right)/i.exec(name);
  if (word) {
    return {
      core: name.replace(word[0], ''),
      side: word[0].toLowerCase() === 'left' ? 'L' : 'R',
    };
  }

  const suffix = /[._\- ]([lr])$/i.exec(name);
  if (suffix) {
    return { core: name.slice(0, suffix.index), side: suffix[1].toUpperCase() as 'L' | 'R' };
  }

  const prefix = /^([lr])[._\- ]/i.exec(name);
  if (prefix) {
    return { core: name.slice(2), side: prefix[1].toUpperCase() as 'L' | 'R' };
  }

  return { core: name, side: null };
}

/**
 * Nome canonico corrispondente, oppure `null` se il nome non è riconosciuto.
 * I nomi già canonici tornano identici a sé stessi.
 */
export function canonicalBoneName(raw: string): string | null {
  const { core, side } = splitSide(stripPrefix(raw));
  const key = core.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key.length === 0) return null;

  // Dita: nucleo del tipo "handthumb2", "thumb02", "findex1".
  const finger = /(thumb|index|middle|ring|pinky|little)0*(\d)?/.exec(key);
  if (finger) {
    const base = FINGERS[finger[1]];
    // La terza falange di Mixamo non ha corrispondente: resta com'è.
    const joint = Number(finger[2] ?? '1');
    if (!side || joint > 2) return null;
    return `${base}${joint}_${side}`;
  }

  const base = CORE[key];
  if (!base) return null;
  if (SIDED.has(base)) return side ? `${base}_${side}` : null;
  return base;
}

export interface NamingResult {
  /** Nomi effettivamente cambiati: vecchio → nuovo. */
  renamed: Map<string, string>;
  /** Bone canonici già corretti in partenza. */
  alreadyCanonical: string[];
  /** Bone non riconosciuti: restano com'erano e non vengono animati. */
  unrecognized: string[];
}

/**
 * Rinomina i bone di un modello secondo i nomi canonici e riscrive le track
 * delle clip di conseguenza. Se il modello usa già i nostri nomi non cambia
 * nulla.
 */
export function applyBoneNaming(root: Object3D, clips: readonly AnimationClip[]): NamingResult {
  const result: NamingResult = { renamed: new Map(), alreadyCanonical: [], unrecognized: [] };
  const taken = new Set<string>();
  const bones: Object3D[] = [];

  root.traverse((child) => {
    if ((child as { isBone?: boolean }).isBone) bones.push(child);
  });

  // Primo giro: i nomi già canonici hanno la precedenza sulle rimappature.
  for (const bone of bones) {
    if (canonicalBoneName(bone.name) === bone.name) {
      result.alreadyCanonical.push(bone.name);
      taken.add(bone.name);
    }
  }

  for (const bone of bones) {
    const canonical = canonicalBoneName(bone.name);
    if (canonical === null) {
      result.unrecognized.push(bone.name);
      continue;
    }
    if (canonical === bone.name) continue;
    // Più bone possono puntare allo stesso nome canonico (Spine1 e Spine2 di
    // Mixamo): vince il primo nella gerarchia, gli altri restano com'erano.
    if (taken.has(canonical)) {
      result.unrecognized.push(bone.name);
      continue;
    }
    result.renamed.set(bone.name, canonical);
    taken.add(canonical);
  }

  if (result.renamed.size === 0) return result;

  for (const [oldName, newName] of result.renamed) {
    const bone = bones.find((b) => b.name === oldName);
    if (bone) bone.name = newName;
  }

  // Le track delle clip puntano ai nodi per nome. Il confronto parte dai nomi
  // più lunghi perché alcune convenzioni contengono punti (`spine.001`), lo
  // stesso separatore che divide nodo e proprietà.
  const ordered = [...result.renamed.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const clip of clips) {
    for (const track of clip.tracks) {
      for (const [oldName, newName] of ordered) {
        if (track.name.startsWith(`${oldName}.`)) {
          track.name = `${newName}${track.name.slice(oldName.length)}`;
          break;
        }
      }
    }
  }

  return result;
}
