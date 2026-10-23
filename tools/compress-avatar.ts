/**
 * Compressione del GLB con meshopt.
 *
 * Senza, il modello pesa 1,4 MB: con, 385 kB. Misurate le alternative su questo
 * modello — Draco 688 kB, sola quantizzazione 909 — meshopt vince, e il suo
 * decodificatore arriva con three e pesa una ventina di kB contro i circa 200
 * del wasm di Draco.
 *
 * È uno script del progetto e non la CLI di `@gltf-transform`: quella porta
 * trecentoquarantasei pacchetti nell'albero di build per un passo solo, mentre
 * le librerie programmatiche ne bastano la metà. Meno superficie da mantenere
 * e da far scansionare.
 *
 * La compressione dev'essere **deterministica**: il GLB è versionato, e la CI
 * confronta il file nel repository con una ricostruzione. Se il risultato
 * cambiasse a parità di sorgenti, quel controllo fallirebbe a ogni giro.
 *
 * Uso: tsx tools/compress-avatar.ts [percorso.glb]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';

const path = process.argv[2] ?? 'public/assets/avatar.glb';

await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const before = statSync(path).size;
const document = await io.read(path);

// Solo `meshopt`, niente `prune` né `dedup`.
//
// Un primo tentativo li metteva davanti, con l'idea che comprimere dati
// destinati a essere buttati fosse lavoro sprecato. `prune` però **rimuove la
// carta del viso**: è una mesh il cui materiale viene sostituito a runtime dal
// renderer, e dall'interno del documento sembra inutilizzata. Il risultato era
// un avatar senza testa, con l'inquadratura che si allargava da sé perché il
// riquadro d'ingombro si era accorciato. L'ha preso `tools/visual/frame.mjs`,
// non i controlli headless, che del modello non sanno niente.
await document.transform(meshopt({ encoder: MeshoptEncoder }));

await io.write(path, document);
const after = statSync(path).size;
console.log(
  `avatar.glb  ${(before / 1024).toFixed(1)} kB → ${(after / 1024).toFixed(1)} kB ` +
    `(${Math.round((1 - after / before) * 100)}% in meno)`,
);
