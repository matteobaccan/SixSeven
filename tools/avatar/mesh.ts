/**
 * Costruzione della mesh dell'avatar.
 *
 * Ogni parte è una primitiva posizionata nella posa di riposo e dichiara:
 *  - il materiale (chiave della palette);
 *  - i bone ammessi per lo skinning;
 *  - la durezza del blend dei pesi.
 *
 * Lo skinning è automatico per distanza dai segmenti ossei ammessi: limitare i
 * bone per parte evita che il maglione trascini il naso e tiene le deformazioni
 * leggibili anche con movimenti ampi delle braccia (spec 3.2).
 */
import * as THREE from 'three';
import { PALETTE, type PaletteKey } from './palette.ts';
import { BONE_GROUPS, FINGER_IDS, HEAD_PIVOT_Y, HEAD_SCALE, RIG } from './rig.ts';
import { arc, boxAt, curve, deg, ellipsoid, shape, tube, type Vec3 } from './geometry.ts';

export interface Part {
  geometry: THREE.BufferGeometry;
  material: PaletteKey;
  bones: readonly string[];
  /** Esponente del falloff: alto = skinning più rigido. */
  power?: number;
}

const HEAD_CENTER: Vec3 = [0, 1.595, 0];
const HEAD_R = 0.2;

// ---------------------------------------------------------------------------
// Testa
// ---------------------------------------------------------------------------

/** Deformazione della calotta, condivisa da mesh e linee del viso. */
function skullShape(x: number, y: number, z: number): Vec3 {
  const v = y / HEAD_R; // -1 (mento) .. 1 (cupola)
  const lower = Math.max(0, -v);
  const upper = Math.max(0, v);
  const narrow = 1 - 0.23 * lower * lower + 0.03 * upper;
  return [x * narrow * 1.03, y * 1.05, z * (1 - 0.1 * lower * lower) + 0.035 * lower * lower];
}

/**
 * Punto sulla superficie del viso in coordinate sferiche: `yaw` positivo va
 * verso la sinistra anatomica, `pitch` positivo verso l'alto. `lift` stacca il
 * punto dalla pelle quel tanto che basta perché una linea non compenetri.
 *
 * Avere questa funzione, invece di coordinate scritte a mano, è ciò che rende
 * modificabili le linee del viso: cambiando la forma del cranio le rughe
 * restano appoggiate sopra.
 */
function facePoint(yawDeg: number, pitchDeg: number, lift = 0.005): Vec3 {
  const yaw = deg(yawDeg);
  const pitch = deg(pitchDeg);
  const ux = Math.sin(yaw) * Math.cos(pitch);
  const uy = Math.sin(pitch);
  const uz = Math.cos(yaw) * Math.cos(pitch);
  const [px, py, pz] = skullShape(ux * HEAD_R, uy * HEAD_R, uz * HEAD_R);
  const length = Math.hypot(px, py, pz) || 1;
  const k = 1 + lift / length;
  return [HEAD_CENTER[0] + px * k, HEAD_CENTER[1] + py * k, HEAD_CENTER[2] + pz * k];
}

/** Spessore delle linee disegnate sul viso, prima dell'ingrandimento testa. */
const INK = 0.0026;

/**
 * Linee del viso. Nel riferimento grafico il volume non è raccontato dalle
 * ombre ma dal tratto: rughe della fronte, pieghe naso-labiali, zampe di
 * gallina e occhiaie. Senza queste linee il personaggio resta una bambola
 * liscia, con poca età e poca espressione.
 */
