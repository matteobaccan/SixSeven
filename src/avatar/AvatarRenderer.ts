/**
 * AvatarRenderer — scena Three.js, caricamento del GLB e resa dell'avatar.
 *
 * Responsabilità: scena, luci, camera, stile grafico, loop di rendering.
 * Non conosce né i turni di gioco né il catalogo delle mosse: espone le clip
 * trovate nel file e lascia la regia a chi lo usa.
 *
 * Lo stile è deliberatamente tutto qui e non nel GLB: il modello conserva solo
 * i colori base, così si può cambiare resa (toon, linee, palette) senza
 * rigenerare l'avatar.
 */
import {
  AmbientLight,
  type AnimationClip,
  Box3,
  CanvasTexture,
  Clock,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  MeshToonMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  NearestFilter,
  CircleGeometry,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ToonLinePass } from './ToonLinePass.ts';

export interface LoadedAvatar {
  root: Object3D;
  clips: AnimationClip[];
  skinned: SkinnedMesh[];
}

/**
 * Nome del materiale che riceve la texture della caricatura. Il viso non è
 * modellato: è il disegno originale applicato a una superficie curva.
 */
const FACE_MATERIAL = 'face';

export interface RendererOptions {
  /** Limite del devicePixelRatio: abbassarlo riduce il costo per frame. */
  maxPixelRatio?: number;
  /** Spessore delle linee di contorno in pixel; 0 le disattiva. */
  lineWidth?: number;
  /** Consente di ruotare l'avatar trascinando: utile in fase di prototipo. */
  enableInspect?: boolean;
  /** Texture del viso; se assente il materiale `face` resta bianco. */
  faceTextureUrl?: string;
}

/**
 * Rampa a gradini per la resa toon. Pochi livelli molto vicini tra loro: il
 * riferimento grafico è un disegno a colore piatto, dove l'ombra è appena più
 * scura della luce e il volume lo raccontano le linee, non lo sfumato.
 */
