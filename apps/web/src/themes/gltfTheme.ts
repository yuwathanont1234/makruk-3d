import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { PIECE_TYPES } from '@makruk/engine';
import type { Color, PieceType } from '@makruk/engine';
import type { Theme, BoardStyle, EnvironmentStyle } from './types';

export interface ModelManifest {
  models: Partial<Record<PieceType, string>>; // URL ของ GLB ต่อชนิดหมาก
  targetHeight?: number;
  /** มุมหมุน Y (เรเดียน) ต่อชนิดหมาก — แก้โมเดลที่หันผิดทาง (เช่น ม้าที่เจนมาแบบ side view) */
  rotation?: Partial<Record<PieceType, number>>;
}

export interface GltfThemeOptions {
  id: string;
  name: string;
  emoji: string;
  description: string;
  defaultSoundPack: string;
  board: BoardStyle;
  environment: EnvironmentStyle;
  manifest: ModelManifest;
}

interface Loaded {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

function tintBlack(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    m.material = mats.map((mat) => {
      const c = (mat as THREE.MeshStandardMaterial).clone();
      const col = (c as THREE.MeshStandardMaterial).color;
      if (col) col.multiplyScalar(0.42);
      return c;
    });
    if (Array.isArray(m.material) && m.material.length === 1) m.material = m.material[0];
  });
}

const IDLE_RE = /idle|survey|stand|breath|loop/i;

const _bv = new THREE.Vector3();
/**
 * ความสูงอ้างอิงสำหรับ normalize:
 * - โมเดลมี rig (SkinnedMesh) → setFromObject วัด bind-pose (กางแขน/ปีก) เพี้ยนและไม่สม่ำเสมอต่อตัว
 *   จึงใช้ช่วงความสูงของ "กระดูก" ซึ่งสเกลตามตัวจริงเท่ากันทุกตัว (หาร 0.82 เผื่อมงกุฎ/หัว/เท้าที่เลยกระดูก)
 * - ไม่มีกระดูก (static mesh) → คืน 0 ให้ผู้เรียกใช้ setFromObject แทน
 */
function boneHeight(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  let min = Infinity;
  let max = -Infinity;
  let n = 0;
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      o.getWorldPosition(_bv);
      if (_bv.y < min) min = _bv.y;
      if (_bv.y > max) max = _bv.y;
      n++;
    }
  });
  return n >= 4 && max > min ? (max - min) / 0.82 : 0;
}

/**
 * ธีมจากโมเดล GLB จริง (ใช้กับธีม AI "พิมพ์ธีมเอง")
 * - clone โมเดล (รองรับ rig ด้วย SkeletonUtils)
 * - ถ้าโมเดลมี animation clip → เล่นผ่าน AnimationMixer (ตัวหมากขยับตัวได้)
 */
