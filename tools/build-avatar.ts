/**
 * Pipeline di produzione dell'avatar: costruisce mesh, scheletro e clip e
 * scrive `public/assets/avatar.glb`.
 *
 * Il modello è un asset del progetto: l'app lo carica come GLB e non conosce
 * nulla di questa pipeline. Un modello realizzato in Blender può sostituire il
 * file senza toccare il motore, purché mantenga i nomi delle clip dichiarati
 * in `src/assets/AssetCatalog.ts`.
 *
 * Uso: npm run build:avatar
 */
import './avatar/dom-shim.ts';

import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

import { PALETTE, type PaletteKey } from './avatar/palette.ts';
import { buildParts } from './avatar/mesh.ts';
import { buildRig, skinPart } from './avatar/skin.ts';
import { buildClips } from './avatar/clips.ts';

const OUTPUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'assets',
  'avatar.glb',
);

function buildAvatar(): { mesh: THREE.SkinnedMesh; clips: THREE.AnimationClip[]; vertices: number } {
  const rig = buildRig();
  const parts = buildParts();

  // Normalizza gli attributi: il merge richiede lo stesso set su ogni parte.
  for (const part of parts) {
    part.geometry.deleteAttribute('uv');
    part.geometry.computeVertexNormals();
    skinPart(part, rig);
  }

  // Un gruppo per materiale, così il GLB espone una primitive per colore.
  const usedMaterials: PaletteKey[] = [];
  const byMaterial = new Map<PaletteKey, THREE.BufferGeometry[]>();
  for (const part of parts) {
    if (!byMaterial.has(part.material)) {
      byMaterial.set(part.material, []);
      usedMaterials.push(part.material);
    }
    byMaterial.get(part.material)!.push(part.geometry);
  }

  const perMaterial = usedMaterials.map((key) => {
    const merged = mergeGeometries(byMaterial.get(key)!, false);
    if (!merged) throw new Error(`Merge fallito per il materiale ${key}`);
    return merged;
  });

  const geometry = mergeGeometries(perMaterial, true);
  if (!geometry) throw new Error('Merge finale della geometria fallito');

  const materials = usedMaterials.map(
    (key) =>
      new THREE.MeshStandardMaterial({
        name: key,
        color: new THREE.Color(PALETTE[key]),
        roughness: 0.85,
        metalness: 0,
      }),
  );

  const mesh = new THREE.SkinnedMesh(geometry, materials);
  mesh.name = 'SixSevenAvatar';
  mesh.add(rig.root);
  mesh.bind(new THREE.Skeleton(rig.bones));

  return { mesh, clips: buildClips(), vertices: geometry.attributes.position.count };
}

async function main(): Promise<void> {
  const { mesh, clips, vertices } = buildAvatar();

  const root = new THREE.Group();
  root.name = 'SixSeven';
  root.add(mesh);

  const buffer = await new Promise<ArrayBuffer>((ok, fail) => {
    new GLTFExporter().parse(
      root,
      (result) => ok(result as ArrayBuffer),
      (error) => fail(error),
      { binary: true, animations: clips, onlyVisible: false },
    );
  });

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, Buffer.from(buffer));

  const bones = mesh.skeleton.bones.length;
  console.log(`avatar.glb  ${(buffer.byteLength / 1024).toFixed(1)} kB`);
  console.log(`  vertici   ${vertices}`);
  console.log(`  bone      ${bones}`);
  console.log(`  materiali ${(mesh.material as THREE.Material[]).length}`);
  for (const clip of clips) {
    console.log(`  clip      ${clip.name.padEnd(16)} ${clip.duration.toFixed(2)}s  ${clip.tracks.length} track`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
