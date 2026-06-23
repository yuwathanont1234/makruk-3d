import type * as THREE from 'three';

export type Vec3 = { x: number; y: number; z: number };
export type Easing = (t: number) => number;

export const easeInOutQuad: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack: Easing = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);

interface ActiveTween {
  update(dt: number): boolean; // คืน true เมื่อจบ
}

/** ระบบ tween เล็ก ๆ ขับเคลื่อนด้วย dt จาก render loop */
export class Animator {
  private tweens: ActiveTween[] = [];

  get busy(): boolean {
    return this.tweens.length > 0;
  }

  update(dt: number): void {
    if (this.tweens.length === 0) return;
    this.tweens = this.tweens.filter((t) => !t.update(dt));
  }

  /** เลื่อนตำแหน่งวัตถุไปยัง to (มี arc สำหรับการกระโดด เช่น ม้า) */
  move(
    obj: THREE.Object3D,
    to: Vec3,
    opts: { duration?: number; arc?: number; easing?: Easing } = {}
  ): Promise<void> {
    const from = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
    const dur = opts.duration ?? 0.45;
    const ease = opts.easing ?? easeInOutQuad;
    const arc = opts.arc ?? 0;
    let el = 0;
    return new Promise<void>((resolve) => {
      this.tweens.push({
        update: (dt) => {
          el += dt;
          const tt = Math.min(1, el / dur);
          const e = ease(tt);
          obj.position.x = from.x + (to.x - from.x) * e;
          obj.position.z = from.z + (to.z - from.z) * e;
          obj.position.y = from.y + (to.y - from.y) * e + Math.sin(Math.PI * tt) * arc;
          if (tt >= 1) {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /** ปรับ scale แบบสม่ำเสมอ */
  scale(obj: THREE.Object3D, toScalar: number, opts: { duration?: number; easing?: Easing } = {}): Promise<void> {
    const from = obj.scale.x;
    const dur = opts.duration ?? 0.3;
    const ease = opts.easing ?? easeOutCubic;
    let el = 0;
    return new Promise<void>((resolve) => {
      this.tweens.push({
        update: (dt) => {
          el += dt;
          const tt = Math.min(1, el / dur);
          const v = from + (toScalar - from) * ease(tt);
          obj.scale.setScalar(v);
          if (tt >= 1) {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }

  /** tween ทั่วไปบนช่วง [0,1] */
  tween(dur: number, onUpdate: (e: number) => void, easing: Easing = easeInOutQuad): Promise<void> {
    let el = 0;
    return new Promise<void>((resolve) => {
      this.tweens.push({
        update: (dt) => {
          el += dt;
          const tt = Math.min(1, el / dur);
          onUpdate(easing(tt));
          if (tt >= 1) {
            resolve();
            return true;
          }
          return false;
        },
      });
    });
  }
}
