import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import type { Board, Color, Move, PieceType, Square } from '@makruk/engine';
import { fileOf, rankOf } from '@makruk/engine';
import { Animator, easeInOutQuad, easeOutBack, easeOutCubic } from './animator';
import type { Theme } from './themes/types';

const CELL = 1;

export interface AnimateOpts {
  move: Move;
  movedType: PieceType;
  color: Color;
  isCapture: boolean;
  promoted: boolean;
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}

function makeRenderer(gl: ExpoWebGLRenderingContext): THREE.WebGLRenderer {
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  const shim = {
    width: w,
    height: h,
    style: {},
    clientWidth: w,
    clientHeight: h,
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  };
  const canvas = (gl as unknown as { canvas?: HTMLCanvasElement }).canvas ?? (shim as unknown as HTMLCanvasElement);
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGLRenderingContext, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

/** จัดการฉาก 3D บนมือถือ (expo-gl) — กล้องหมุนด้วยนิ้ว, แตะเพื่อเลือก/เดิน */
export class MobileBoardView {
  private gl: ExpoWebGLRenderingContext;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private animator = new Animator();

  private boardGroup = new THREE.Group();
  private pieceGroup = new THREE.Group();
  private selGroup = new THREE.Group();
  private lastGroup = new THREE.Group();
  private lightGroup = new THREE.Group();
  private backdrop: THREE.Object3D | null = null;

  private tiles: THREE.Mesh[] = [];
  private pieces = new Map<Square, THREE.Object3D>();
  private theme: Theme;

  private raycaster = new THREE.Raycaster();
  private layoutW = 1;
  private layoutH = 1;

  // กล้องแบบ spherical
  private target = new THREE.Vector3(0, 0.4, 0);
  private radius = 12;
  private theta = 0;
  private phi = 0.92;

  private lastTime = Date.now();
  private running = true;

  constructor(gl: ExpoWebGLRenderingContext, theme: Theme, board: Board, layoutW: number, layoutH: number) {
    this.gl = gl;
    this.theme = theme;
    this.layoutW = layoutW || 1;
    this.layoutH = layoutH || 1;
    this.renderer = makeRenderer(gl);
    this.camera = new THREE.PerspectiveCamera(48, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 120);

    this.scene.add(this.boardGroup, this.pieceGroup, this.selGroup, this.lastGroup, this.lightGroup);
    this.applyEnvironment();
    this.buildBoard();
    this.rebuildPieces(board);
    this.updateCamera();
    this.loop();
  }

  private worldOf(sq: Square): THREE.Vector3 {
    return new THREE.Vector3((fileOf(sq) - 3.5) * CELL, 0, (3.5 - rankOf(sq)) * CELL);
  }

  private updateCamera(): void {
    const t = this.target;
    this.camera.position.set(
      t.x + this.radius * Math.sin(this.phi) * Math.sin(this.theta),
      t.y + this.radius * Math.cos(this.phi),
      t.z + this.radius * Math.sin(this.phi) * Math.cos(this.theta)
    );
    this.camera.lookAt(t);
  }

  orbit(dx: number, dy: number): void {
    this.theta -= dx * 0.006;
    this.phi = Math.max(0.25, Math.min(1.35, this.phi - dy * 0.006));
    this.updateCamera();
  }

  zoom(factor: number): void {
    this.radius = Math.max(6, Math.min(22, this.radius * factor));
    this.updateCamera();
  }

  private applyEnvironment(): void {
    const env = this.theme.environment;
    this.scene.background = new THREE.Color(env.background);
    this.scene.fog = env.fog ? new THREE.Fog(env.fog.color, env.fog.near, env.fog.far) : null;

    this.lightGroup.clear();
    this.lightGroup.add(new THREE.HemisphereLight(env.hemi.sky, env.hemi.ground, env.hemi.intensity));
    if (env.ambient !== undefined) this.lightGroup.add(new THREE.AmbientLight(env.ambient, 0.6));
    const dir = new THREE.DirectionalLight(env.dir.color, env.dir.intensity);
    dir.position.set(6, 13, 8);
    this.lightGroup.add(dir);

    if (this.backdrop) {
      this.scene.remove(this.backdrop);
      disposeObject(this.backdrop);
      this.backdrop = null;
    }
    if (env.backdrop === 'stars') this.backdrop = this.makeStars();
    else if (env.backdrop === 'grid') {
      const grid = new THREE.GridHelper(80, 80, env.dir.color, env.dir.color);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.12;
      grid.position.y = -0.2;
      this.backdrop = grid;
    }
    if (this.backdrop) this.scene.add(this.backdrop);
  }

  private makeStars(): THREE.Points {
    const n = 800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 40 + (i % 30);
      const t = (i * 2.39996) % (Math.PI * 2);
      const p = Math.acos(((i % 100) / 100) * 2 - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(p)) * 0.6 + 2;
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcfe6ff, size: 0.25, transparent: true, opacity: 0.9 }));
  }

  private buildBoard(): void {
    this.boardGroup.clear();
    for (const t of this.tiles) t.geometry.dispose();
    this.tiles = [];
    const b = this.theme.board;
    const matLight = new THREE.MeshStandardMaterial({ color: b.light, roughness: b.roughness ?? 0.7, metalness: b.metalness ?? 0.05 });
    const matDark = new THREE.MeshStandardMaterial({ color: b.dark, roughness: b.roughness ?? 0.7, metalness: b.metalness ?? 0.05 });
    for (let sq = 0; sq < 64; sq++) {
      const f = fileOf(sq);
      const r = rankOf(sq);
      const tile = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.18, CELL), (f + r) % 2 === 1 ? matLight : matDark);
      const w = this.worldOf(sq);
      tile.position.set(w.x, -0.09, w.z);
      tile.userData.square = sq;
      this.boardGroup.add(tile);
      this.tiles.push(tile);
    }
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(8 * CELL + 0.7, 0.22, 8 * CELL + 0.7),
      new THREE.MeshStandardMaterial({ color: b.frame, roughness: 0.6, metalness: 0.2 })
    );
    frame.position.y = -0.21;
    this.boardGroup.add(frame);
  }

  private buildContainer(type: PieceType, color: Color, sq: Square): THREE.Object3D {
    const c = new THREE.Group();
    const piece = this.theme.buildPiece(type, color);
    if (color === 'black') piece.rotation.y = Math.PI;
    c.add(piece);
    const w = this.worldOf(sq);
    c.position.set(w.x, 0, w.z);
    c.userData.square = sq;
    return c;
  }

  rebuildPieces(board: Board): void {
    for (const obj of this.pieces.values()) {
      this.pieceGroup.remove(obj);
      disposeObject(obj);
    }
    this.pieces.clear();
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (!p) continue;
      const c = this.buildContainer(p.type, p.color, sq);
      this.pieceGroup.add(c);
      this.pieces.set(sq, c);
    }
  }

  setTheme(theme: Theme, board: Board): void {
    this.theme = theme;
    this.applyEnvironment();
    this.buildBoard();
    this.rebuildPieces(board);
  }

  async animateMove(o: AnimateOpts): Promise<void> {
    const fromSq = o.move.from;
    const toSq = o.move.to;
    const container = this.pieces.get(fromSq);
    if (!container) return;

    if (o.isCapture) {
      const cap = this.pieces.get(toSq);
      if (cap) {
        this.pieces.delete(toSq);
        void this.animator.scale(cap, 0.001, { duration: 0.32 });
        void this.animator
          .move(cap, { x: cap.position.x, y: -0.7, z: cap.position.z }, { duration: 0.34, easing: easeOutCubic })
          .then(() => {
            this.pieceGroup.remove(cap);
            disposeObject(cap);
          });
      }
    }

    this.pieces.delete(fromSq);
    const target = this.worldOf(toSq);
    const isHop = o.movedType === 'ma';
    await this.animator.move(container, { x: target.x, y: 0, z: target.z }, {
      duration: isHop ? 0.5 : 0.45,
      arc: isHop ? 0.95 : 0,
      easing: isHop ? easeOutCubic : easeInOutQuad,
    });
    this.pieces.set(toSq, container);
    container.userData.square = toSq;

    if (o.promoted) {
      const old = container.children[0];
      if (old) {
        container.remove(old);
        disposeObject(old);
      }
      const met = this.theme.buildPiece('met', o.color);
      if (o.color === 'black') met.rotation.y = Math.PI;
      met.scale.setScalar(0.01);
      container.add(met);
      void this.animator.tween(0.5, (e) => {
        met.rotation.y = (o.color === 'black' ? Math.PI : 0) + e * Math.PI * 2;
      });
      await this.animator.scale(met, 1, { duration: 0.5, easing: easeOutBack });
    }
  }

  private flat(geo: THREE.BufferGeometry, color: number, opacity: number, y: number, sq: Square): THREE.Mesh {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    const w = this.worldOf(sq);
    m.position.set(w.x, y, w.z);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  clearSelection(): void {
    this.selGroup.clear();
  }
  showSelected(sq: Square): void {
    this.selGroup.add(this.flat(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), this.theme.board.select, 0.38, 0.012, sq));
  }
  showTargets(targets: { to: Square; capture: boolean }[]): void {
    for (const t of targets) {
      if (t.capture) this.selGroup.add(this.flat(new THREE.RingGeometry(0.3, 0.42, 28), this.theme.board.capture, 0.85, 0.014, t.to));
      else this.selGroup.add(this.flat(new THREE.CircleGeometry(0.16, 24), this.theme.board.move, 0.85, 0.014, t.to));
    }
  }
  showLastMove(from: Square, to: Square): void {
    this.lastGroup.clear();
    this.lastGroup.add(this.flat(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), this.theme.board.lastMove, 0.25, 0.011, from));
    this.lastGroup.add(this.flat(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), this.theme.board.lastMove, 0.3, 0.011, to));
  }
  clearLastMove(): void {
    this.lastGroup.clear();
  }

  /** x,y = พิกัดสัมผัสภายใน GLView (หน่วย dp) */
  pick(x: number, y: number): Square | null {
    const ndc = new THREE.Vector2((x / this.layoutW) * 2 - 1, -(y / this.layoutH) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const targets: THREE.Object3D[] = [...this.tiles, ...this.pieceGroup.children];
    const hits = this.raycaster.intersectObjects(targets, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData && o.userData.square !== undefined) return o.userData.square as Square;
        o = o.parent;
      }
    }
    return null;
  }

  setLayout(w: number, h: number): void {
    this.layoutW = w || this.layoutW;
    this.layoutH = h || this.layoutH;
  }

  dispose(): void {
    this.running = false;
  }

  /** เดินเฟรมเอง + เรนเดอร์ 1 ครั้ง (ใช้ตอนทดสอบใน preview ที่ rAF ถูก throttle) */
  pump(frames = 30): void {
    for (let i = 0; i < frames; i++) this.animator.update(0.05);
    this.renderer.render(this.scene, this.camera);
    this.gl.endFrameEXP();
  }

  private loop = (): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const now = Date.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.animator.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.gl.endFrameEXP();
  };

  get busy(): boolean {
    return this.animator.busy;
  }
}
