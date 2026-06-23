import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
  capturedType: PieceType | null;
  promoted: boolean;
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}

export class BoardView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private clock = new THREE.Clock();
  readonly animator = new Animator();

  private boardGroup = new THREE.Group();
  private pieceGroup = new THREE.Group();
  private selGroup = new THREE.Group();
  private lastGroup = new THREE.Group();
  private lightGroup = new THREE.Group();
  private backdrop: THREE.Object3D | null = null;

  private tiles: THREE.Mesh[] = [];
  private pieces = new Map<Square, THREE.Object3D>();
  private themeWhite: Theme;
  private themeBlack: Theme;
  // กระดาน/แสง/ไฮไลต์ ใช้ธีมฝั่งขาวเป็นหลัก
  private get theme(): Theme {
    return this.themeWhite;
  }

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  onPick: ((sq: Square) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, themeWhite: Theme, themeBlack: Theme, board: Board) {
    this.themeWhite = themeWhite;
    this.themeBlack = themeBlack;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    this.camera.position.set(0, 7.4, 8.4);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.4, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 24;
    this.controls.maxPolarAngle = 1.45;

    this.scene.add(this.boardGroup, this.pieceGroup, this.selGroup, this.lastGroup, this.lightGroup);

    this.applyEnvironment();
    this.buildBoard();
    this.rebuildPieces(board);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.renderer.setAnimationLoop(this.loop);
  }

  // --- coordinates ---
  private worldOf(sq: Square): THREE.Vector3 {
    return new THREE.Vector3((fileOf(sq) - 3.5) * CELL, 0, (3.5 - rankOf(sq)) * CELL);
  }

  // --- environment / lights / backdrop ---
  private applyEnvironment(): void {
    const env = this.theme.environment;
    this.scene.background = new THREE.Color(env.background);
    this.scene.fog = env.fog ? new THREE.Fog(env.fog.color, env.fog.near, env.fog.far) : null;

    this.lightGroup.clear();
    const hemi = new THREE.HemisphereLight(env.hemi.sky, env.hemi.ground, env.hemi.intensity);
    this.lightGroup.add(hemi);
    if (env.ambient !== undefined) this.lightGroup.add(new THREE.AmbientLight(env.ambient, 0.6));
    const dir = new THREE.DirectionalLight(env.dir.color, env.dir.intensity);
    dir.position.set(6, 13, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 40;
    const d = 8;
    dir.shadow.camera.left = -d;
    dir.shadow.camera.right = d;
    dir.shadow.camera.top = d;
    dir.shadow.camera.bottom = -d;
    dir.shadow.bias = -0.0005;
    this.lightGroup.add(dir);

    if (this.backdrop) {
      this.scene.remove(this.backdrop);
      disposeObject(this.backdrop);
      this.backdrop = null;
    }
    if (env.backdrop === 'stars') this.backdrop = this.makeStars();
    else if (env.backdrop === 'grid') this.backdrop = this.makeGrid(env.dir.color);
    if (this.backdrop) this.scene.add(this.backdrop);
  }

  private makeStars(): THREE.Points {
    const n = 1200;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 40 + Math.random() * 30;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(p)) * 0.6 + 2;
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xcfe6ff, size: 0.25, sizeAttenuation: true, transparent: true, opacity: 0.9 });
    return new THREE.Points(geo, mat);
  }

  private makeGrid(color: number): THREE.GridHelper {
    const grid = new THREE.GridHelper(80, 80, color, color);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.12;
    grid.position.y = -0.2;
    return grid;
  }

  // --- board ---
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
      const isLight = (f + r) % 2 === 1;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.18, CELL), isLight ? matLight : matDark);
      const w = this.worldOf(sq);
      tile.position.set(w.x, -0.09, w.z);
      tile.receiveShadow = true;
      tile.userData.square = sq;
      this.boardGroup.add(tile);
      this.tiles.push(tile);
    }

    // กรอบใหญ่
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(8 * CELL + 1.0, 0.32, 8 * CELL + 1.0),
      new THREE.MeshStandardMaterial({ color: b.frame, roughness: 0.55, metalness: b.metalness ?? 0.2 })
    );
    frame.position.y = -0.17;
    frame.receiveShadow = true;
    this.boardGroup.add(frame);

    // ขอบประดับยกขอบ (accent เช่น ทอง) ให้เข้ากับธีม
    if (b.accent !== undefined) {
      const rimMat = new THREE.MeshStandardMaterial({ color: b.accent, roughness: 0.3, metalness: 0.9 });
      const span = 8 * CELL + 0.5;
      const t = 0.28;
      const half = 4 * CELL + 0.25;
      const bar = (w: number, d: number, x: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), rimMat);
        m.position.set(x, 0.0, z);
        m.receiveShadow = true;
        this.boardGroup.add(m);
      };
      bar(span + t, t, 0, half);
      bar(span + t, t, 0, -half);
      bar(t, span + t, half, 0);
      bar(t, span + t, -half, 0);
    }
  }

  // --- pieces ---
  private buildContainer(type: PieceType, color: Color, sq: Square): THREE.Object3D {
    const c = new THREE.Group();
    const piece = (color === 'white' ? this.themeWhite : this.themeBlack).buildPiece(type, color);
    piece.rotation.y = color === 'white' ? Math.PI : 0; // หันหน้าเข้าหากัน (ขาวหันไปทางดำ, ดำหันมาทางขาว)
    c.add(piece);
    const w = this.worldOf(sq);
    c.position.set(w.x, 0, w.z);
    c.userData.square = sq;
    c.userData.type = type;
    c.userData.color = color;
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

  setThemes(themeWhite: Theme, themeBlack: Theme, board: Board): void {
    this.themeWhite = themeWhite;
    this.themeBlack = themeBlack;
    this.applyEnvironment();
    this.buildBoard();
    this.rebuildPieces(board);
    this.popPieces();
  }

  /** เคลื่อนหมาก + อนิเมชัน (เลื่อน/ม้ากระโดด/กินหมาก/เลื่อนขั้น) */
  async animateMove(o: AnimateOpts): Promise<void> {
    const fromSq = o.move.from;
    const toSq = o.move.to;
    const container = this.pieces.get(fromSq);
    if (!container) return;

    this.pieces.delete(fromSq);
    const fromW = this.worldOf(fromSq);
    const target = this.worldOf(toSq);
    const dir = new THREE.Vector3(target.x - fromW.x, 0, target.z - fromW.z);
    if (dir.lengthSq() > 0) dir.normalize();
    const movingTheme = o.color === 'white' ? this.themeWhite : this.themeBlack;
    const walking = movingTheme.setMoving?.(container, true) ?? false; // เริ่ม animation เดิน (ถ้าตัวนี้มี rig)
    const isHop = o.movedType === 'ma' && !walking;

    // หมากที่ถูกกิน — ล้มฟุบ + กระเด็น + จมหาย (เหมือนถูกฟัน) ทำพร้อมฝ่ายรุกเดินเข้ามา
    if (o.isCapture) {
      const cap = this.pieces.get(toSq);
      if (cap) {
        this.pieces.delete(toSq);
        const p0 = cap.position.clone();
        const holdFrac = walking ? 0.5 : 0.25; // รอฝ่ายรุกเข้าใกล้ก่อนค่อยล้ม
        void this.animator
          .tween(walking ? 1.15 : 0.7, (e) => {
            const p = e <= holdFrac ? 0 : (e - holdFrac) / (1 - holdFrac);
            const fall = easeOutCubic(Math.min(1, p * 1.7)); // ล้มคว่ำเร็ว (ยังอยู่บนกระดานให้เห็น)
            const sink = easeOutCubic(Math.max(0, (p - 0.5) / 0.5)); // ค่อยจม+ย่อ หลังล้มแล้ว
            cap.position.x = p0.x + dir.x * 0.45 * fall;
            cap.position.z = p0.z + dir.z * 0.45 * fall;
            cap.rotation.x = -dir.z * (Math.PI / 2) * fall; // ล้มตามแรงฟัน
            cap.rotation.z = dir.x * (Math.PI / 2) * fall;
            cap.position.y = p0.y - 1.15 * sink;
            cap.scale.setScalar(1 - 0.5 * sink);
          })
          .then(() => {
            this.pieceGroup.remove(cap);
            disposeObject(cap);
          });
      }
    }

    // ฝ่ายรุกเดิน/กระโดด/เลื่อนเข้าหาเป้าหมาย
    await this.animator.move(container, { x: target.x, y: 0, z: target.z }, {
      duration: walking ? 1.0 : isHop ? 0.5 : 0.45, // เดินช้ากว่าเพื่อให้เห็นจังหวะก้าว
      arc: isHop ? 0.95 : 0,
      easing: isHop ? easeOutCubic : easeInOutQuad,
    });

    // จู่โจม: กระแทกไปข้างหน้าแล้วดึงกลับ (ท่าฟัน/ชน) ตอนกินหมาก
    if (o.isCapture) {
      await this.animator.tween(0.2, (e) => {
        const k = Math.sin(e * Math.PI); // 0→1→0
        container.position.x = target.x + dir.x * 0.25 * k;
        container.position.z = target.z + dir.z * 0.25 * k;
      });
      container.position.set(target.x, 0, target.z);
    }

    movingTheme.setMoving?.(container, false); // กลับมายืนนิ่ง
    this.pieces.set(toSq, container);
    container.userData.square = toSq;

    // เลื่อนขั้นเบี้ย → เปลี่ยนทรงเป็นเม็ด พร้อมเด้ง/หมุน
    if (o.promoted) {
      const old = container.children[0];
      if (old) {
        container.remove(old);
        disposeObject(old);
      }
      const met = (o.color === 'white' ? this.themeWhite : this.themeBlack).buildPiece('met', o.color);
      met.rotation.y = o.color === 'white' ? Math.PI : 0;
      met.scale.setScalar(0.01);
      container.add(met);
      container.userData.type = 'met';
      void this.animator.tween(0.5, (e) => {
        met.rotation.y = (o.color === 'black' ? Math.PI : 0) + e * Math.PI * 2;
      });
      await this.animator.scale(met, 1, { duration: 0.5, easing: easeOutBack });
    }
  }

  // --- highlights ---
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
      if (t.capture) {
        this.selGroup.add(this.flat(new THREE.RingGeometry(0.3, 0.42, 28), this.theme.board.capture, 0.85, 0.014, t.to));
      } else {
        this.selGroup.add(this.flat(new THREE.CircleGeometry(0.16, 24), this.theme.board.move, 0.85, 0.014, t.to));
      }
    }
  }

  showLastMove(from: Square, to: Square): void {
    this.lastGroup.clear();
    const g1 = this.flat(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), this.theme.board.lastMove, 0.25, 0.011, from);
    const g2 = this.flat(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92), this.theme.board.lastMove, 0.3, 0.011, to);
    this.lastGroup.add(g1, g2);
  }

  clearLastMove(): void {
    this.lastGroup.clear();
  }

  // --- picking (แยกคลิกออกจากการลากหมุนกล้อง) ---
  private downPos: { x: number; y: number } | null = null;

  private onPointerDown = (ev: PointerEvent): void => {
    this.downPos = { x: ev.clientX, y: ev.clientY };
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (!this.downPos) return;
    const dx = ev.clientX - this.downPos.x;
    const dy = ev.clientY - this.downPos.y;
    this.downPos = null;
    if (Math.hypot(dx, dy) > 8) return; // ลาก = หมุนกล้อง ไม่ใช่คลิก
    const sq = this.pickAt(ev.clientX, ev.clientY);
    if (sq !== null && this.onPick) this.onPick(sq);
  };

  pickAt(clientX: number, clientY: number): Square | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
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

  resize = (): void => {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private loop = (): void => {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.controls.update();
    this.animator.update(dt);
    this.themeWhite.update?.(dt); // เล่น animation ของโมเดล (เช่น ธีม AI ที่มี rig)
    if (this.themeBlack !== this.themeWhite) this.themeBlack.update?.(dt);
    this.renderer.render(this.scene, this.camera);
  };

  /** เอฟเฟกต์ "แปลงร่าง" — ตัวหมากผุดขึ้น + หมุน ตอนสลับธีม */
  private popPieces(): void {
    for (const c of this.pieces.values()) {
      c.scale.setScalar(0.01);
      void this.animator.scale(c, 1, { duration: 0.55, easing: easeOutBack });
      void this.animator.tween(0.55, (e) => {
        c.rotation.y = e * Math.PI * 2;
      });
    }
  }

  get busy(): boolean {
    return this.animator.busy;
  }
}
