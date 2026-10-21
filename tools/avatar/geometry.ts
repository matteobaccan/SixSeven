/** Primitive di appoggio per costruire la mesh dell'avatar. */
import * as THREE from 'three';

export type Vec3 = readonly [number, number, number];

export function ellipsoid(
  center: Vec3,
  radii: Vec3,
  seg: [number, number] = [20, 14],
  rotation?: Vec3,
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg[0], seg[1]);
  g.scale(radii[0], radii[1], radii[2]);
  if (rotation) {
    g.applyMatrix4(
      new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(rotation[0], rotation[1], rotation[2]),
      ),
    );
  }
  g.translate(center[0], center[1], center[2]);
  return g;
}

export function boxAt(
  center: Vec3,
  size: Vec3,
  rotation?: Vec3,
  seg: Vec3 = [1, 1, 1],
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2], seg[0], seg[1], seg[2]);
  if (rotation) {
    g.applyMatrix4(
      new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(rotation[0], rotation[1], rotation[2]),
      ),
    );
  }
  g.translate(center[0], center[1], center[2]);
  return g;
}

/** Cilindro troncoconico orientato dal punto `a` (raggio rA) al punto `b` (raggio rB). */
export function tube(
  a: Vec3,
  b: Vec3,
  rA: number,
  rB: number,
  radialSeg = 16,
  heightSeg = 8,
): THREE.BufferGeometry {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const vb = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(rB, rA, len, radialSeg, heightSeg, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
  g.translate(a[0], a[1], a[2]);
  return g;
}

/** Arco di toro: usato per la bocca e la fascia del colletto. */
export function arc(
  center: Vec3,
  majorRadius: number,
  tubeRadius: number,
  arcAngle: number,
  rotation: Vec3,
  seg: [number, number] = [8, 24],
): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(majorRadius, tubeRadius, seg[0], seg[1], arcAngle);
  // Centra l'arco rispetto al proprio asse, così la rotazione resta intuitiva.
  g.rotateZ(-arcAngle / 2);
  g.applyMatrix4(
    new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2]),
    ),
  );
  g.translate(center[0], center[1], center[2]);
  return g;
}



export const deg = (d: number): number => (d * Math.PI) / 180;
