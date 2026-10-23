/**
 * Avvio e collegamento dei moduli.
 *
 * Questo file non contiene logica di gioco: traduce gli **intenti** della
 * macchina a stati in chiamate ai moduli concreti (animazioni, telecamera,
 * microfono, interfaccia) e le risposte di quei moduli in **eventi** per la
 * macchina. È la cerniera prevista dalla specifica (8.2), e il motivo per cui i
 * turni si possono provare da riga di comando senza browser.
 */
import { AnimationController } from './avatar/AnimationController.ts';
import { AvatarRenderer } from './avatar/AvatarRenderer.ts';
import { AuraHalo } from './avatar/AuraHalo.ts';
import { IdleLife } from './avatar/IdleLife.ts';
import {
  entriesOfKind,
  getEntry,
  IDLE_ID,
  plannedEntries,
  type CatalogEntry,
} from './assets/AssetCatalog.ts';
import { inspectAvatar } from './assets/AvatarContract.ts';
import { applyBoneNaming } from './assets/BoneNaming.ts';
import { assetUrl } from './assets/assetUrl.ts';
import { AURA_MAX, AURA_START, type AuraReason } from './game/Aura.ts';
import { GameStateMachine, type Intent, type TimerToken, type Timers } from './game/GameStateMachine.ts';
import { AudioReactionAnalyzer } from './sensors/AudioReactionAnalyzer.ts';
import { PoseDetector } from './sensors/PoseDetector.ts';
import { UIController } from './ui/UIController.ts';

const AVATAR_URL = assetUrl('assets/avatar.glb');
const FACE_URL = assetUrl('assets/face.png');

/** ID della clip di passaggio del turno, se presente nel modello. */
const TRANSITION_ID = 'RX-06';

/** Come si racconta l'esito di un turno, per livello sonoro misurato. */
const OUTCOME_TEXT = {
  high: 'Reazione forte: gli è piaciuta.',
  medium: 'Qualcosa si è sentito.',
  low: 'Silenzio in sala.',
  unknown: 'Senza microfono non si sa com’è andata.',
} as const;

/** Perché l'aura si è mossa, detto al giocatore in poche parole. */
const AURA_NOTE: Record<AuraReason, string> = {
  inattivo: 'Non hai giocato: aura su.',
  battuto: 'Ha tenuto: aura su.',
  pari: 'Pari.',
  superato: 'L’hai superato: aura giù.',
};

