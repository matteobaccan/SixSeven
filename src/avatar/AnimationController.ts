/**
 * AnimationController — selezione, riproduzione e transizione delle clip.
 *
 * Unico punto che conosce AnimationMixer. Espone un'API a nomi di clip e
 * promesse di completamento, così la logica di gioco può attendere la fine di
 * una mossa senza dipendere da Three.js (spec 8.2).
 */
import { AnimationMixer, type AnimationAction, type AnimationClip, LoopOnce, LoopRepeat, type Object3D } from 'three';

export type PlaybackOutcome = 'finished' | 'interrupted';

export interface PlayOptions {
  /** Durata del crossfade dalla clip corrente, in secondi. */
  crossFade?: number;
  loop?: boolean;
  /** Velocità di riproduzione: consente durate configurabili per clip. */
  timeScale?: number;
}

interface Pending {
  action: AnimationAction;
  resolve: (outcome: PlaybackOutcome) => void;
}

const DEFAULT_CROSSFADE = 0.25;

export class AnimationController {
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly pending = new Set<Pending>();
  private currentName: string | null = null;

  constructor(root: Object3D, clips: readonly AnimationClip[]) {
    this.mixer = new AnimationMixer(root);
    for (const clip of clips) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener('finished', this.handleFinished);
  }

  /** Nomi delle clip effettivamente presenti nel modello caricato. */
  get clipNames(): string[] {
    return [...this.actions.keys()];
  }

  /**
   * Durata di una clip in secondi, 0 se non è nel modello. La espone per gli
   * script di verifica visiva (`tools/visual/`), che devono campionare una
   * clip a istanti precisi senza tenersi una tabella di durate che invecchia
   * a ogni modifica delle animazioni.
   */
  duration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0;
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  get current(): string | null {
    return this.currentName;
  }

  /**
   * Avvia una clip con crossfade dalla precedente. La promessa si risolve con
   * `finished` a fine clip o con `interrupted` se un'altra clip la sostituisce.
   * Per le clip in loop si risolve appena la transizione è avviata.
   */
  play(name: string, options: PlayOptions = {}): Promise<PlaybackOutcome> {
    const action = this.actions.get(name);
    if (!action) {
      return Promise.reject(new Error(`Clip non presente nel modello: ${name}`));
    }

    const loop = options.loop ?? false;
    const crossFade = options.crossFade ?? DEFAULT_CROSSFADE;
    const previous = this.currentName ? this.actions.get(this.currentName) : undefined;

    // Qualunque attesa in corso viene chiusa come interrotta: nessun chiamante
    // resta appeso quando la logica di gioco cambia idea.
    this.resolveAll('interrupted');

    action.reset();
    action.enabled = true;
    action.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.timeScale = options.timeScale ?? 1;
    action.setEffectiveWeight(1);

    if (previous && previous !== action && crossFade > 0) {
      action.crossFadeFrom(previous, crossFade, false);
    } else if (previous && previous !== action) {
      previous.stop();
    }

    action.play();
    this.currentName = name;

    if (loop) return Promise.resolve<PlaybackOutcome>('finished');
    return new Promise<PlaybackOutcome>((resolve) => {
      this.pending.add({ action, resolve });
    });
  }

  private readonly handleFinished = (event: { action: AnimationAction }): void => {
    for (const entry of [...this.pending]) {
      if (entry.action === event.action) {
        this.pending.delete(entry);
        entry.resolve('finished');
      }
    }
  };

  private resolveAll(outcome: PlaybackOutcome): void {
    for (const entry of [...this.pending]) {
      this.pending.delete(entry);
      entry.resolve(outcome);
    }
  }

  /**
   * Porta una clip a un istante preciso e la mette in pausa.
   * Serve a ispezionare le pose durante l'authoring delle animazioni e a
   * rendere deterministici i controlli visivi automatici.
   */
  seek(name: string, time: number): void {
    const action = this.actions.get(name);
    if (!action) throw new Error(`Clip non presente nel modello: ${name}`);

    this.stopAll();
    action.reset();
    action.enabled = true;
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.play();
    action.paused = true;
    action.time = Math.max(0, Math.min(time, action.getClip().duration));
    this.currentName = name;
    this.mixer.update(0);
  }

  /** Ferma tutto riportando il mixer allo stato iniziale. */
  stopAll(): void {
    this.resolveAll('interrupted');
    this.mixer.stopAllAction();
    this.currentName = null;
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.handleFinished);
    this.stopAll();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