export function createGltfTheme(opts: GltfThemeOptions): Theme {
  const loader = new GLTFLoader();
  const cache = new Map<string, Loaded>(); // cache ตาม URL
  const mixers: THREE.AnimationMixer[] = [];
  const idlers: { obj: THREE.Object3D; baseY: number; phase: number }[] = [];
  let clock = 0;
  const targetH = opts.manifest.targetHeight ?? 1.5;

  async function preload(): Promise<void> {
    const urls = Array.from(new Set(PIECE_TYPES.map((t) => opts.manifest.models[t]).filter(Boolean) as string[]));
    await Promise.all(
      urls.map(async (url) => {
        const gltf = await loader.loadAsync(url);
        cache.set(url, { scene: gltf.scene, animations: gltf.animations ?? [] });
      })
    );
  }

  function buildPiece(type: PieceType, color: Color): THREE.Object3D {
    const container = new THREE.Group();
    const url = opts.manifest.models[type];
    const loaded = url ? cache.get(url) : undefined;

    if (!loaded) {
      const ph = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.8, 0.4),
        new THREE.MeshStandardMaterial({ color: color === 'white' ? 0xdddddd : 0x333333 })
      );
      ph.position.y = 0.4;
      container.add(ph);
      return container;
    }

    const model = skeletonClone(loaded.scene);

    // หมุนแก้ทิศก่อน (เช่น ม้าที่เจนมาหันข้าง) แล้วค่อย normalize ตามทิศใหม่
    const rot = opts.manifest.rotation?.[type];
    if (rot) {
      model.rotation.y = rot;
      model.updateMatrixWorld(true);
    }

    // normalize: สูง = targetH (ใช้ความสูงกระดูกถ้ามี rig เพื่อให้ทุกตัวขนาดสม่ำเสมอ), ฐาน y=0, กึ่งกลาง x/z
    const refH = boneHeight(model) || new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    model.scale.setScalar(targetH / (refH || 1));
    const bbox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= bbox.min.y;

    if (color === 'black') tintBlack(model);
    container.add(model);

    // animation: ถ้ามี rig+walk → เตรียมไว้ "ยืนนิ่ง" (frame 0) จนกว่าจะเดิน (เล่นตอนหมากเคลื่อนที่)
    if (loaded.animations.length > 0) {
      const clip = loaded.animations.find((c) => /walk|run|move/i.test(c.name)) ?? loaded.animations[0];
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip);
      action.play();
      action.paused = true;
      action.time = 0;
      mixer.update(0);
      (model.userData as { mkAnim?: unknown }).mkAnim = { mixer, action };
      mixers.push(mixer);
    } else {
      // โมเดลไม่มี rig (เช่นจาก image→3D) → ใส่ idle เบา ๆ ให้ขยับตัวได้
      idlers.push({ obj: model, baseY: model.position.y, phase: Math.random() * Math.PI * 2 });
    }
    return container;
  }

  function update(dt: number): void {
    clock += dt;
    for (const m of mixers) m.update(dt);
    for (const o of idlers) {
      o.obj.position.y = o.baseY + Math.sin(clock * 2 + o.phase) * 0.03;
      o.obj.rotation.z = Math.sin(clock * 1.6 + o.phase) * 0.03;
    }
  }

  // เล่น/หยุด walk ของตัวที่มี rig (เรียกตอนหมากเริ่ม/จบการเคลื่อนที่)
  function setMoving(obj: THREE.Object3D, moving: boolean): boolean {
    let found = false;
    obj.traverse((o) => {
      const a = (o.userData as { mkAnim?: { mixer: THREE.AnimationMixer; action: THREE.AnimationAction } }).mkAnim;
      if (!a) return;
      found = true;
      if (moving) {
        a.action.reset();
        a.action.paused = false;
        a.action.timeScale = 1.2;
        a.action.play();
      } else {
        a.action.paused = true;
        a.action.time = 0;
        a.mixer.update(0);
      }
    });
    return found;
  }

  return {
    id: opts.id,
    name: opts.name,
    emoji: opts.emoji,
    description: opts.description,
    defaultSoundPack: opts.defaultSoundPack,
    board: opts.board,
    environment: opts.environment,
    buildPiece,
    preload,
    update,
    setMoving,
  };
}

/** ตัวช่วยสร้างธีม AI จาก manifest โมเดล (ใช้ board/แสงกลาง ๆ ให้โมเดลเด่น) */
export function createAiModelTheme(id: string, name: string, models: Partial<Record<PieceType, string>>): Theme {
  const board: BoardStyle = {
    light: 0xe9e4da,
    dark: 0x6f6657,
    frame: 0x453b2f,
    select: 0x3aa0ff,
    move: 0x49c96d,
    capture: 0xff5a5a,
    lastMove: 0xffc24e,
    roughness: 0.8,
  };
  const environment: EnvironmentStyle = {
    background: 0x15171c,
    backdrop: 'none',
    hemi: { sky: 0xeef2f7, ground: 0x22252b, intensity: 1.0 },
    dir: { color: 0xffffff, intensity: 1.3 },
    ambient: 0x3a3f47,
  };
  return createGltfTheme({
    id,
    name,
    emoji: '✨',
    description: 'ตัวหมาก 3D ที่ AI สร้างจากคำของคุณ',
    defaultSoundPack: 'soft',
    board,
    environment,
    manifest: { models, targetHeight: 1.5 },
  });
}