async function boot(): Promise<void> {
  const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Canvas #stage non trovato');

  let playing = false;

  const ui = new UIController({
    onStart: (withSensors) => void startGame(withSensors),
    onPlayerDone: () => machine?.send({ type: 'PLAYER_DONE' }),
    onPause: () => machine?.send({ type: 'PAUSE' }),
    onResume: () => machine?.send({ type: 'RESUME' }),
    onPlay: (entry) => void freePlay(entry),
    onReset: () => renderer.resetOrientation(),
    onRestart: () => {
      ui.hideMatchOver();
      machine?.send({ type: 'RESTART' });
    },
  });

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

  // Riconduce i nomi dei bone a quelli canonici: un rig di terze parti
  // funziona senza modifiche al motore. Va fatto prima di costruire
  // controller e strato procedurale, che cercano i bone per nome.
  const naming = applyBoneNaming(avatar.root, avatar.clips);

  const animations = new AnimationController(avatar.root, avatar.clips);
  const life = new IdleLife(avatar.root);
  const idleEntry = getEntry(IDLE_ID);
  const idleClip = idleEntry.clip;

  const report = inspectAvatar(avatar.root, animations.clipNames);
  ui.renderDiagnostics(report, naming);
  if (report.missingRequiredBones.length > 0) {
    console.warn('Bone richiesti mancanti nel modello:', report.missingRequiredBones.join(', '));
  }

  const moves = entriesOfKind('move', animations.clipNames);
  const allReactions = entriesOfKind('reaction', animations.clipNames);
  const reactions = allReactions.filter((e) => e.id !== IDLE_ID && e.id !== TRANSITION_ID);
  const transition = allReactions.find((e) => e.id === TRANSITION_ID);
  ui.renderCatalog(moves, reactions, plannedEntries(animations.clipNames));

  // --- Riproduzione delle clip -------------------------------------------

  async function toIdle(crossFade = 0.35): Promise<void> {
    if (idleClip && animations.has(idleClip)) {
      await animations.play(idleClip, { loop: true, crossFade });
    }
  }

  /**
   * Riproduce una voce e avvisa la macchina solo se la clip è arrivata in
   * fondo davvero: se un'altra la sostituisce, il turno non deve avanzare.
   */
  async function playEntry(entry: CatalogEntry): Promise<void> {
    if (!entry.clip) return;
    const outcome = await animations.play(entry.clip, {
      loop: entry.loop,
      timeScale: entry.timeScale,
      crossFade: 0.22,
    });
    if (outcome === 'finished' && !entry.loop) machine?.send({ type: 'CLIP_FINISHED' });
  }

  /** Riproduzione libera dal repertorio, fuori partita. */
  async function freePlay(entry: CatalogEntry): Promise<void> {
    if (playing || !entry.clip) return;
    ui.setOutcome(`${entry.id} · ${entry.name}`);
    await animations.play(entry.clip, { loop: entry.loop, crossFade: 0.22 });
    if (!entry.loop) await toIdle();
  }

  // --- Sensori -------------------------------------------------------------

  const halo = new AuraHalo();
  renderer.addBackdrop(halo.object);
  halo.snap(AURA_START / AURA_MAX);

  const pose = new PoseDetector({
    onMovementStarted: () => machine?.send({ type: 'MOVEMENT_STARTED' }),
    onMovementSettled: () => machine?.send({ type: 'MOVEMENT_SETTLED' }),
    onMotion: (value) => {
      ui.setMotion(value);
      // La stessa misura serve a due cose: dire al giocatore "ti vedo" e dare
      // alla macchina l'agitazione su cui si gioca l'aura.
      machine?.send({ type: 'AGITATION', value });
    },
  });
  const audio = new AudioReactionAnalyzer();

  // --- Timer della macchina a stati ---------------------------------------

  // Tutte le attese del gioco passano da qui: non ci sono `setTimeout` sparsi
  // nella logica, come chiede la specifica (5.1).
  const handles = new Map<TimerToken, number>();
  const timers: Timers = {
    set(token, ms) {
      timers.clear(token);
      handles.set(
        token,
        window.setTimeout(() => {
          handles.delete(token);
          machine?.send({ type: 'TIMER', token });
        }, ms),
      );
    },
    clear(token) {
      const handle = handles.get(token);
      if (handle !== undefined) {
        clearTimeout(handle);
        handles.delete(token);
      }
    },
    clearAll() {
      for (const handle of handles.values()) clearTimeout(handle);
      handles.clear();
    },
  };

  let machine: GameStateMachine | null = null;

  function handleIntent(intent: Intent): void {
    switch (intent.kind) {
      case 'play':
        if (intent.entry.kind === 'move') ui.setMove(`${intent.entry.id} · ${intent.entry.name}`);
        void playEntry(intent.entry);
        return;
      case 'idle':
        void toIdle();
        return;
      case 'watch-movement':
        if (intent.on) pose.start();
        else pose.stop();
        ui.showCamera(intent.on && pose.available);
        return;
      case 'sample-audio':
        void audio.sample(intent.ms).then((sample) => {
          machine?.send({ type: 'AUDIO_RESULT', level: sample.level });
        });
        return;
      case 'state':
        ui.setTurn(intent.state, intent.turn);
        return;
      case 'aura':
        halo.setRatio(intent.value / AURA_MAX, intent.delta !== 0);
        ui.setAura(intent.value, AURA_NOTE[intent.reason]);
        return;
      case 'match-over':
        ui.setMove(null);
        ui.showMatchOver(
          intent.winner === 'player' ? 'Hai vinto!' : 'Vince l’avatar',
          intent.winner === 'player'
            ? `Aura azzerata in ${intent.turns} turni: l’avatar non ha più niente da mostrare.`
            : `Aura al massimo dopo ${intent.turns} turni: senza qualcuno che ribatta, se la gode.`,
        );
        return;
      case 'outcome':
        ui.setOutcome(
          intent.moved === false && pose.available
            ? 'Non ti ho visto muovere.'
            : `${intent.reaction.name} — ${OUTCOME_TEXT[intent.level]}`,
        );
        return;
    }
  }

  async function startGame(withSensors: boolean): Promise<void> {
    if (playing) return;

    let camera = false;
    let microphone = false;
    if (withSensors) {
      ui.setStartNote('Richiesta dei permessi in corso…');
      [camera, microphone] = await Promise.all([pose.request(), audio.request()]);
      if (camera) ui.attachCamera(pose.videoElement);
      if (!camera && !microphone) {
        ui.setStartNote(
          'Niente telecamera né microfono: si gioca lo stesso, i turni passano a tempo.',
        );
      } else if (!camera) {
        ui.setStartNote('Senza telecamera: i turni passano a tempo.');
      } else if (!microphone) {
        ui.setStartNote('Senza microfono: le reazioni non dipenderanno dal rumore.');
      }
    }

    playing = true;
    ui.setFreePlayEnabled(false);
    ui.hideStart();

    machine = new GameStateMachine({
      moves,
      reactions,
      idle: idleEntry,
      ...(transition ? { transition } : {}),
      timers,
    });
    machine.onIntent(handleIntent);
    // L'aura si mostra già al via: comparire solo dopo il primo turno
    // farebbe sembrare che il punteggio nasca dal nulla.
    ui.setAura(machine.auraValue);
    halo.snap(machine.auraValue / AURA_MAX);
    machine.send({ type: 'SENSORS', camera, microphone });
    machine.send({ type: 'ASSETS_READY' });
  }

  // --- Avvio ----------------------------------------------------------------

  await toIdle(0);
  ui.showStart();

  let frames = 0;
  let elapsed = 0;

  renderer.start((dt) => {
    // L'ordine conta: il ripristino evita che gli scostamenti procedurali si
    // accumulino sui bone che la clip corrente non anima (vedi IdleLife).
    life.beforeMixer();
    animations.update(dt);
    life.afterMixer(dt);
    // Il rumore di fondo si insegue sempre, così al momento del campionamento
    // il riferimento è già pronto (spec 7.2).
    audio.track(dt);
    halo.update(dt);

    frames += 1;
    elapsed += dt;
    if (elapsed >= 0.5) {
      ui.setFps(Math.round(frames / elapsed));
      frames = 0;
      elapsed = 0;
    }
  });

  window.addEventListener('pagehide', () => {
    pose.dispose();
    audio.dispose();
  });

  // Esposto per ispezione manuale e per i controlli automatici.
  Object.assign(window, {
    sixSeven: {
      renderer,
      animations,
      life,
      pose,
      audio,
      halo,
      ui,
      // La ripartizione del catalogo serve agli script di verifica visiva,
      // che devono poter rendere le sole mosse senza tenersene una copia.
      catalog: { moves, reactions },
      get machine() {
        return machine;
      },
    },
  });
}

void boot();
