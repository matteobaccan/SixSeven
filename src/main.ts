/**
 * Avvio del prototipo Fase 1.
 *
 * Questo file è solo il collante tra i moduli: carica l'avatar, mostra il
 * catalogo e riproduce le clip su richiesta. La macchina a stati dei turni
 * (spec 5.2) arriva in Fase 2 e si innesterà qui al posto di `runDemo`, senza
 * modifiche ad AvatarRenderer, AnimationController o AssetCatalog.
 */
import { AnimationController } from './avatar/AnimationController.ts';
import { AvatarRenderer } from './avatar/AvatarRenderer.ts';
import { IdleLife } from './avatar/IdleLife.ts';
import { entriesOfKind, getEntry, IDLE_ID, plannedEntries } from './assets/AssetCatalog.ts';
import { inspectAvatar } from './assets/AvatarContract.ts';
import { applyBoneNaming } from './assets/BoneNaming.ts';
import type { CatalogEntry } from './assets/AssetCatalog.ts';
import { UIController } from './ui/UIController.ts';

const AVATAR_URL = `${import.meta.env.BASE_URL}assets/avatar.glb`;
const FACE_URL = `${import.meta.env.BASE_URL}assets/face.png`;

async function boot(): Promise<void> {
  const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas #stage non trovato');

  let busy = false;

  const ui = new UIController({
    onPlay: (entry) => void playEntry(entry),
    onDemo: () => void runDemo(),
    onReset: () => renderer.resetOrientation(),
  });

  // Su schermi ad alta densità il cap sul pixel ratio tiene il costo per frame
  // sotto controllo senza interventi sulla scena (spec 9 — prestazioni).
  const renderer = new AvatarRenderer(canvas, {
    maxPixelRatio: 2,
    enableInspect: true,
    faceTextureUrl: FACE_URL,
  });

  let avatar;
  try {
    avatar = await renderer.load(AVATAR_URL, (ratio) => ui.setProgress(ratio));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    ui.showError(`Impossibile caricare l’avatar: ${detail}`);
    return;
  }

  // Riconduce i nomi dei bone a quelli canonici: così un rig di terze parti
  // (Mixamo, Rigify, pacchetti CC0) funziona senza modifiche al motore. Va
  // fatto prima di costruire controller e strato procedurale, che cercano i
  // bone per nome.
  const naming = applyBoneNaming(avatar.root, avatar.clips);

  const animations = new AnimationController(avatar.root, avatar.clips);
  const life = new IdleLife(avatar.root);
  const idleClip = getEntry(IDLE_ID).clip;

  // Verifica del contratto: con un modello 3D sostituito dice subito cosa il
  // motore ha riconosciuto e cosa manca, senza dover leggere il codice.
  const report = inspectAvatar(avatar.root, animations.clipNames);
  ui.renderDiagnostics(report, naming);
  if (report.missingRequiredBones.length > 0) {
    console.warn('Bone richiesti mancanti nel modello:', report.missingRequiredBones.join(', '));
  }

  const moves = entriesOfKind('move', animations.clipNames);
  const reactions = entriesOfKind('reaction', animations.clipNames).filter((e) => e.id !== IDLE_ID);
  ui.renderCatalog(moves, reactions, plannedEntries(animations.clipNames));

  async function toIdle(crossFade = 0.35): Promise<void> {
    if (idleClip && animations.has(idleClip)) {
      await animations.play(idleClip, { loop: true, crossFade });
    }
  }

  async function playEntry(entry: CatalogEntry, keepBusy = false): Promise<void> {
    if (busy || !entry.clip) return;
    busy = true;
    ui.setBusy(true);
    ui.setStatus(`${entry.id} · ${entry.name}`);
    try {
      await animations.play(entry.clip, {
        loop: entry.loop,
        timeScale: entry.timeScale,
        crossFade: 0.22,
      });
      if (!entry.loop) await toIdle();
    } finally {
      if (!keepBusy) {
        busy = false;
        ui.setBusy(false);
        ui.setStatus('In attesa');
      }
    }
  }

  /**
   * Sequenza di accettazione della Fase 1: l'avatar esegue una mossa Six Seven,
   * torna alla posizione di riposo e reagisce con una smorfia (spec 13).
   */
  async function runDemo(): Promise<void> {
    if (busy) return;
    busy = true;
    ui.setBusy(true);
    try {
      const move = moves[0];
      const face = reactions.find((e) => e.id === 'RX-01') ?? reactions[0];

      if (move?.clip) {
        ui.setStatus(`Mossa · ${move.name}`);
        await animations.play(move.clip, { crossFade: 0.2, timeScale: move.timeScale });
      }

      ui.setStatus('Ritorno a riposo');
      await toIdle(0.3);
      await wait(900);

      if (face?.clip) {
        ui.setStatus(`Reazione · ${face.name}`);
        await animations.play(face.clip, { crossFade: 0.2, timeScale: face.timeScale });
      }

      ui.setStatus('Sequenza completata');
      await toIdle(0.3);
    } finally {
      busy = false;
      ui.setBusy(false);
    }
  }

  await toIdle(0);
  ui.hideLoader();
  ui.setStatus('In attesa');

  // Contatore fps: serve a decidere il target prestazionale sui dispositivi
  // reali, una delle decisioni ancora aperte (spec 12 punto 3).
  let frames = 0;
  let elapsed = 0;

  renderer.start((dt) => {
    // L'ordine conta: il ripristino evita che gli scostamenti procedurali si
    // accumulino sui bone che la clip corrente non anima (vedi IdleLife).
    life.beforeMixer();
    animations.update(dt);
    life.afterMixer(dt);
    frames += 1;
    elapsed += dt;
    if (elapsed >= 0.5) {
      ui.setFps(Math.round(frames / elapsed));
      frames = 0;
      elapsed = 0;
    }
  });

  // Esposto per ispezione manuale durante lo sviluppo del prototipo.
  Object.assign(window, { sixSeven: { renderer, animations, life } });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void boot();