function faceLines(): Part[] {
  const parts: Part[] = [];
  // Le rughe della fronte sono legate alle sopracciglia: si alzano con loro.
  const browBones = ['Brow_L', 'Brow_R', 'Head'];

  for (const [pitch, bump, span, weight] of [
    [29, 2.2, 21, 0.78],
    [35.5, 1.8, 16, 0.6],
  ] as const) {
    parts.push({
      geometry: curve(
        [
          facePoint(-span, pitch - 1),
          facePoint(-span * 0.5, pitch + bump),
          facePoint(0, pitch + bump * 0.6),
          facePoint(span * 0.5, pitch + bump),
          facePoint(span, pitch - 1),
        ],
        INK * weight,
        26,
      ),
      material: 'ink',
      bones: browBones,
      power: 2,
    });
  }

  for (const s of [1, -1]) {
    // Piega naso-labiale: dall'ala del naso all'angolo della bocca.
    parts.push({
      geometry: curve(
        [
          facePoint(s * 9.5, -5),
          facePoint(s * 14, -11),
          facePoint(s * 16.5, -17.5),
        ],
        INK * 0.85,
        18,
      ),
      material: 'ink',
      bones: BONE_GROUPS.face,
      power: 4,
    });

    // Accenno di occhiaia: corto e alto, altrimenti legge come un taglio.
    parts.push({
      geometry: curve(
        [facePoint(s * 12, -0.5), facePoint(s * 18, -1.8), facePoint(s * 23, 0.6)],
        INK * 0.8,
        14,
      ),
      material: 'ink',
      bones: BONE_GROUPS.head,
      power: 5,
    });

    // Zampe di gallina all'angolo esterno dell'occhio.
    for (const [p0, p1] of [
      [10, 13],
      [6, 7],
    ] as const) {
      parts.push({
        geometry: curve([facePoint(s * 25, p0), facePoint(s * 30, p1)], INK * 0.8, 8),
        material: 'ink',
        bones: BONE_GROUPS.head,
        power: 5,
      });
    }
  }

  return parts;
}

