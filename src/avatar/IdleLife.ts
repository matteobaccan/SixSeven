/**
 * IdleLife — strato di micro-movimenti continui sopra le clip.
 *
 * Le clip raccontano le mosse; questo strato racconta che il personaggio è
 * vivo anche quando non fa niente: battito di palpebre, piccole saccadi
 * oculari, respiro, deriva della testa che segue lo sguardo. Senza, l'avatar
 * sembra una forma ferma tra un'animazione e l'altra.
 *
 * È volutamente procedurale e non inserito nelle clip: così vale per *tutte*
 * le animazioni, comprese quelle che verranno aggiunte in seguito, e non
 * costringe a rifare gli asset per cambiarne il carattere.
 *
 * Uso nel ciclo di rendering, nell'ordine:
 *
 *   life.beforeMixer();     // riporta i bone al valore prodotto dalle clip
 *   animations.update(dt);  // il mixer riscrive ciò che anima
 *   life.afterMixer(dt);    // somma gli scostamenti di questo frame
 *
 * La sequenza serve perché il mixer riscrive solo i bone presenti nella clip
 * corrente: senza il ripristino iniziale gli scostamenti si accumulerebbero
 * sui bone non animati, come le palpebre.
 */
import { Euler, MathUtils, type Object3D, Quaternion } from 'three';

interface Controlled {
  bone: Object3D;
  /** Rotazione prodotta dalle clip, prima degli scostamenti. */
  base: Quaternion;
}

export interface IdleLifeOptions {
  /** Scala globale dell'effetto: 0 lo disattiva, 1 è il valore di taratura. */
  intensity?: number;
}

const BLINK_DURATION = 0.16;
const BLINK_CLOSED_ANGLE = 52;

export class IdleLife {
  private active = true;

  private readonly controlled: Controlled[] = [];
  private readonly byName = new Map<string, Controlled>();
  private readonly intensity: number;

  private time = 0;

  private blinkCountdown = 1.5;
  private blinkElapsed = -1;
  private blinkAmount = 0;

  private gazeYaw = 0;
  private gazePitch = 0;
  private gazeTargetYaw = 0;
  private gazeTargetPitch = 0;
  private gazeCountdown = 1;

  private headYaw = 0;
  private headPitch = 0;

  private readonly euler = new Euler();
  private readonly offset = new Quaternion();

  constructor(root: Object3D, options: IdleLifeOptions = {}) {
    this.intensity = options.intensity ?? 1;

    const wanted = ['Head', 'Neck', 'Chest', 'Eye_L', 'Eye_R', 'Lid_L', 'Lid_R', 'Brow_L', 'Brow_R'];
    root.traverse((child) => {
      if (wanted.includes(child.name) && !this.byName.has(child.name)) {
        const entry: Controlled = { bone: child, base: child.quaternion.clone() };
        this.controlled.push(entry);
        this.byName.set(child.name, entry);
      }
    });
  }

  get enabled(): boolean {
    return this.active;
  }

  /**
   * Disattivandolo lo strato smette di governare i bone, che restano a
   * disposizione di chi voglia posarli a mano (strumenti di authoring, test).
   * Riattivandolo riparte dalla posa corrente, senza scatti.
   */
  set enabled(value: boolean) {
    if (value && !this.active) {
      for (const entry of this.controlled) entry.base.copy(entry.bone.quaternion);
    }
    this.active = value;
  }

  /** Riporta i bone controllati al valore prodotto dalle clip. */
  beforeMixer(): void {
    if (!this.active) return;
    for (const entry of this.controlled) entry.bone.quaternion.copy(entry.base);
  }

  afterMixer(dt: number): void {
    if (!this.active || this.intensity <= 0) return;
    for (const entry of this.controlled) entry.base.copy(entry.bone.quaternion);

    this.time += dt;
    this.updateBlink(dt);
    this.updateGaze(dt);

    const k = this.intensity;

    // Deriva della testa: due sinusoidi con periodi non multipli, così il
    // movimento non si ripete in modo percepibile.
    const driftYaw = Math.sin(this.time * 0.37) * 0.62 + Math.sin(this.time * 0.91 + 1.3) * 0.28;
    const driftPitch = Math.sin(this.time * 0.53 + 0.7) * 0.4 + Math.sin(this.time * 1.17) * 0.18;

    // La testa insegue lo sguardo con ritardo: è ciò che lega occhi e collo.
    this.headYaw = MathUtils.damp(this.headYaw, this.gazeYaw * 0.3, 3, dt);
    this.headPitch = MathUtils.damp(this.headPitch, this.gazePitch * 0.25, 3, dt);

    this.add('Head', (driftPitch + this.headPitch) * k, (driftYaw + this.headYaw) * k, 0);
    this.add('Neck', driftPitch * 0.4 * k, driftYaw * 0.35 * k, 0);

    // Respiro: ampiezza minima, periodo lento.
    const breath = Math.sin(this.time * 1.65) * 0.42 * k;
    this.add('Chest', breath, 0, 0);

    for (const name of ['Eye_L', 'Eye_R'] as const) {
      this.add(name, this.gazePitch * k, this.gazeYaw * k, 0);
    }
    for (const name of ['Lid_L', 'Lid_R'] as const) {
      this.add(name, this.blinkAmount * BLINK_CLOSED_ANGLE, 0, 0);
    }
    // Le sopracciglia accompagnano appena il battito di ciglia.
    for (const name of ['Brow_L', 'Brow_R'] as const) {
      this.add(name, this.blinkAmount * 3.5 * k, 0, 0);
    }
  }

  private updateBlink(dt: number): void {
    if (this.blinkElapsed >= 0) {
      this.blinkElapsed += dt;
      const u = this.blinkElapsed / BLINK_DURATION;
      if (u >= 1) {
        this.blinkElapsed = -1;
        this.blinkAmount = 0;
        this.scheduleBlink();
      } else {
        // Chiusura più rapida dell'apertura, come nel battito reale.
        this.blinkAmount = u < 0.4 ? u / 0.4 : 1 - (u - 0.4) / 0.6;
      }
      return;
    }

    this.blinkCountdown -= dt;
    if (this.blinkCountdown <= 0) this.blinkElapsed = 0;
  }

  private scheduleBlink(): void {
    // Una volta su cinque il battito è doppio.
    this.blinkCountdown = Math.random() < 0.2 ? 0.16 : 2.2 + Math.random() * 3.8;
  }

  private updateGaze(dt: number): void {
    this.gazeCountdown -= dt;
    if (this.gazeCountdown <= 0) {
      this.gazeTargetYaw = (Math.random() * 2 - 1) * 7;
      this.gazeTargetPitch = (Math.random() * 2 - 1) * 4;
      this.gazeCountdown = 0.8 + Math.random() * 2.2;
    }
    // Le saccadi sono spostamenti rapidi: avvicinamento veloce, poi fermo.
    this.gazeYaw = MathUtils.damp(this.gazeYaw, this.gazeTargetYaw, 14, dt);
    this.gazePitch = MathUtils.damp(this.gazePitch, this.gazeTargetPitch, 14, dt);
  }

  private add(name: string, xDeg: number, yDeg: number, zDeg: number): void {
    const entry = this.byName.get(name);
    if (!entry) return;
    this.euler.set(
      MathUtils.degToRad(xDeg),
      MathUtils.degToRad(yDeg),
      MathUtils.degToRad(zDeg),
      'XYZ',
    );
    entry.bone.quaternion.multiply(this.offset.setFromEuler(this.euler));
  }
}