function toonGradient(): CanvasTexture {
  const steps = [198, 229, 255];
  const canvas = document.createElement('canvas');
  canvas.width = steps.length;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile per la rampa toon');
  const image = ctx.createImageData(steps.length, 1);
  steps.forEach((v, i) => {
    image.data.set([v, v, v, 255], i * 4);
  });
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class AvatarRenderer {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly clock = new Clock();
  private readonly gradient = toonGradient();
  private readonly options: Required<RendererOptions>;
  private readonly pivot = new Group();
  private readonly lines: ToonLinePass;

  private frameHandle = 0;
  private onFrame: ((dt: number) => void) | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private detachInspect: (() => void) | null = null;
  private faceTexture: Texture | null = null;
  /** Soggetto inquadrato: serve a rifare l'inquadratura a ogni resize. */
  private subject: Object3D | null = null;

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    this.options = {
      maxPixelRatio: options.maxPixelRatio ?? 2,
      lineWidth: options.lineWidth ?? 1.15,
      enableInspect: options.enableInspect ?? true,
      faceTextureUrl: options.faceTextureUrl ?? '',
    };

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.scene.background = new Color(0xf6f1e7);

    this.camera = new PerspectiveCamera(32, 1, 0.1, 50);
    this.camera.position.set(0, 1.42, 2.35);
    this.camera.lookAt(0, 1.3, 0);

    this.lines = new ToonLinePass(this.renderer, { lineWidth: this.options.lineWidth });

    this.scene.add(this.pivot);
    this.setupLights();
    this.setupContactShadow();
    this.handleResize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', this.handleResize);
    }

    if (this.options.enableInspect) this.setupInspect();
  }

  /**
   * Una sola luce direzionale forte più ambiente: con il colore piatto, più
   * luci producono solo macchie di penombra che sporcano il disegno.
   */
  private setupLights(): void {
    const key = new DirectionalLight(0xfff8ee, 1.65);
    key.position.set(1.6, 2.3, 2.2);
    this.scene.add(key);
    this.scene.add(new AmbientLight(0xffffff, 1.5));
  }

  /** Ombra di contatto finta: molto più economica di una shadow map su mobile. */
  private setupContactShadow(): void {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(60,52,40,0.42)');
    gradient.addColorStop(0.6, 'rgba(60,52,40,0.14)');
    gradient.addColorStop(1, 'rgba(60,52,40,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const shadow = new Mesh(
      new CircleGeometry(0.44, 32),
      new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.scale.set(1, 0.72, 1);
    this.scene.add(shadow);
    // L'ombra non deve generare un contorno disegnato.
    this.lines.exclude(shadow);
  }

  /** Rotazione dell'avatar al trascinamento (solo per ispezione del modello). */
  private setupInspect(): void {
    let dragging = false;
    let lastX = 0;

    const down = (e: PointerEvent): void => {
      dragging = true;
      lastX = e.clientX;
      this.canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent): void => {
      if (!dragging) return;
      this.pivot.rotation.y += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const up = (e: PointerEvent): void => {
      dragging = false;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    };

    this.canvas.addEventListener('pointerdown', down);
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);

    this.detachInspect = () => {
      this.canvas.removeEventListener('pointerdown', down);
      this.canvas.removeEventListener('pointermove', move);
      this.canvas.removeEventListener('pointerup', up);
      this.canvas.removeEventListener('pointercancel', up);
    };
  }

  /** Riporta l'avatar all'orientamento frontale. */
  /**
   * Aggiunge un oggetto di sfondo: entra in scena ma resta fuori dai contorni.
   * Serve per l'aura, che è una macchia di luce: un contorno disegnato attorno
   * la farebbe sembrare un adesivo appiccicato dietro al personaggio.
   */
  addBackdrop(object: Object3D): void {
    this.scene.add(object);
    this.lines.exclude(object);
  }

  resetOrientation(): void {
    this.pivot.rotation.y = 0;
  }

  /** Spessore del tratto; 0 disattiva il passaggio delle linee. */
  setLineWidth(width: number): void {
    this.lines.setLineWidth(width);
  }

  async load(url: string, onProgress?: (ratio: number) => void): Promise<LoadedAvatar> {
    const [gltf, faceTexture] = await Promise.all([
      new GLTFLoader().loadAsync(url, (event) => {
        if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
      }),
      this.options.faceTextureUrl
        ? new TextureLoader().loadAsync(this.options.faceTextureUrl)
        : Promise.resolve(null),
    ]);

    if (faceTexture) {
      faceTexture.colorSpace = SRGBColorSpace;
      faceTexture.anisotropy = 4;
      this.faceTexture = faceTexture;
    }

    const root = gltf.scene;
    const skinned: SkinnedMesh[] = [];
    root.traverse((child) => {
      if ((child as SkinnedMesh).isSkinnedMesh) skinned.push(child as SkinnedMesh);
    });
    if (skinned.length === 0) {
      throw new Error('Il GLB non contiene alcuna mesh riggata (SkinnedMesh)');
    }

    this.applyToonStyle(skinned);
    this.pivot.add(root);
    this.subject = root;
    this.frameSubject(root);

    return { root, clips: gltf.animations, skinned };
  }

  /**
   * Converte i materiali del GLB in resa toon mantenendone i colori base.
   *
   * Il viso fa eccezione: riceve la texture della caricatura ed è reso *non
   * illuminato*, perché luci e ombre sono già dipinte nel disegno. Illuminarlo
   * lo sporcherebbe con un secondo chiaroscuro.
   */
  private applyToonStyle(meshes: SkinnedMesh[]): void {
    for (const mesh of meshes) {
      const wasArray = Array.isArray(mesh.material);
      const source = wasArray
        ? (mesh.material as MeshStandardMaterial[])
        : [mesh.material as MeshStandardMaterial];
      let isFace = false;
      const converted = source.map((std): MeshToonMaterial | MeshBasicMaterial => {
        if (std.name === FACE_MATERIAL && this.faceTexture) {
          isFace = true;
          const face = new MeshBasicMaterial({
            map: this.faceTexture,
            alphaTest: 0.5,
            toneMapped: false,
          });
          face.name = std.name;
          return face;
        }
        const toon = new MeshToonMaterial({
          color: std.color ? std.color.clone() : new Color(0xffffff),
          gradientMap: this.gradient,
        });
        toon.name = std.name;
        return toon;
      });
      // Un materiale singolo deve restare singolo: con un array e una geometria
      // priva di gruppi, Three.js non disegnerebbe nulla.
      mesh.material = wasArray ? converted : converted[0];
      mesh.frustumCulled = false;
      // Il disegno porta già i propri contorni: al viso serve solo la
      // profondità, altrimenti il filtro dei bordi ci disegna sopra.
      if (isFace && this.faceTexture) this.lines.depthOnly(mesh, this.faceTexture);
    }
  }

  /** Inquadra il soggetto: mezzo busto in verticale, figura più ampia in orizzontale. */
  private frameSubject(root: Object3D): void {
    const box = new Box3().setFromObject(root);
    const size = new Vector3();
    const center = new Vector3();
    box.getSize(size);
    box.getCenter(center);

    const portrait = this.canvas.clientHeight >= this.canvas.clientWidth;
    // In verticale si inquadra il mezzo busto: deve starci la testa con un po'
    // di aria sopra — sotto c'è la fascia di stato — e le mani, che nelle mosse
    // arrivano davanti al petto.
    const targetY = portrait ? box.max.y - size.y * 0.28 : center.y;
    const visible = portrait ? size.y * 0.68 : size.y * 1.02;
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = visible / 2 / Math.tan(fov / 2);

    this.camera.position.set(0, targetY, distance + size.z);
    this.camera.lookAt(0, targetY, 0);
    this.camera.updateProjectionMatrix();
  }

  private readonly handleResize = (): void => {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    const pixelRatio = Math.min(window.devicePixelRatio, this.options.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.lines.setSize(width, height, pixelRatio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // L'inquadratura va rifatta, non solo al caricamento: al primo calcolo il
    // canvas può non avere ancora dimensioni, e sul telefono la rotazione
    // cambia quale delle due inquadrature serve.
    if (this.subject) this.frameSubject(this.subject);
  };

  start(onFrame: (dt: number) => void): void {
    this.onFrame = onFrame;
    this.clock.start();
    const tick = (): void => {
      this.frameHandle = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.onFrame?.(dt);
      this.lines.render(this.scene, this.camera);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
  }

  dispose(): void {
    this.stop();
    this.detachInspect?.();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.handleResize);
    this.scene.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.gradient.dispose();
    this.faceTexture?.dispose();
    this.lines.dispose();
    this.renderer.dispose();
  }
}