function head(): Part[] {
  // Sfera rimodellata: cranio ampio e calvo, mascella più stretta, mento
  // leggermente in avanti. Proporzioni caricaturali (testa ~1/4 dell'altezza).
  const skull = shape(new THREE.SphereGeometry(HEAD_R, 32, 24), skullShape);
  skull.translate(HEAD_CENTER[0], HEAD_CENTER[1], HEAD_CENTER[2]);

  const parts: Part[] = [{ geometry: skull, material: 'skin', bones: BONE_GROUPS.head, power: 3 }];

  // Orecchie sporgenti.
  for (const s of [1, -1]) {
    parts.push({
      geometry: ellipsoid(
        [s * 0.197, 1.578, 0.008],
        [0.027, 0.058, 0.043],
        [14, 10],
        [0, 0, deg(s * -6)],
      ),
      material: 'ear',
      bones: BONE_GROUPS.head,
      power: 6,
    });
  }

  // Naso pronunciato: ponte + punta bulbosa + pinne.
  parts.push({
    geometry: tube([0, 1.652, 0.179], [0, 1.601, 0.208], 0.016, 0.028, 12, 4),
    material: 'nose',
    bones: BONE_GROUPS.face,
    power: 6,
  });
  parts.push({
    geometry: ellipsoid([0, 1.587, 0.219], [0.037, 0.034, 0.045], [18, 12]),
    material: 'nose',
    bones: BONE_GROUPS.face,
    power: 6,
  });
  for (const s of [1, -1]) {
    parts.push({
      geometry: ellipsoid([s * 0.035, 1.575, 0.199], [0.019, 0.017, 0.025], [12, 8]),
      material: 'nose',
      bones: BONE_GROUPS.face,
      power: 6,
    });
  }

  // Occhi: sclera + pupilla legata al bone dell'occhio (sguardo orientabile).
  for (const [s, white, pupil, lid] of [
    [1, BONE_GROUPS.head, BONE_GROUPS.eyeL, BONE_GROUPS.lidL],
    [-1, BONE_GROUPS.head, BONE_GROUPS.eyeR, BONE_GROUPS.lidR],
  ] as const) {
    parts.push({
      geometry: ellipsoid([s * 0.075, 1.624, 0.168], [0.042, 0.029, 0.032], [18, 12]),
      material: 'eyeWhite',
      bones: white,
      power: 8,
    });
    parts.push({
      geometry: ellipsoid([s * 0.077, 1.622, 0.192], [0.0145, 0.0145, 0.013], [12, 8]),
      material: 'pupil',
      bones: pupil,
      power: 8,
    });
    // Palpebra superiore: copre il bordo alto della sclera e, legata al proprio
    // bone, permette il battito di ciglia.
    parts.push({
      geometry: ellipsoid(
        [s * 0.074, 1.6455, 0.163],
        [0.047, 0.028, 0.038],
        [16, 10],
        [0, 0, deg(s * 7)],
      ),
      material: 'skin',
      bones: lid,
      power: 8,
    });
  }

  // Sopracciglia folte e marcate, inclinate verso l'interno.
  for (const [s, group] of [
    [1, BONE_GROUPS.browL],
    [-1, BONE_GROUPS.browR],
  ] as const) {
    parts.push({
      geometry: ellipsoid(
        [s * 0.079, 1.6845, 0.1665],
        [0.049, 0.0125, 0.017],
        [14, 8],
        [0, 0, deg(s * 9)],
      ),
      material: 'browHair',
      bones: group,
      power: 8,
    });
  }

  // Bocca: arco sorridente leggermente asimmetrico, legato alla mandibola.
  parts.push({
    geometry: arc([0, 1.549, 0.179], 0.049, 0.0085, deg(110), [deg(6), 0, deg(-90)], [6, 22]),
    material: 'mouth',
    bones: BONE_GROUPS.jaw,
    power: 6,
  });

  parts.push(...faceLines());

  // Ingrandimento caricaturale: testa e volto crescono attorno
  // all'articolazione del collo, con lo stesso fattore usato dai bone.
  const enlarge = new THREE.Matrix4()
    .makeTranslation(0, HEAD_PIVOT_Y, 0)
    .multiply(new THREE.Matrix4().makeScale(HEAD_SCALE, HEAD_SCALE, HEAD_SCALE))
    .multiply(new THREE.Matrix4().makeTranslation(0, -HEAD_PIVOT_Y, 0));
  for (const part of parts) part.geometry.applyMatrix4(enlarge);

  // Collo: resta nelle proporzioni del busto, appena più spesso per reggere
  // visivamente la testa ingrandita.
  parts.push({
    geometry: tube([0, 1.29, 0], [0, 1.47, 0], 0.094, 0.082, 18, 6),
    material: 'skin',
    bones: BONE_GROUPS.head,
    power: 2.5,
  });

  return parts;
}

// ---------------------------------------------------------------------------
// Busto, maglione e camicia
// ---------------------------------------------------------------------------

/** Pannello a righe verticali: la camicia senza ricorrere a texture. */
function stripedPanel(
  center: Vec3,
  size: Vec3,
  rotation: Vec3,
  bones: readonly string[],
  count = 9,
): Part[] {
  const order: PaletteKey[] = ['shirtWhite', 'shirtBlue', 'shirtWhite', 'shirtPurple'];
  const w = size[0] / count;
  const parts: Part[] = [];
  for (let i = 0; i < count; i++) {
    const offset = -size[0] / 2 + w * (i + 0.5);
    const local = new THREE.Vector3(offset, 0, 0).applyEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2]),
    );
    parts.push({
      geometry: boxAt(
        [center[0] + local.x, center[1] + local.y, center[2] + local.z],
        [w * 1.06, size[1], size[2]],
        rotation,
      ),
      material: order[i % order.length],
      bones,
      power: 6,
    });
  }
  return parts;
}

/**
 * Righe verticali disposte lungo un anello: la camicia sotto il maglione.
 * Ogni riga è un solido chiuso, così il contorno cartoon non lascia buchi.
 */
