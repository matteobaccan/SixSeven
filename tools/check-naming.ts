/**
 * Verifica della rimappatura dei nomi dei bone.
 *
 * Non potendo scaricare rig di terze parti in questo ambiente, il controllo
 * costruisce scheletri sintetici con le convenzioni più diffuse e verifica che
 * vengano ricondotti ai nomi canonici, clip comprese.
 *
 * Uso: npm run check:naming
 */
import { AnimationClip, Bone, Object3D, QuaternionKeyframeTrack } from 'three';
import { applyBoneNaming, canonicalBoneName } from '../src/assets/BoneNaming.ts';

let failures = 0;

function expect(actual: unknown, expected: unknown, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`  FALLITO  ${label}\n           atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`);
  }
}

console.log('Nomi singoli');
const cases: [string, string | null][] = [
  // Mixamo
  ['mixamorig:Hips', 'Hips'],
  ['mixamorig:Spine', 'Spine'],
  ['mixamorig:Spine1', 'Chest'],
  ['mixamorig:Neck', 'Neck'],
  ['mixamorig:Head', 'Head'],
  ['mixamorig:LeftShoulder', 'Shoulder_L'],
  ['mixamorig:LeftArm', 'UpperArm_L'],
  ['mixamorig:LeftForeArm', 'LowerArm_L'],
  ['mixamorig:RightHand', 'Hand_R'],
  ['mixamorig:RightHandIndex1', 'Index1_R'],
  ['mixamorig:LeftHandThumb2', 'Thumb2_L'],
  ['mixamorig:LeftUpLeg', 'UpperLeg_L'],
  ['mixamorig:LeftLeg', 'LowerLeg_L'],
  ['mixamorig:LeftToeBase', 'Toe_L'],
  // La terza falange non ha corrispondente nel nostro rig
  ['mixamorig:LeftHandThumb3', null],

  // Rigify / Blender
  ['upper_arm.L', 'UpperArm_L'],
  ['forearm.R', 'LowerArm_R'],
  ['shoulder.L', 'Shoulder_L'],
  ['thigh.L', 'UpperLeg_L'],
  ['shin.R', 'LowerLeg_R'],
  ['foot.L', 'Foot_L'],
  ['spine.001', 'Chest'],
  ['DEF-upper_arm.L', 'UpperArm_L'],

  // Varianti diffuse nei pacchetti CC0
  ['Left_Hand', 'Hand_L'],
  ['L_Hand', 'Hand_L'],
  ['arm_r', 'UpperArm_R'],
  ['Armature|Head', 'Head'],

  // Già canonici: devono restare identici
  ['Hips', 'Hips'],
  ['UpperArm_L', 'UpperArm_L'],
  ['Thumb2_R', 'Thumb2_R'],
  ['Lid_L', 'Lid_L'],

  // Non riconoscibili
  ['Bone.042', null],
  ['Shoulder', null], // senza lato è ambiguo
];
for (const [input, expected] of cases) expect(canonicalBoneName(input), expected, input);

console.log('Scheletro Mixamo completo, con clip');
const chain = [
  'mixamorig:Hips',
  'mixamorig:Spine',
  'mixamorig:Spine1',
  'mixamorig:LeftShoulder',
  'mixamorig:LeftArm',
  'mixamorig:LeftForeArm',
  'mixamorig:LeftHand',
];
const root = new Object3D();
let parent: Object3D = root;
for (const name of chain) {
  const bone = new Bone();
  bone.name = name;
  parent.add(bone);
  parent = bone;
}

const clip = new AnimationClip('Walk', 1, [
  new QuaternionKeyframeTrack('mixamorig:LeftForeArm.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  new QuaternionKeyframeTrack('mixamorig:LeftArm.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
]);

const result = applyBoneNaming(root, [clip]);
const names: string[] = [];
root.traverse((o) => {
  if ((o as { isBone?: boolean }).isBone) names.push(o.name);
});
expect(names, ['Hips', 'Spine', 'Chest', 'Shoulder_L', 'UpperArm_L', 'LowerArm_L', 'Hand_L'], 'nodi rinominati');
expect(
  clip.tracks.map((t) => t.name),
  ['LowerArm_L.quaternion', 'UpperArm_L.quaternion'],
  'track riscritte',
);
expect(result.unrecognized, [], 'nessun bone non riconosciuto');

console.log('Modello già canonico: non deve cambiare nulla');
const ours = new Object3D();
for (const name of ['Hips', 'Spine', 'Chest', 'UpperArm_L', 'Lid_R']) {
  const bone = new Bone();
  bone.name = name;
  ours.add(bone);
}
const untouched = applyBoneNaming(ours, []);
expect(untouched.renamed.size, 0, 'nessuna rinomina');
expect(untouched.alreadyCanonical.length, 5, 'tutti già canonici');

console.log(failures === 0 ? '\nTutti i controlli superati.' : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
