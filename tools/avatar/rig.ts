/**
 * Scheletro dell'avatar.
 *
 * Le posizioni sono assolute nella posa di riposo (Y verso l'alto, origine ai
 * piedi, +X alla sinistra anatomica del personaggio, +Z davanti). Le posizioni
 * locali dei bone vengono derivate da `buildSkeleton`, così la posa di riposo
 * resta leggibile e modificabile senza ricalcoli a mano.
 *
 * Nella posa di riposo tutte le rotazioni sono identità: un'animazione che
 * azzera le rotazioni riporta esattamente alla posa di riposo. È la proprietà
 * che rende sicure le transizioni verso Idle (spec 4.3).
 */

export interface BoneDef {
  name: string;
  parent: string | null;
  /** Posizione assoluta nella posa di riposo. */
  head: readonly [number, number, number];
}

const FINGERS = [
  { id: 'Index', z: 0.036, seg: 0.048 },
  { id: 'Middle', z: 0.012, seg: 0.053 },
  { id: 'Ring', z: -0.012, seg: 0.047 },
  { id: 'Pinky', z: -0.035, seg: 0.038 },
] as const;

/**
 * Ingrandimento caricaturale della testa, applicato attorno all'articolazione
 * del collo. Lo stesso fattore è usato dalla mesh, così bone e geometria
 * restano allineati: cambiare qui la proporzione aggiorna tutto il volto.
 */
export const HEAD_PIVOT_Y = 1.45;
export const HEAD_SCALE = 1.33;

/** Centro del bulbo oculare sinistro, prima dell'ingrandimento della testa. */
export const EYE_L: readonly [number, number, number] = [0.0755, 1.6235, 0.1705];

function headScaled(p: readonly [number, number, number]): [number, number, number] {
  return [
    p[0] * HEAD_SCALE,
    HEAD_PIVOT_Y + (p[1] - HEAD_PIVOT_Y) * HEAD_SCALE,
    p[2] * HEAD_SCALE,
  ];
}

/**
 * Direzione del braccio in posa di riposo: A-pose a 20° dalla verticale.
 *
 * L'angolo non è estetico ma funzionale: con il braccio quasi verticale,
 * ruotare la spalla su Y orienta il piano in cui si piega il gomito, e
 * ruotare l'avambraccio su X lo porta davanti al corpo. È ciò che rende
 * scrivibili a mano pose come la bilancia. Con l'A-pose larga che si usa di
 * solito per lo skinning, le stesse rotazioni lasciavano le mani ai lati.
 */
const ARM_ANGLE = (20 * Math.PI) / 180;
const ARM_DIR = [Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0] as const;

const UPPER_ARM_L: readonly [number, number, number] = [0.21, 1.27, 0];
const SEGMENT = 0.278;

const ELBOW_L: readonly [number, number, number] = [
  UPPER_ARM_L[0] + ARM_DIR[0] * SEGMENT,
  UPPER_ARM_L[1] + ARM_DIR[1] * SEGMENT,
  0,
];

const HAND_L: readonly [number, number, number] = [
  ELBOW_L[0] + ARM_DIR[0] * SEGMENT,
  ELBOW_L[1] + ARM_DIR[1] * SEGMENT,
  0,
];

function along(
  from: readonly [number, number, number],
  dist: number,
  extra: readonly [number, number, number] = [0, 0, 0],
): [number, number, number] {
  return [
    from[0] + ARM_DIR[0] * dist + extra[0],
    from[1] + ARM_DIR[1] * dist + extra[1],
    from[2] + ARM_DIR[2] * dist + extra[2],
  ];
}

/** Bone della mano sinistra: palmo, pollice e quattro dita a due falangi. */
function handBones(): BoneDef[] {
  const bones: BoneDef[] = [];

  // Pollice: staccato dal palmo, ruotato in avanti.
  const thumb1 = along(HAND_L, 0.03, [0, 0, 0.052]);
  bones.push({ name: 'Thumb1_L', parent: 'Hand_L', head: thumb1 });
  bones.push({ name: 'Thumb2_L', parent: 'Thumb1_L', head: along(thumb1, 0.042, [0, 0, 0.016]) });

  for (const f of FINGERS) {
    const root = along(HAND_L, 0.072, [0, 0, f.z]);
    const mid = along(root, f.seg);
    bones.push({ name: `${f.id}1_L`, parent: 'Hand_L', head: root });
    bones.push({ name: `${f.id}2_L`, parent: `${f.id}1_L`, head: mid });
  }

  return bones;
}

