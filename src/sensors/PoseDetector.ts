/**
 * PoseDetector — stima quando il giocatore ha finito la propria mossa.
 *
 * La specifica (6.1) chiede di rilevare che il giocatore si è mosso e poi è
 * rimasto relativamente fermo, non di riconoscere il gesto. Qui il movimento si
 * misura confrontando fotogrammi consecutivi del flusso video, ridotti a una
 * griglia minuscola: niente modelli da scaricare, niente CDN, funziona offline
 * e costa pochi microsecondi per fotogramma.
 *
 * La scelta è deliberata e reversibile. Un rilevatore a landmark (MediaPipe
 * Pose) darebbe in più la posizione delle mani e quindi, in futuro, il
 * riconoscimento del gesto; ma scarica alcuni megabyte, richiede la rete al
 * primo avvio e non serve per ciò che la Fase 3 deve dimostrare. L'interfaccia
 * di questo modulo — `onMovementStarted`, `onMovementSettled`, `motion` — non
 * cambia se un giorno lo si sostituisce.
 *
 * Privacy (spec 6.3): il flusso resta nella pagina. Non viene registrato, non
 * esce dal dispositivo, e di ogni fotogramma si conserva solo una griglia di
 * 48x36 valori di luminosità, sovrascritta a ogni giro.
 */

export interface PoseDetectorOptions {
  /** Quante volte il livello di quiete per dichiarare iniziato il gesto. */
  startFactor?: number;
  /** Quante volte il livello di quiete si considera ancora "fermo". */
  stillFactor?: number;
  /** Soglia minima assoluta d'inizio: protegge da una quiete misurata a zero. */
  minStart?: number;
  /** Soglia minima assoluta di immobilità. */
  minStill?: number;
  /** Campioni di taratura raccolti all'inizio di ogni turno. */
  calibrationFrames?: number;
  /** Quanto deve durare l'immobilità per dichiarare finito il gesto. */
  stillnessMs?: number;
  /** Fotogrammi consecutivi sopra soglia prima di dichiarare l'inizio. */
  startFrames?: number;
  /** Frequenza di analisi: sotto quella del rendering, per non rubargli tempo. */
  sampleHz?: number;
}

export interface PoseDetectorCallbacks {
  onMovementStarted?: () => void;
  onMovementSettled?: () => void;
  /** Valore di movimento normalizzato, per il riscontro a schermo. */
  onMotion?: (motion: number) => void;
}

const DEFAULTS = {
  // Le soglie non sono assolute ma multipli del livello di quiete misurato
  // all'inizio di ogni turno: una soglia fissa dipenderebbe da illuminazione,
  // rumore del sensore, risoluzione e distanza dalla telecamera, cioè
  // esattamente le variabili che la specifica (6.2) segnala come incognite. I
  // minimi assoluti servono solo a non impazzire se la quiete misura zero.
  startFactor: 3.2,
  stillFactor: 1.8,
  minStart: 0.012,
  minStill: 0.005,
  stillnessMs: 900,
  startFrames: 2,
  calibrationFrames: 9,
  sampleHz: 20,
} as const;

/** Risoluzione della griglia di analisi: basta a vedere un braccio che si alza. */
const GRID_WIDTH = 48;
const GRID_HEIGHT = 36;

export class PoseDetector {
  /** Ultimo valore di movimento misurato (0 = fermo). */
  motion = 0;

  private stream: MediaStream | null = null;
  private readonly video = document.createElement('video');
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private previous: Uint8ClampedArray | null = null;

  private timer: number | null = null;
  private watching = false;
  private started = false;
  private aboveCount = 0;
  private stillSince = 0;
  private calibration: number[] = [];
  private quiet = 0;

  private readonly options: Required<PoseDetectorOptions>;

  constructor(
    private readonly callbacks: PoseDetectorCallbacks = {},
    options: PoseDetectorOptions = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
    this.canvas.width = GRID_WIDTH;
    this.canvas.height = GRID_HEIGHT;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D non disponibile per il rilevamento del movimento');
    this.ctx = ctx;

    this.video.muted = true;
    this.video.playsInline = true;
  }

