/** Costruzione dello scheletro e calcolo automatico dei pesi di skinning. */
import * as THREE from 'three';
import { RIG } from './rig.ts';
import type { Part } from './mesh.ts';

export interface Rig {
  bones: THREE.Bone[];
  root: THREE.Bone;
  indexByName: Map<string, number>;
  /** Segmento osseo (testa → coda) in coordinate mondo nella posa di riposo. */
  segments: Map<string, { head: THREE.Vector3; tail: THREE.Vector3 }>;
}

export function buildRig(): Rig {
  const bones = new Map<string, THREE.Bone>();
  const indexByName = new Map<string, number>();
  const order: THREE.Bone[] = [];

  // I bone sono creati nell'ordine di RIG: i genitori precedono sempre i figli.
  RIG.forEach((def, i) => {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bones.set(def.name, bone);
    indexByName.set(def.name, i);
    order.push(bone);
  });

  for (const def of RIG) {
    const bone = bones.get(def.name)!;
    if (def.parent === null) {
      bone.position.set(def.head[0], def.head[1], def.head[2]);
    } else {
      const parent = RIG.find((b) => b.name === def.parent)!;
      bone.position.set(
        def.head[0] - parent.head[0],
        def.head[1] - parent.head[1],
        def.head[2] - parent.head[2],
      );
      bones.get(def.parent)!.add(bone);
    }
  }

  // Segmenti: dalla testa del bone alla media dei figli; i bone foglia
  // proseguono nella direzione del proprio genitore.
  const segments = new Map<string, { head: THREE.Vector3; tail: THREE.Vector3 }>();
  for (const def of RIG) {
    const head = new THREE.Vector3(def.head[0], def.head[1], def.head[2]);
    const children = RIG.filter((b) => b.parent === def.name);
    let tail: THREE.Vector3;
    if (children.length > 0) {
      tail = new THREE.Vector3();
      for (const c of children) tail.add(new THREE.Vector3(c.head[0], c.head[1], c.head[2]));
      tail.divideScalar(children.length);
    } else {
      const parent = RIG.find((b) => b.name === def.parent);
      const dir = parent
        ? head.clone().sub(new THREE.Vector3(parent.head[0], parent.head[1], parent.head[2]))
        : new THREE.Vector3(0, 1, 0);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      tail = head.clone().add(dir.normalize().multiplyScalar(0.045));
    }
    segments.set(def.name, { head, tail });
  }

  const root = bones.get(RIG[0].name)!;
  root.updateMatrixWorld(true);

  return { bones: order, root, indexByName, segments };
}

const EPS = 0.02;
const MAX_INFLUENCES = 4;

function distanceToSegment(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
): number {
  const ab = new THREE.Vector3().subVectors(b, a);
  const lenSq = ab.lengthSq();
  if (lenSq < 1e-10) return p.distanceTo(a);
  const t = Math.min(1, Math.max(0, new THREE.Vector3().subVectors(p, a).dot(ab) / lenSq));
  return p.distanceTo(ab.multiplyScalar(t).add(a));
}

/**
 * Assegna skinIndex/skinWeight ai vertici della parte, considerando solo i bone
 * dichiarati dalla parte stessa. Con un solo bone ammesso il legame è rigido.
 */
export function skinPart(part: Part, rig: Rig): void {
  const geometry = part.geometry;
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const count = position.count;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  const power = part.power ?? 3;

  const candidates = part.bones.map((name) => {
    const seg = rig.segments.get(name);
    const index = rig.indexByName.get(name);
    if (!seg || index === undefined) throw new Error(`Bone non valido nello skinning: ${name}`);
    return { index, seg };
  });

  const p = new THREE.Vector3();
  const scored: { index: number; weight: number }[] = [];

  for (let i = 0; i < count; i++) {
    p.set(position.getX(i), position.getY(i), position.getZ(i));
    scored.length = 0;

    for (const c of candidates) {
      const d = distanceToSegment(p, c.seg.head, c.seg.tail);
      scored.push({ index: c.index, weight: 1 / Math.pow(d + EPS, power) });
    }

    scored.sort((a, b) => b.weight - a.weight);
    const top = scored.slice(0, MAX_INFLUENCES);
    const total = top.reduce((s, x) => s + x.weight, 0);

    for (let k = 0; k < top.length; k++) {
      skinIndex[i * 4 + k] = top[k].index;
      skinWeight[i * 4 + k] = top[k].weight / total;
    }
  }

  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
}