/** Specchia un bone del lato sinistro sul lato destro (X invertito). */
function mirror(bone: BoneDef): BoneDef {
  return {
    name: bone.name.replace(/_L$/, '_R'),
    parent: bone.parent ? bone.parent.replace(/_L$/, '_R') : null,
    head: [-bone.head[0], bone.head[1], bone.head[2]],
  };
}

const LEFT_SIDE: BoneDef[] = [
  { name: 'Shoulder_L', parent: 'Chest', head: [0.07, 1.3, 0] },
  { name: 'UpperArm_L', parent: 'Shoulder_L', head: UPPER_ARM_L },
  { name: 'LowerArm_L', parent: 'UpperArm_L', head: ELBOW_L },
  { name: 'Hand_L', parent: 'LowerArm_L', head: HAND_L },
  ...handBones(),
  { name: 'UpperLeg_L', parent: 'Hips', head: [0.095, 0.84, 0] },
  { name: 'LowerLeg_L', parent: 'UpperLeg_L', head: [0.1, 0.46, 0] },
  { name: 'Foot_L', parent: 'LowerLeg_L', head: [0.105, 0.075, 0] },
  { name: 'Toe_L', parent: 'Foot_L', head: [0.105, 0.045, 0.12] },
];

export const RIG: readonly BoneDef[] = [
  // Catena centrale.
  { name: 'Hips', parent: null, head: [0, 0.86, 0] },
  { name: 'Spine', parent: 'Hips', head: [0, 1.0, 0] },
  { name: 'Chest', parent: 'Spine', head: [0, 1.16, 0] },
  { name: 'Neck', parent: 'Chest', head: [0, 1.35, 0] },
  { name: 'Head', parent: 'Neck', head: [0, 1.45, 0] },

  // Controlli facciali: niente shape key, le espressioni sono guidate da bone
  // dedicati (spec 3.2 — "controlli o shape key"). Restano sostituibili con
  // morph target in una versione successiva senza toccare il motore.
  { name: 'Jaw', parent: 'Head', head: headScaled([0, 1.565, 0.03]) },
  { name: 'Brow_L', parent: 'Head', head: headScaled([0.082, 1.672, 0.15]) },
  { name: 'Brow_R', parent: 'Head', head: headScaled([-0.082, 1.672, 0.15]) },
  // Occhi e palpebre condividono il perno: è il centro del bulbo. Solo così la
  // pupilla ruota restando sulla superficie e la palpebra le scorre sopra
  // invece di affondare nella testa.
  { name: 'Eye_L', parent: 'Head', head: headScaled(EYE_L) },
  { name: 'Eye_R', parent: 'Head', head: headScaled([-EYE_L[0], EYE_L[1], EYE_L[2]]) },
  { name: 'Lid_L', parent: 'Head', head: headScaled(EYE_L) },
  { name: 'Lid_R', parent: 'Head', head: headScaled([-EYE_L[0], EYE_L[1], EYE_L[2]]) },

  ...LEFT_SIDE,
  ...LEFT_SIDE.map(mirror),
];

export const BONE_NAMES: readonly string[] = RIG.map((b) => b.name);

/** Gruppi usati per limitare lo skinning di ogni parte della mesh. */
export const BONE_GROUPS = {
  head: ['Head', 'Neck'],
  face: ['Head', 'Jaw'],
  browL: ['Brow_L'],
  browR: ['Brow_R'],
  eyeL: ['Eye_L'],
  eyeR: ['Eye_R'],
  lidL: ['Lid_L'],
  lidR: ['Lid_R'],
  jaw: ['Jaw', 'Head'],
  torso: ['Hips', 'Spine', 'Chest', 'Neck'],
  collar: ['Chest', 'Neck'],
  armL: ['Chest', 'Shoulder_L', 'UpperArm_L', 'LowerArm_L', 'Hand_L'],
  armR: ['Chest', 'Shoulder_R', 'UpperArm_R', 'LowerArm_R', 'Hand_R'],
  handL: [
    'LowerArm_L',
    'Hand_L',
    'Thumb1_L',
    'Thumb2_L',
    ...FINGERS.flatMap((f) => [`${f.id}1_L`, `${f.id}2_L`]),
  ],
  handR: [
    'LowerArm_R',
    'Hand_R',
    'Thumb1_R',
    'Thumb2_R',
    ...FINGERS.flatMap((f) => [`${f.id}1_R`, `${f.id}2_R`]),
  ],
  legL: ['Hips', 'UpperLeg_L', 'LowerLeg_L', 'Foot_L'],
  legR: ['Hips', 'UpperLeg_R', 'LowerLeg_R', 'Foot_R'],
  footL: ['Foot_L', 'Toe_L'],
  footR: ['Foot_R', 'Toe_R'],
} as const;

export const FINGER_IDS = FINGERS.map((f) => f.id);
