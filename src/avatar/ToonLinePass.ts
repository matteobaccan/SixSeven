/**
 * Resa cartoon in due passaggi: colore piatto + linee di contorno.
 *
 * Il guscio invertito, la tecnica più diffusa per i contorni, disegna solo la
 * sagoma esterna: il riferimento grafico del progetto ha invece linee anche sui
 * dettagli interni (naso, occhi, colletto, attacco delle maniche). Qui la scena
 * viene renderizzata due volte — una in normali+profondità, una a colori — e un
 * filtro di bordo confronta i pixel vicini: dove normale o profondità cambiano
 * bruscamente passa una linea. Il tratto risulta di spessore uniforme, come in
 * un disegno.
 *
 * Costo: due passate di geometria più un quad a schermo intero. Con una mesh di
 * questa dimensione resta leggero; `setLineWidth(0)` disattiva le linee e torna
 * a una sola passata per i dispositivi meno potenti.
 */
import {
  Color,
  DepthTexture,
  Mesh,
  MeshNormalMaterial,
  NoBlending,
  type Object3D,
  OrthographicCamera,
  type PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  #include <packing>

  uniform sampler2D tColor;
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uWidth;
  uniform vec3 uLineColor;
  uniform float uNormalBias;
  uniform float uDepthBias;
  uniform float uNear;
  uniform float uFar;
  varying vec2 vUv;

  float viewZAt(vec2 uv) {
    float depth = texture2D(tDepth, uv).x;
    return perspectiveDepthToViewZ(depth, uNear, uFar);
  }

  void main() {
    vec2 step = uTexel * uWidth;
    vec3 n0 = texture2D(tNormal, vUv).xyz;
    float z0 = viewZAt(vUv);

    float normalEdge = 0.0;
    float depthEdge = 0.0;

    // Croce a quattro campioni: sufficiente per un tratto pulito e molto più
    // economica di un Sobel completo.
    for (int i = 0; i < 4; i++) {
      vec2 offset = i == 0
        ? vec2(step.x, 0.0)
        : i == 1 ? vec2(-step.x, 0.0) : i == 2 ? vec2(0.0, step.y) : vec2(0.0, -step.y);
      vec2 uv = clamp(vUv + offset, vec2(0.0), vec2(1.0));
      normalEdge = max(normalEdge, distance(texture2D(tNormal, uv).xyz, n0));
      depthEdge = max(depthEdge, abs(viewZAt(uv) - z0));
    }

    // La soglia di profondità è relativa alla distanza: una piega vicina alla
    // camera non deve pesare più di una lontana.
    float relativeDepth = depthEdge / max(0.02, abs(z0));
    float edge = max(
      smoothstep(uNormalBias, uNormalBias + 0.18, normalEdge),
      smoothstep(uDepthBias, uDepthBias * 2.0, relativeDepth)
    );

    vec4 color = texture2D(tColor, vUv);
    gl_FragColor = vec4(mix(color.rgb, uLineColor, edge), 1.0);

    // Il render target contiene valori lineari: senza questa conversione
    // finirebbero sul canvas come se fossero già in sRGB, e tutta l'immagine
    // risulterebbe scura e desaturata.
    #include <colorspace_fragment>
  }
`;

export interface ToonLineOptions {
  lineColor?: number;
  /** Spessore in pixel del tratto. 0 disattiva il passaggio delle linee. */
  lineWidth?: number;
  normalBias?: number;
  depthBias?: number;
}

export class ToonLinePass {
  private readonly colorTarget: WebGLRenderTarget;
  private readonly normalTarget: WebGLRenderTarget;
  private readonly normalMaterial = new MeshNormalMaterial({ blending: NoBlending });
  private readonly quadScene = new Scene();
  private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: ShaderMaterial;
  /** Oggetti esclusi dalle linee: fondale e ombra di contatto. */
  private readonly excluded = new Set<Object3D>();

  constructor(
    private readonly renderer: WebGLRenderer,
    options: ToonLineOptions = {},
  ) {
    const depthTexture = new DepthTexture(1, 1);
    depthTexture.type = UnsignedIntType;

    this.normalTarget = new WebGLRenderTarget(1, 1, { depthTexture });
    this.colorTarget = new WebGLRenderTarget(1, 1, { samples: 4 });

    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.colorTarget.texture },
        tNormal: { value: this.normalTarget.texture },
        tDepth: { value: depthTexture },
        uTexel: { value: new Vector2() },
        uWidth: { value: options.lineWidth ?? 1.15 },
        uLineColor: { value: new Color(options.lineColor ?? 0x15120f) },
        uNormalBias: { value: options.normalBias ?? 0.42 },
        uDepthBias: { value: options.depthBias ?? 0.006 },
        uNear: { value: 0.1 },
        uFar: { value: 50 },
      },
    });

    this.quadScene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
  }

  /** Esclude un oggetto dal calcolo dei bordi (fondali, ombre finte). */
  exclude(object: Object3D): void {
    this.excluded.add(object);
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    const w = Math.max(1, Math.floor(width * pixelRatio));
    const h = Math.max(1, Math.floor(height * pixelRatio));
    this.colorTarget.setSize(w, h);
    this.normalTarget.setSize(w, h);
    (this.material.uniforms.uTexel.value as Vector2).set(1 / w, 1 / h);
  }

  setLineWidth(width: number): void {
    this.material.uniforms.uWidth.value = width;
  }

  get lineWidth(): number {
    return this.material.uniforms.uWidth.value as number;
  }

  render(scene: Scene, camera: PerspectiveCamera): void {
    if (this.lineWidth <= 0) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }

    this.material.uniforms.uNear.value = camera.near;
    this.material.uniforms.uFar.value = camera.far;

    // Passata normali+profondità: fondale e ombra non devono generare bordi.
    const hidden: Object3D[] = [];
    for (const object of this.excluded) {
      if (object.visible) {
        object.visible = false;
        hidden.push(object);
      }
    }
    const background = scene.background;
    scene.background = null;
    scene.overrideMaterial = this.normalMaterial;
    this.renderer.setRenderTarget(this.normalTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    // Passata di colore.
    scene.overrideMaterial = null;
    scene.background = background;
    for (const object of hidden) object.visible = true;
    this.renderer.setRenderTarget(this.colorTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    // Composizione.
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  dispose(): void {
    this.colorTarget.dispose();
    this.normalTarget.dispose();
    this.normalMaterial.dispose();
    this.material.dispose();
  }
}