function stripedRing(
  yBottom: number,
  yTop: number,
  radius: number,
  zScale: number,
  bones: readonly string[],
  count = 18,
): Part[] {
  const order: PaletteKey[] = ['shirtWhite', 'shirtBlue', 'shirtWhite', 'shirtPurple'];
  const height = yTop - yBottom;
  const y = yBottom + height / 2;
  const width = 2 * radius * Math.sin(Math.PI / count) * 1.08;
  const parts: Part[] = [];

  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    parts.push({
      geometry: boxAt(
        [radius * Math.sin(theta), y, radius * zScale * Math.cos(theta)],
        [width, height, 0.022],
        [0, theta, 0],
      ),
      material: order[i % order.length],
      bones,
      power: 5,
    });
  }
  return parts;
}

function torso(): Part[] {
  const parts: Part[] = [];

  // Maglione come superficie di rivoluzione: il profilo descrive fianchi,
  // torace, spalle arrotondate e l'apertura girocollo. Una primitiva unica
  // evita i raccordi visibili che lasciava il cilindro.
  const profile: readonly [number, number][] = [
    [0.001, 0.726],
    [0.15, 0.728],
    [0.222, 0.735],
    [0.243, 0.75],
    [0.246, 0.8],
    [0.248, 0.88],
    [0.252, 0.97],
    [0.262, 1.06],
    [0.274, 1.15],
    [0.284, 1.218],
    [0.284, 1.252],
    [0.272, 1.282],
    [0.248, 1.306],
    [0.206, 1.328],
    [0.158, 1.342],
    [0.124, 1.35],
  ];
  const body = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    30,
  );
  body.scale(1, 1, 0.74);
  parts.push({ geometry: body, material: 'sweater', bones: BONE_GROUPS.torso, power: 2.2 });

  // Bordo a coste in fondo al maglione.
  const hem = new THREE.CylinderGeometry(0.251, 0.245, 0.062, 30, 2, false);
  hem.translate(0, 0.757, 0);
  hem.scale(1, 1, 0.74);
  parts.push({ geometry: hem, material: 'sweaterRib', bones: BONE_GROUPS.torso, power: 4 });

  // Costina del girocollo attorno all'apertura.
  const neckRib = new THREE.TorusGeometry(0.124, 0.019, 8, 30);
  neckRib.rotateX(Math.PI / 2);
  neckRib.scale(1, 1, 0.74);
  neckRib.translate(0, 1.349, 0);
  parts.push({ geometry: neckRib, material: 'sweaterRib', bones: BONE_GROUPS.collar, power: 4 });

  // Camicia a righe: tubo sotto il maglione, visibile nello scollo.
  parts.push(...stripedRing(1.17, 1.372, 0.108, 0.82, BONE_GROUPS.collar, 14));

  // Punte del colletto, appoggiate sopra il girocollo.
  for (const s of [1, -1]) {
    parts.push(
      ...stripedPanel(
        [s * 0.108, 1.336, 0.112],
        [0.125, 0.028, 0.094],
        [deg(-26), deg(s * -30), deg(s * 10)],
        BONE_GROUPS.collar,
        5,
      ),
    );
  }

  // Fascia del colletto dietro al collo.
  parts.push({
    geometry: arc([0, 1.372, -0.012], 0.113, 0.024, deg(210), [deg(90), 0, deg(90)], [6, 20]),
    material: 'shirtWhite',
    bones: BONE_GROUPS.collar,
    power: 5,
  });

  return parts;
}

// ---------------------------------------------------------------------------
// Braccia e mani
// ---------------------------------------------------------------------------

function boneHead(name: string): Vec3 {
  const b = RIG.find((x) => x.name === name);
  if (!b) throw new Error(`Bone non trovato: ${name}`);
  return b.head;
}

