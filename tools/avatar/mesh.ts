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
import { BONE_GROUPS, FINGER_IDS, RIG } from './rig.ts';
import { FACE_CROP, FACE_IMAGE, FACE_LANDMARKS, faceSpanAt, faceToWorld } from './face.ts';
import { deg, ellipsoid, tube, type Vec3 } from './geometry.ts';

export interface Part {
  geometry: THREE.BufferGeometry;
  material: PaletteKey;
  bones: readonly string[];
  /** Esponente del falloff: alto = skinning più rigido. */
  power?: number;
  /** La parte porta già i propri pesi di skinning: non ricalcolarli. */
  preskinned?: boolean;
}

// ---------------------------------------------------------------------------
// Viso: la caricatura come texture su una superficie curva
// ---------------------------------------------------------------------------

/** Suddivisione della superficie del viso: serve a deformarla, non a sagomarla. */
const FACE_COLS = 30;
const FACE_ROWS = 38;

/** Influenza gaussiana in pixel immagine, attorno a un tratto del disegno. */
function influence(
  x: number,
  y: number,
  centre: { x: number; y: number },
  rx: number,
  ry: number,
): number {
  const dx = (x - centre.x) / rx;
  const dy = (y - centre.y) / ry;
  return Math.exp(-(dx * dx + dy * dy));
}

function boneIndex(name: string): number {
  const index = RIG.findIndex((b) => b.name === name);
  if (index < 0) throw new Error(`Bone non trovato nel rig: ${name}`);
  return index;
}

/**
 * Superficie del viso: griglia texturizzata con la caricatura, curvata a
 * parabola per dare volume e ritagliata dal canale alfa della texture stessa.
 *
 * I pesi di skinning non si possono calcolare per distanza dai bone come per il
 * resto del corpo: qui le "articolazioni" sono tratti disegnati, non volumi. Si
 * usano quindi zone di influenza gaussiane centrate sui punti misurati
 * sull'immagine, come nel rig 2D del Ritardometro. Ruotando `Lid_L` la pelle
 * dipinta scende sopra l'occhio: è così che il personaggio sbatte le palpebre
 * pur essendo un disegno.
 */
function faceCard(): Part {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];

  const head = boneIndex('Head');
  // Su un viso disegnato l'apertura della bocca è il movimento più delicato:
  // trascinare troppo allunga il mento invece di aprire le labbra. Da qui il
  // braccio di leva corto della mandibola nel rig e il raggio contenuto.
  const zones = [
    { bone: boneIndex('Lid_L'), centre: FACE_LANDMARKS.eye_L, rx: 56, ry: 38 },
    { bone: boneIndex('Lid_R'), centre: FACE_LANDMARKS.eye_R, rx: 56, ry: 38 },
    { bone: boneIndex('Brow_L'), centre: FACE_LANDMARKS.brow_L, rx: 62, ry: 26 },
    { bone: boneIndex('Brow_R'), centre: FACE_LANDMARKS.brow_R, rx: 62, ry: 26 },
    { bone: boneIndex('Jaw'), centre: FACE_LANDMARKS.mouth, rx: 88, ry: 44 },
  ];

  for (let row = 0; row <= FACE_ROWS; row++) {
    const v = row / FACE_ROWS;
    const imgY = FACE_CROP.y0 + (FACE_CROP.y1 - FACE_CROP.y0) * v;

    // Sotto il mento la griglia si restringe al collo: lascia fuori le punte
    // del colletto disegnato senza intaccare il viso.
    const span = faceSpanAt(imgY);

    for (let col = 0; col <= FACE_COLS; col++) {
      const u = col / FACE_COLS;
      const imgX = span.x0 + (span.x1 - span.x0) * u;

      const [x, y, z] = faceToWorld({ x: imgX, y: imgY });
      positions.push(x, y, z);
      // La texture è l'immagine intera: le UV puntano al ritaglio della testa.
      uvs.push(imgX / FACE_IMAGE.width, 1 - imgY / FACE_IMAGE.height);

      // Le tre zone più influenti più la testa: quattro influenze, il massimo
      // che glTF trasporta per vertice.
      const ranked = zones
        .map((zone) => ({ bone: zone.bone, w: influence(imgX, imgY, zone.centre, zone.rx, zone.ry) }))
        .sort((a, b) => b.w - a.w)
        .slice(0, 3)
        .filter((entry) => entry.w > 0.01);

      const pull = Math.min(0.9, ranked.reduce((sum, entry) => sum + entry.w, 0) * 0.9);
      const entries = [{ bone: head, w: 1 - pull }, ...ranked.map((e) => ({ bone: e.bone, w: e.w * 0.9 }))];
      const total = entries.reduce((sum, e) => sum + e.w, 0);

      for (let i = 0; i < 4; i++) {
        const entry = entries[i];
        skinIndex.push(entry ? entry.bone : 0);
        skinWeight.push(entry ? entry.w / total : 0);
      }
    }
  }

  const stride = FACE_COLS + 1;
  for (let row = 0; row < FACE_ROWS; row++) {
    for (let col = 0; col < FACE_COLS; col++) {
      const a = row * stride + col;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, material: 'face', bones: [], preskinned: true };
}