  get available(): boolean {
    return this.stream !== null;
  }

  /**
   * Chiede la telecamera. Non lancia se il permesso viene negato: restituisce
   * `false` e il gioco prosegue senza (spec 2.1 punto 9).
   */
  async request(): Promise<boolean> {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch {
      this.stream = null;
      return false;
    }
  }

  /** Il flusso video, per mostrare l'anteprima al giocatore. */
  get videoElement(): HTMLVideoElement {
    return this.video;
  }

  /** Livello di quiete misurato nel turno corrente (0 finché non è tarato). */
  get quietLevel(): number {
    return this.quiet;
  }

  /** Soglie in vigore, derivate dalla quiete: utili a schermo in taratura. */
  get thresholds(): { start: number; still: number } {
    return {
      start: Math.max(this.options.minStart, this.quiet * this.options.startFactor),
      still: Math.max(this.options.minStill, this.quiet * this.options.stillFactor),
    };
  }

  /** Comincia a osservare: azzera lo storico, così il turno parte pulito. */
  start(): void {
    if (!this.stream || this.watching) return;
    this.watching = true;
    this.started = false;
    this.aboveCount = 0;
    this.stillSince = 0;
    this.calibration = [];
    this.quiet = 0;
    this.previous = null;
    this.timer = window.setInterval(() => this.sample(), 1000 / this.options.sampleHz);
  }

  stop(): void {
    this.watching = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.motion = 0;
  }

  private sample(): void {
    if (!this.watching || this.video.readyState < 2) return;

    this.ctx.drawImage(this.video, 0, 0, GRID_WIDTH, GRID_HEIGHT);
    const frame = this.ctx.getImageData(0, 0, GRID_WIDTH, GRID_HEIGHT).data;

    if (this.previous) {
      let total = 0;
      // Solo la luminanza approssimata: il colore non aggiunge nulla e la
      // differenza su tre canali costerebbe il triplo.
      for (let i = 0; i < frame.length; i += 4) {
        const now = (frame[i] + frame[i + 1] * 2 + frame[i + 2]) >> 2;
        const before = (this.previous[i] + this.previous[i + 1] * 2 + this.previous[i + 2]) >> 2;
        total += Math.abs(now - before);
      }
      this.motion = total / (GRID_WIDTH * GRID_HEIGHT * 255);
      this.callbacks.onMotion?.(this.motion);
      this.evaluate();
    }

    this.previous = frame.slice();
  }

  private evaluate(): void {
    const now = performance.now();

    // Taratura: i primi campioni del turno misurano la quiete. È il momento in
    // cui il giocatore sta ancora guardando l'avatar, quindi fermo.
    if (this.calibration.length < this.options.calibrationFrames) {
      this.calibration.push(this.motion);
      if (this.calibration.length === this.options.calibrationFrames) {
        // Mediana, non media: un singolo sbalzo non deve alzare il riferimento.
        const sorted = [...this.calibration].sort((a, b) => a - b);
        this.quiet = sorted[sorted.length >> 1];
      }
      return;
    }

    const { start, still } = this.thresholds;

    if (!this.started) {
      // Più fotogrammi di fila sopra soglia: un singolo sbalzo di luce o il
      // rumore del sensore non devono valere come inizio del gesto.
      this.aboveCount = this.motion >= start ? this.aboveCount + 1 : 0;
      if (this.aboveCount >= this.options.startFrames) {
        this.started = true;
        this.stillSince = 0;
        this.callbacks.onMovementStarted?.();
      }
      return;
    }

    if (this.motion <= still) {
      if (this.stillSince === 0) this.stillSince = now;
      if (now - this.stillSince >= this.options.stillnessMs) {
        this.stop();
        this.callbacks.onMovementSettled?.();
      }
    } else {
      this.stillSince = 0;
    }
  }

  /** Chiude il flusso: la spia della telecamera deve spegnersi. */
  dispose(): void {
    this.stop();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
