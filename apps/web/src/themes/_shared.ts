import * as THREE from 'three';
import type { PieceType } from '@makruk/engine';

const RADIAL = 28;

export interface Palette {
  body: THREE.Material;
  accent: THREE.Material;
  head?: THREE.Material; // ผิว (ธีมคนทำงาน)
  prop?: THREE.Material; // อุปกรณ์ประกอบ
}

const SKIN = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.75 });

function part(geo: THREE.BufferGeometry, mat: THREE.Material, y: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.castShadow = true;
  return m;
}
const cyl = (rTop: number, rBot: number, h: number) => new THREE.CylinderGeometry(rTop, rBot, h, RADIAL);
const sph = (r: number) => new THREE.SphereGeometry(r, RADIAL, Math.max(10, RADIAL >> 1));
const cone = (r: number, h: number) => new THREE.ConeGeometry(r, h, RADIAL);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** วงแหวนคอ (วางแนวนอน) */
function collar(mat: THREE.Material, r: number, tube: number, y: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, RADIAL), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  m.castShadow = true;
  return m;
}

/** ฐานร่วมของหมากทรงกลึง คืนค่า y ที่ต่อด้านบนของฐาน */
function addBase(g: THREE.Group, mat: THREE.Material): number {
  g.add(part(cyl(0.3, 0.36, 0.09), mat, 0.045));
  g.add(part(cyl(0.24, 0.3, 0.05), mat, 0.115));
  return 0.14;
}

/** ตัวหมากทรงกลึง (ใช้ร่วมหลายธีม โดยเปลี่ยนวัสดุ/สี) */
export function makeTurnedPiece(type: PieceType, pal: Palette): THREE.Object3D {
  const g = new THREE.Group();
  let y = addBase(g, pal.body);

  switch (type) {
    case 'bia': {
      g.add(part(cyl(0.13, 0.22, 0.18), pal.body, y + 0.09));
      y += 0.18;
      g.add(collar(pal.accent, 0.14, 0.03, y));
      g.add(part(sph(0.16), pal.body, y + 0.13));
      y += 0.26;
      break;
    }
    case 'met': {
      g.add(part(cyl(0.14, 0.24, 0.26), pal.body, y + 0.13));
      y += 0.26;
      g.add(collar(pal.accent, 0.15, 0.035, y));
      g.add(part(sph(0.17), pal.accent, y + 0.14));
      y += 0.28;
      break;
    }
    case 'khon': {
      g.add(part(cyl(0.13, 0.24, 0.3), pal.body, y + 0.15));
      y += 0.3;
      g.add(collar(pal.accent, 0.14, 0.03, y));
      g.add(part(cone(0.17, 0.26), pal.body, y + 0.13));
      y += 0.26;
      g.add(part(sph(0.055), pal.accent, y + 0.02));
      y += 0.04;
      break;
    }
    case 'ma': {
      g.add(part(cyl(0.15, 0.24, 0.24), pal.body, y + 0.12));
      y += 0.24;
      // คอ + หัวม้า (เอียง)
      const head = new THREE.Group();
      const neck = part(box(0.16, 0.28, 0.12), pal.accent, 0.12);
      neck.rotation.x = -0.32;
      head.add(neck);
      const muzzle = part(box(0.12, 0.12, 0.22), pal.accent, 0.24);
      muzzle.rotation.x = -0.32;
      muzzle.position.z = 0.07;
      head.add(muzzle);
      const ear = part(cone(0.04, 0.1), pal.accent, 0.32);
      ear.position.z = -0.06;
      head.add(ear);
      head.position.y = y;
      g.add(head);
      y += 0.36;
      break;
    }
    case 'rua': {
      g.add(part(cyl(0.18, 0.24, 0.3), pal.body, y + 0.15));
      y += 0.3;
      g.add(part(cyl(0.23, 0.2, 0.1), pal.body, y + 0.05));
      y += 0.1;
      for (let i = 0; i < 4; i++) {
        const b = part(box(0.09, 0.1, 0.09), pal.accent, y + 0.05);
        const a = (i * Math.PI) / 2;
        b.position.x = Math.cos(a) * 0.14;
        b.position.z = Math.sin(a) * 0.14;
        g.add(b);
      }
      y += 0.1;
      break;
    }
    case 'khun': {
      g.add(part(cyl(0.14, 0.26, 0.4), pal.body, y + 0.2));
      y += 0.4;
      g.add(collar(pal.accent, 0.16, 0.04, y));
      g.add(part(sph(0.17), pal.body, y + 0.14));
      y += 0.26;
      g.add(part(cone(0.06, 0.16), pal.accent, y + 0.06));
      g.add(part(sph(0.04), pal.accent, y + 0.16));
      y += 0.18;
      break;
    }
  }

  g.userData.height = y;
  return g;
}

/** ธีม "คนทำงาน" — ตัวหมากเป็นคนตัวเล็ก ๆ */
export function makePeoplePiece(type: PieceType, pal: Palette): THREE.Object3D {
  const g = new THREE.Group();
  const suit = pal.body;
  const accent = pal.accent;
  const head = pal.head ?? SKIN;

  g.add(part(cyl(0.28, 0.33, 0.06), accent, 0.03));

  const torsoLen: Record<PieceType, number> = { bia: 0.24, ma: 0.28, khon: 0.32, rua: 0.3, met: 0.4, khun: 0.5 };
  const r = 0.17;
  const len = torsoLen[type];
  const torsoBase = 0.06;
  const torsoCenter = torsoBase + r + len / 2;
  g.add(part(new THREE.CapsuleGeometry(r, len, 6, 16), suit, torsoCenter));

  const headY = torsoBase + r + len + 0.16;
  g.add(part(sph(0.14), head, headY));

  switch (type) {
    case 'khun': {
      // เจ้านาย: หมวกทรงสูง
      g.add(part(cyl(0.2, 0.2, 0.02), accent, headY + 0.1));
      g.add(part(cyl(0.13, 0.13, 0.18), accent, headY + 0.2));
      break;
    }
    case 'met': {
      // ผู้จัดการ: เนกไท
      const tie = part(box(0.06, 0.2, 0.02), accent, torsoCenter + 0.04);
      tie.position.z = r - 0.01;
      g.add(tie);
      break;
    }
    case 'rua': {
      // ช่าง/รปภ.: หมวกนิรภัย
      const helmet = part(sph(0.16), accent, headY + 0.06);
      helmet.scale.y = 0.6;
      g.add(helmet);
      break;
    }
    case 'khon': {
      // พนักงาน: กระเป๋าเอกสาร
      const bag = part(box(0.15, 0.12, 0.05), accent, torsoBase + 0.2);
      bag.position.x = r + 0.07;
      g.add(bag);
      break;
    }
    case 'ma': {
      // ไรเดอร์: หมวกแก๊ป
      g.add(part(cone(0.15, 0.1), accent, headY + 0.12));
      const visor = part(box(0.16, 0.02, 0.1), accent, headY + 0.04);
      visor.position.z = 0.12;
      g.add(visor);
      break;
    }
    case 'bia': {
      // เด็กฝึกงาน: หมวกนิรภัยเล็ก
      g.add(part(cone(0.14, 0.1), accent, headY + 0.11));
      break;
    }
  }

  g.userData.height = headY + 0.35;
  return g;
}

/** เพิ่มขอบ wireframe เรืองแสง (ธีม AI/โฮโลแกรม) */
export function addEdges(obj: THREE.Object3D, color: number): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(m.geometry, 25),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
      );
      m.add(edges);
    }
  });
}
