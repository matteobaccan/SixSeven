/**
 * AuraHalo — l'aura disegnata dietro all'avatar.
 *
 * È un piano che sta dietro al personaggio, con sopra una texture generata a
 * runtime: un nucleo sfumato più una corona di raggi. Un piano e una texture
 * invece di geometria vera perché l'aura deve stare *dietro*, dove il volume
 * non si legge comunque, e perché così costa un disegno solo.
 *
 * Due accorgimenti non ovvi:
 *  - il piano è escluso dal passaggio dei contorni (`addBackdrop`): l'aura è
 *    una macchia di luce, e un contorno disegnato attorno la farebbe sembrare
 *    un adesivo;
 *  - il materiale non scrive nel buffer di profondità, altrimenti i raggi
 *    ritaglierebbero l'avatar che hanno davanti.
 *
 * Il colore racconta la situazione da solo: freddo e pallido quando l'aura sta
 * finendo, verde a metà, oro quando l'avatar domina.
 */
import {
  CanvasTexture,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from 'three';

/** Raggi della corona: dispari, così non si legge come una stella simmetrica. */
const RAYS = 13;

/** Colore dell'aura per livello: da spenta a dominante. */
const COLD = new Color(0x8fb0cc);
const MID = new Color(0x7fae5a);
const HOT = new Color(0xf0a830);

function auraTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile per l’aura');

  const c = size / 2;

  // Nucleo: sfumatura radiale che si spegne prima del bordo, così il piano
  // non mostra mai i propri lati.
  const core = ctx.createRadialGradient(c, c, size * 0.06, c, c, size * 0.42);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // Corona di raggi, disegnati come spicchi che sfumano verso la punta.
  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < RAYS; i++) {
    const angle = (i / RAYS) * Math.PI * 2;
    // Lunghezza alternata: una corona tutta uguale sembra un ingranaggio.
    const length = size * (i % 2 === 0 ? 0.47 : 0.38);
    const half = (Math.PI / RAYS) * 0.38;
    const ray = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
    ray.addColorStop(0, 'rgba(255,255,255,0.55)');
    ray.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle - half) * length, Math.sin(angle - half) * length);
    ctx.lineTo(Math.cos(angle + half) * length, Math.sin(angle + half) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = 'srgb';
  return texture;
}

export class AuraHalo {
  readonly object: Mesh;

  private readonly material: MeshBasicMaterial;
  private readonly texture: CanvasTexture;

  /** Livello richiesto e livello mostrato: il secondo insegue il primo. */
  private target = 0;
  private shown = 0;
  private spin = 0;
  private pulse = 0;
  /** Lampo dopo un cambiamento, per rendere visibile il turno appena giocato. */
  private flash = 0;

  constructor(options: { y?: number; z?: number; size?: number } = {}) {
    this.texture = auraTexture();
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      // Fusione normale, non additiva: il fondo della scena è crema, e
      // sommare luce su un fondo già chiaro satura verso il bianco — l'aura
      // sparirebbe. Qui il colore copre, ed è l'alfa della texture a tenerla
      // morbida ai bordi.
      toneMapped: false,
      opacity: 0,
    });

    const size = options.size ?? 2.8;
    this.object = new Mesh(new PlaneGeometry(size, size), this.material);
    this.object.position.set(0, options.y ?? 1.46, options.z ?? -0.45);
    this.object.renderOrder = -1;
    this.object.frustumCulled = false;
  }

  /** Livello da mostrare, da 0 a 1. `jolt` accende il lampo del turno. */
  setRatio(ratio: number, jolt = false): void {
    this.target = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio;
    if (jolt) this.flash = 1;
  }

  /** Porta subito il livello mostrato su quello richiesto, senza transizione. */
  snap(ratio: number): void {
    this.setRatio(ratio);
    this.shown = this.target;
  }

  update(dt: number): void {
    // Inseguimento esponenziale: l'aura cambia in fretta ma mai di scatto.
    this.shown += (this.target - this.shown) * Math.min(1, dt * 3.2);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.spin += dt * 0.22;
    this.pulse += dt * 1.9;

    const breath = 1 + Math.sin(this.pulse) * 0.035;
    // Anche a zero resta un alone minimo: sparire del tutto farebbe sembrare
    // rotto il gioco invece di raccontare che l'avatar è alle corde.
    const scale = (0.45 + this.shown * 0.75) * breath * (1 + this.flash * 0.12);

    this.object.scale.setScalar(scale);
    this.object.rotation.z = this.spin;
    this.material.opacity = (0.22 + this.shown * 0.62) * (1 + this.flash * 0.5);

    const color = this.material.color;
    if (this.shown < 0.5) color.copy(COLD).lerp(MID, this.shown * 2);
    else color.copy(MID).lerp(HOT, (this.shown - 0.5) * 2);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
