/**
 * Compilatore delle animazioni: da poche pose leggibili a curve fluide.
 *
 * Tre scelte determinano la qualità del movimento:
 *
 * 1. **Easing per segmento.** glTF interpola i keyframe in modo lineare: con
 *    poche pose il risultato è meccanico. Qui la timeline viene ricampionata a
 *    frequenza fissa applicando una funzione di ease a ogni transizione, così
 *    il file esportato contiene già l'accelerazione giusta.
 *
 * 2. **Ritardo per bone (overlapping action).** Testa, mandibola, sopracciglia
 *    e mani seguono il corpo con qualche centesimo di ritardo: è il principio
 *    di animazione che toglie l'effetto "tutto si muove insieme". Il ritardo
 *    si annulla a fine clip, così la posa finale resta esattamente quella di
 *    riposo e le transizioni verso Idle non saltano.
 *
 * 3. **Pose come dati.** Le clip restano elenchi di pose in gradi: si leggono,
 *    si correggono e si estendono senza toccare il motore di gioco.
 */
import * as THREE from 'three';
import { RIG } from './rig.ts';

export type Euler3 = readonly [number, number, number];
export type Pose = Record<string, Euler3>;

/** Curva applicata alla transizione che *arriva* su questo keyframe. */
export type Ease = 'inOut' | 'out' | 'in' | 'linear' | 'overshoot';

export interface Key {
  /** Istante in secondi. */
  t: number;
  pose: Pose;
  /** Scostamento della radice rispetto alla posa di riposo, in metri. */
  hips?: Euler3;
  ease?: Ease;
}

const HIPS_REST = RIG.find((b) => b.name === 'Hips')!.head;

/** Frequenza di ricampionamento: sopra i 30 Hz la curva è già indistinguibile. */
const SAMPLE_FPS = 32;

/** Finestra in cui il ritardo per bone rientra a zero, in secondi. */
const LAG_FADE = 0.35;

const EASING: Record<Ease, (u: number) => number> = {
  linear: (u) => u,
  in: (u) => u * u * u,
  out: (u) => 1 - Math.pow(1 - u, 3),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  // Leggero scavalcamento: dà peso agli accenti senza farli sembrare elastici.
  overshoot: (u) => {
    const c1 = 1.1;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
  },
};

/**
 * Ritardo di inseguimento per bone, in secondi. Valori piccoli: servono a
 * scomporre il movimento, non a renderlo molle.
 */
function lagFor(bone: string): number {
  if (bone.startsWith('Brow') || bone === 'Jaw') return 0.085;
  if (bone === 'Head') return 0.065;
  if (bone.startsWith('Eye')) return 0.055;
  if (bone === 'Neck') return 0.04;
  if (bone.startsWith('Hand')) return 0.045;
  if (/^(Thumb|Index|Middle|Ring|Pinky)/.test(bone)) return 0.06;
  if (bone.startsWith('LowerArm')) return 0.025;
  return 0;
}

/** Specchia le voci `_L` di una posa sul lato `_R` (X invariato, Y e Z invertiti). */
export function sym(pose: Pose): Pose {
  const out: Pose = { ...pose };
  for (const [name, rot] of Object.entries(pose)) {
    if (name.endsWith('_L')) {
      out[name.replace(/_L$/, '_R')] = [rot[0], -rot[1], -rot[2]];
    }
  }
  return out;
}

function toQuaternion(rot: Euler3): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(rot[0]),
      THREE.MathUtils.degToRad(rot[1]),
      THREE.MathUtils.degToRad(rot[2]),
      'XYZ',
    ),
  );
}

const IDENTITY = new THREE.Quaternion();

export function compileClip(name: string, keys: readonly Key[]): THREE.AnimationClip {
  if (keys.length < 2) throw new Error(`Clip ${name}: servono almeno due pose`);

  const duration = keys[keys.length - 1].t;
  const bones = new Set<string>();
  for (const k of keys) for (const b of Object.keys(k.pose)) bones.add(b);

  // Le pose sono convertite una sola volta: il ricampionamento poi interpola
  // quaternioni, evitando i problemi di gimbal degli angoli di Eulero.
  const quats = keys.map((k) => {
    const map = new Map<string, THREE.Quaternion>();
    for (const bone of bones) map.set(bone, k.pose[bone] ? toQuaternion(k.pose[bone]) : IDENTITY);
    return map;
  });

  const times: number[] = [];
  const step = 1 / SAMPLE_FPS;
  for (let t = 0; t < duration; t += step) times.push(+t.toFixed(5));
  times.push(duration);

  /** Indice del segmento che contiene `t`, con la frazione già interpolata. */
  const segmentAt = (t: number): { i: number; u: number } => {
    let i = 0;
    while (i < keys.length - 2 && t >= keys[i + 1].t) i += 1;
    const span = keys[i + 1].t - keys[i].t;
    const raw = span > 0 ? (t - keys[i].t) / span : 1;
    const clamped = Math.min(1, Math.max(0, raw));
    return { i, u: EASING[keys[i + 1].ease ?? 'inOut'](clamped) };
  };

  const tracks: THREE.KeyframeTrack[] = [];
  const q = new THREE.Quaternion();

  for (const bone of bones) {
    const lag = lagFor(bone);
    const values: number[] = [];
    for (const t of times) {
      // Il ritardo rientra a zero verso la fine: la posa finale resta esatta.
      const fade = Math.min(1, Math.max(0, (duration - t) / LAG_FADE));
      const sampleAt = Math.max(0, t - lag * fade);
      const { i, u } = segmentAt(sampleAt);
      q.slerpQuaternions(quats[i].get(bone)!, quats[i + 1].get(bone)!, u);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }

  if (keys.some((k) => k.hips)) {
    const values: number[] = [];
    for (const t of times) {
      const { i, u } = segmentAt(t);
      const a = keys[i].hips ?? ([0, 0, 0] as Euler3);
      const b = keys[i + 1].hips ?? ([0, 0, 0] as Euler3);
      for (let axis = 0; axis < 3; axis++) {
        values.push(HIPS_REST[axis] + a[axis] + (b[axis] - a[axis]) * u);
      }
    }
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, values));
  }

  const clip = new THREE.AnimationClip(name, duration, tracks);
  // Elimina i keyframe ridondanti dove il movimento è fermo o rettilineo.
  clip.optimize();
  return clip;
}