function arms(): Part[] {
  const parts: Part[] = [];

  for (const side of ['L', 'R'] as const) {
    const group = side === 'L' ? BONE_GROUPS.armL : BONE_GROUPS.armR;
    const handGroup = side === 'L' ? BONE_GROUPS.handL : BONE_GROUPS.handR;
    const shoulder = boneHead(`UpperArm_${side}`);
    const elbow = boneHead(`LowerArm_${side}`);
    const wrist = boneHead(`Hand_${side}`);

    // Maniche del maglione: molti segmenti in altezza per una piega pulita al gomito.
    parts.push({
      geometry: tube(shoulder, elbow, 0.118, 0.096, 18, 12),
      material: 'sweater',
      bones: group,
      power: 2.5,
    });
    parts.push({
      geometry: tube(elbow, wrist, 0.096, 0.068, 18, 12),
      material: 'sweater',
      bones: group,
      power: 2.5,
    });
    // Polsino.
    parts.push({
      geometry: tube(
        [wrist[0] - 0.024, wrist[1] + 0.032, wrist[2]],
        [wrist[0] + 0.006, wrist[1] - 0.008, wrist[2]],
        0.073,
        0.068,
        18,
        2,
      ),
      material: 'sweaterRib',
      bones: group,
      power: 5,
    });

    // Palmo: schiacciato lungo la normale della mano, non sferico.
    // Dopo la rotazione su Z di 20° l'asse X dell'ellissoide coincide con lo
    // spessore della mano, Y con la lunghezza del palmo e Z con la larghezza.
    const sign = side === 'L' ? 1 : -1;
    parts.push({
      geometry: ellipsoid(
        [wrist[0] + sign * 0.016, wrist[1] - 0.043, wrist[2]],
        [0.034, 0.072, 0.066],
        [16, 12],
        [0, 0, deg(sign * -20)],
      ),
      material: 'skin',
      bones: handGroup,
      power: 4,
    });

    // Dita: due falangi ciascuna, più la punta.
    const fingerDirScale = 0.78;
    for (const id of [...FINGER_IDS, 'Thumb']) {
      const a = boneHead(`${id}1_${side}`);
      const b = boneHead(`${id}2_${side}`);
      const tipDir: Vec3 = [
        (b[0] - a[0]) * fingerDirScale,
        (b[1] - a[1]) * fingerDirScale,
        (b[2] - a[2]) * fingerDirScale,
      ];
      const tip: Vec3 = [b[0] + tipDir[0], b[1] + tipDir[1], b[2] + tipDir[2]];
      const r = id === 'Thumb' ? 0.025 : 0.021;
      parts.push({
        geometry: tube(a, b, r, r * 0.92, 10, 3),
        material: 'skin',
        bones: handGroup,
        power: 7,
      });
      parts.push({
        geometry: tube(b, tip, r * 0.92, r * 0.72, 10, 3),
        material: 'skin',
        bones: handGroup,
        power: 7,
      });
      parts.push({
        geometry: ellipsoid(tip, [r * 0.78, r * 0.78, r * 0.78], [10, 8]),
        material: 'skin',
        bones: handGroup,
        power: 7,
      });
    }
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Gambe
// ---------------------------------------------------------------------------

function legs(): Part[] {
  const parts: Part[] = [];
  for (const side of ['L', 'R'] as const) {
    const group = side === 'L' ? BONE_GROUPS.legL : BONE_GROUPS.legR;
    const footGroup = side === 'L' ? BONE_GROUPS.footL : BONE_GROUPS.footR;
    const hip = boneHead(`UpperLeg_${side}`);
    const knee = boneHead(`LowerLeg_${side}`);
    const ankle = boneHead(`Foot_${side}`);

    parts.push({
      geometry: tube(hip, knee, 0.138, 0.112, 16, 8),
      material: 'trousers',
      bones: group,
      power: 2.5,
    });
    parts.push({
      geometry: tube(knee, ankle, 0.112, 0.09, 16, 8),
      material: 'trousers',
      bones: group,
      power: 2.5,
    });
    parts.push({
      geometry: ellipsoid(
        [ankle[0], ankle[1] - 0.028, ankle[2] + 0.045],
        [0.075, 0.052, 0.126],
        [16, 10],
      ),
      material: 'shoes',
      bones: footGroup,
      power: 6,
    });
  }
  return parts;
}

export function buildParts(): Part[] {
  return [...head(), ...torso(), ...arms(), ...legs()];
}

export const MATERIAL_COLORS = PALETTE;