function head(): Part[] {
  return [
    faceCard(),
    // Collo: prolunga verso il basso quello dipinto. Il raggio raccorda la
    // larghezza del bordo inferiore del viso e la profondità lo tiene appena
    // dietro, troppo poco perché il filtro dei bordi ci veda uno stacco.
    {
      geometry: tube([0, 1.24, -0.058], [0, 1.452, -0.058], 0.13, 0.148, 24, 8),
      material: 'skin',
      bones: BONE_GROUPS.head,
      power: 2.5,
    },
  ];
}

// ---------------------------------------------------------------------------
// Busto, maglione e camicia
// ---------------------------------------------------------------------------

function torso(): Part[] {
  const parts: Part[] = [];

  // Maglione come superficie di rivoluzione: il profilo descrive fianchi,
  // torace, spalle arrotondate e l'apertura girocollo. Una primitiva unica
  // evita i raccordi visibili che lasciava il cilindro.
  const profile: readonly [number, number][] = [
    [0.001, 0.726],
    [0.14, 0.728],
    [0.205, 0.735],
    [0.224, 0.75],
    [0.227, 0.8],
    [0.229, 0.88],
    [0.232, 0.97],
    [0.238, 1.06],
    [0.246, 1.14],
    [0.251, 1.196],
    [0.2515, 1.232],
    [0.2465, 1.268],
    [0.2345, 1.298],
    [0.2185, 1.33],
    [0.196, 1.366],
    [0.172, 1.398],
    [0.152, 1.427],
  ];
  const body = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    30,
  );
  body.scale(1, 1, 0.74);
  parts.push({ geometry: body, material: 'sweater', bones: BONE_GROUPS.torso, power: 2.2 });

  // Bordo a coste in fondo al maglione.
  const hem = new THREE.CylinderGeometry(0.231, 0.226, 0.062, 30, 2, false);
  hem.translate(0, 0.757, 0);
  hem.scale(1, 1, 0.74);
  parts.push({ geometry: hem, material: 'sweaterRib', bones: BONE_GROUPS.torso, power: 4 });

  // Costina del girocollo: passa sul bordo inferiore della superficie del viso
  // e lo nasconde. La sua altezza è lo stacco fra testa e corpo — più è bassa,
  // più collo dipinto resta scoperto, fin dove la caricatura ne ha.
  const neckRib = new THREE.TorusGeometry(0.152, 0.024, 8, 30);
  neckRib.rotateX(Math.PI / 2);
  neckRib.scale(1, 1, 0.74);
  neckRib.translate(0, 1.427, 0);
  parts.push({ geometry: neckRib, material: 'sweaterRib', bones: BONE_GROUPS.collar, power: 4 });

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

    // La manica parte dentro al busto ed è aperta in cima: la calotta piatta
    // del tubo, con le spalle strette, sporgeva dal maglione come una
    // spallina squadrata.
    const dir: Vec3 = [
      (elbow[0] - shoulder[0]) / 0.278,
      (elbow[1] - shoulder[1]) / 0.278,
      (elbow[2] - shoulder[2]) / 0.278,
    ];
    const sleeveTop: Vec3 = [
      shoulder[0] - dir[0] * 0.075,
      shoulder[1] - dir[1] * 0.075,
      shoulder[2] - dir[2] * 0.075,
    ];

    // Calotta della spalla: copre il punto in cui la manica esce dal busto. La
    // manica è più grossa del raggio del maglione a quell'altezza, quindi il
    // suo bordo sporgerebbe come una spallina squadrata. Legata al braccio,
    // così lo accompagna quando si alza.
    parts.push({
      geometry: ellipsoid(
        [shoulder[0] - dir[0] * 0.02, shoulder[1] - dir[1] * 0.02, 0],
        [0.118, 0.112, 0.108],
        [20, 14],
      ),
      material: 'sweater',
      bones: group,
      power: 3,
    });

    // Maniche del maglione: molti segmenti in altezza per una piega pulita al gomito.
    parts.push({
      geometry: tube(sleeveTop, elbow, 0.112, 0.096, 18, 12, true),
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
      geometry: tube(hip, knee, 0.124, 0.104, 16, 8),
      material: 'trousers',
      bones: group,
      power: 2.5,
    });
    parts.push({
      geometry: tube(knee, ankle, 0.104, 0.086, 16, 8),
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
