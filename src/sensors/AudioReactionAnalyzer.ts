/**
 * AudioReactionAnalyzer — misura l'intensità della reazione sonora (spec 7).
 *
 * Non capisce le parole e non le trascrive: legge il segnale con un
 * `AnalyserNode` e ne ricava RMS e picco, confrontati con il rumore di fondo
 * stimato in continuo. Da quel confronto esce una classe LOW / MEDIUM / HIGH.
 *
 * Limite dichiarato nella specifica stessa (7.3): un livello alto non dimostra
 * che la mossa sia piaciuta. Il rumore può venire da una conversazione, dalla
 * televisione o da un'auto che passa. Il modulo parla quindi di *intensità
 * della reazione*, mai di gradimento, e i nomi dei tipi lo rispecchiano.
 *
 * Privacy (spec 7.4): l'audio non viene registrato né inviato da nessuna parte.
 * Di ogni finestra restano solo tre numeri — RMS, picco e fondo — che vengono
 * sovrascritti al campione successivo.
 */
import type { ReactionLevel } from '../game/GameStateMachine.ts';

export interface AudioSample {
  level: ReactionLevel;
  /** Valore efficace medio nella finestra, 0..1. */
  rms: number;
  /** Picco di ampiezza nella finestra, 0..1. */
  peak: number;
  /** Rumore di fondo stimato al momento del campionamento. */
  floor: number;
  /** Quanto il segnale ha superato il fondo, in dB. */
  aboveFloorDb: number;
}

export interface AudioOptions {
  /** Guadagno sopra il fondo, in dB, per entrare in MEDIUM. */
  mediumDb?: number;
  /** Guadagno sopra il fondo, in dB, per entrare in HIGH. */
  highDb?: number;
  /** Costante di inseguimento del fondo quando il livello scende. */
  floorFallPerSecond?: number;
  /** Costante di inseguimento del fondo quando il livello sale. */
  floorRisePerSecond?: number;
}

const DEFAULTS = {
  // Soglie di partenza, da validare in ambienti reali (spec 7.3): 6 dB è un
  // raddoppio percepito, 14 dB una reazione che copre il parlato.
  mediumDb: 6,
  highDb: 14,
  floorFallPerSecond: 3,
  floorRisePerSecond: 0.25,
} as const;

const SILENCE = 1e-4;

export class AudioReactionAnalyzer {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private buffer: Float32Array = new Float32Array(0);
  private floorValue = SILENCE;
  private tracking = 0;

  private readonly options: Required<AudioOptions>;

  constructor(options: AudioOptions = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  get available(): boolean {
    return this.analyser !== null;
  }

  /** Rumore di fondo stimato, per mostrarlo a schermo durante la taratura. */
  get floor(): number {
    return this.floorValue;
  }

  /**
   * Chiede il microfono. Come per la telecamera, un rifiuto non è un errore:
   * restituisce `false` e la partita prosegue senza audio.
   */
  async request(): Promise<boolean> {
    if (this.analyser) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      const AudioCtor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return false;
      this.context = new AudioCtor();
      const source = this.context.createMediaStreamSource(this.stream);
      const analyser = this.context.createAnalyser();
      // Finestra corta: serve l'inviluppo, non lo spettro.
      analyser.fftSize = 1024;
      source.connect(analyser);
      this.analyser = analyser;
      this.buffer = new Float32Array(analyser.fftSize);
      return true;
    } catch {
      this.dispose();
      return false;
    }
  }

  /**
   * La stima del fondo insegue in fretta verso il basso e molto piano verso
   * l'alto: così un ambiente che si zittisce viene seguito subito, mentre un
   * applauso lungo non finisce per essere scambiato per rumore di fondo.
   */
  private updateFloor(rms: number, dt: number): void {
    if (rms < this.floorValue) {
      const k = Math.min(1, this.options.floorFallPerSecond * dt);
      this.floorValue += (rms - this.floorValue) * k;
    } else {
      const k = Math.min(1, this.options.floorRisePerSecond * dt);
      this.floorValue += (rms - this.floorValue) * k;
    }
    this.floorValue = Math.max(SILENCE, this.floorValue);
  }

  /** Valore efficace istantaneo del segnale. */
  private readRms(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    return Math.sqrt(sum / this.buffer.length);
  }

  /** Tiene aggiornata la stima del fondo mentre non si sta campionando. */
  track(dt: number): void {
    if (!this.analyser) return;
    this.tracking += dt;
    if (this.tracking < 0.05) return;
    this.updateFloor(this.readRms(), this.tracking);
    this.tracking = 0;
  }

  /**
   * Campiona per `ms` e classifica. Durante il campionamento il fondo non viene
   * aggiornato: altrimenti la reazione stessa lo alzerebbe, annullandosi.
   */
  async sample(ms: number): Promise<AudioSample> {
    const floor = this.floorValue;
    if (!this.analyser) {
      return { level: 'unknown', rms: 0, peak: 0, floor, aboveFloorDb: 0 };
    }

    await this.context?.resume().catch(() => undefined);

    let sum = 0;
    let count = 0;
    let peak = 0;
    const until = performance.now() + ms;

    await new Promise<void>((resolve) => {
      const step = (): void => {
        const rms = this.readRms();
        sum += rms;
        count += 1;
        for (let i = 0; i < this.buffer.length; i++) {
          peak = Math.max(peak, Math.abs(this.buffer[i]));
        }
        if (performance.now() >= until) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });

    const rms = count > 0 ? sum / count : 0;
    const aboveFloorDb = 20 * Math.log10(Math.max(rms, SILENCE) / Math.max(floor, SILENCE));

    let level: ReactionLevel = 'low';
    if (aboveFloorDb >= this.options.highDb) level = 'high';
    else if (aboveFloorDb >= this.options.mediumDb) level = 'medium';

    return { level, rms, peak, floor, aboveFloorDb };
  }

  dispose(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    void this.context?.close().catch(() => undefined);
    this.context = null;
  }
}
