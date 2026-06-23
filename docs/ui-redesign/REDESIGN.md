# Makruk 3D — Mobile UI Redesign Spec

มุก / UI/UX Designer · 2026-06-23

---

## 1. DISCOVER — Reference Apps

### Reference 1: Chess.com Mobile (iOS/Android)
https://www.chess.com/

**Pattern borrowed — Board-first layout:**
กระดานครอบครองพื้นที่กว้าง viewport เกือบทั้งหมด บน-ล่างมีเพียง name chips ของผู้เล่น 2 ฝั่ง control strip บาง ๆ ใต้กระดาน (undo / resign / draw) ไม่มี control ใด overlap กระดาน การตั้งค่าเปิดจาก menu ≥ 3 tap ออกไป

**Pattern borrowed — Contextual status pill:**
ชิป turn indicator + check/checkmate status แสดงเป็น pill เล็กชิดขอบ ไม่บังพื้นที่เดิน เปลี่ยนสีอัตโนมัติเมื่อเกิดเหตุการณ์พิเศษ (รุก = ส้ม, รุกจน = แดง)

---

### Reference 2: Lichess Mobile (Flutter, open-source)
https://lichess.org / https://github.com/lichess-org/mobile

**Pattern borrowed — Deliberate minimalism + two-layer separation:**
หน้าจอเกมมี control น้อยมาก: flip board, undo, resign อยู่ใน action bar บาง ๆ ด้านล่าง ส่วนที่เหลือ (sound, theme, time control) ซ่อนอยู่ใน bottom-sheet/modal ที่เปิดจากไอคอน settings มุมบน วิธีนี้ทำให้กระดานเป็น "stage" เดียว

**Pattern borrowed — Move history drawer:**
ประวัติการเดิน (move list) พับเก็บเป็น horizontal scroll strip ใต้กระดาน กด tap ขยายเป็น full-sheet ไม่บัง viewport ขณะเล่น

---

### Reference 3: Royal Chess — 3D Chess Game (App Store premium 3D board)
ตัวแทนประเภท: premium 3D board game บน mobile (Royal Chess / Chess 3D Ultimate บน iOS)
https://apps.apple.com/us/app/chess-play-learn/id329218549 (Chess.com premium 3D mode)

**Pattern borrowed — Gear drawer as single entry point:**
ปุ่ม ⚙️ มุมบนขวาเป็น single entry point สำหรับทุก setup option (ธีม เสียง ความยาก) เปิดเป็น bottom-sheet แบบ slide-up ทับกระดานเพียงบางส่วนด้านล่าง กระดาน 3D dimmed แต่ยังมองเห็น

**Pattern borrowed — Player info bar (top + bottom):**
ข้อมูลผู้เล่น 2 ฝั่ง (avatar + ชื่อ + นาฬิกา/ธีม) อยู่บน-ล่างกระดาน flush กับขอบหน้าจอ ไม่ซ้อนกัน เพิ่ม persona ให้เกมโดยไม่กินพื้นที่

---

## 2. โครงสร้าง Layout ใหม่ (Mobile Portrait 390 × 844)

```
┌──────────────────────────────────┐  ← safe-area-top (notch)
│  [♟ หมากรุกไทย 3D]    [⚙️] [?]  │  ← topbar 52px
├──────────────────────────────────┤
│                                  │
│   STATUS PILL: "ตาขาว  •  รุก!" │  ← status area 40px
│                                  │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │   THREE.js CANVAS (3D)     │  │  ← Board: สี่เหลี่ยมจัตุรัส
│  │   เต็ม viewport กว้าง      │  │    calc(100vw - 24px)²
│  │   ไม่ถูก overlap           │  │    centered, 12px margin
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  [↩ ย้อน]  [♻ เกมใหม่]          │  ← action bar 60px
│                                  │
└──────────────────────────────────┘  ← safe-area-bottom
```

**Board**: `width: min(calc(100vw - 24px), calc(100vh - 220px))` → สี่เหลี่ยมจัตุรัส, centered  
ไม่มี control ใดอยู่ใน board zone

---

## 3. Settings Bottom-Sheet (เปิดจาก ⚙️)

```
┌──────────────────────────────────┐
│  ┌──── drag handle ────┐         │
│                                  │
│  โหมดเกม                         │  ← Section header (12px muted)
│  [ 2 คน | vs AI | ออนไลน์ ]      │  ← seg control 44px tall
│                                  │
│  ─── แสดงเมื่อ vs AI ────────── │
│  ระดับ AI                        │
│  [ ง่าย | กลาง | ยาก ]           │
│  เลือกฝ่าย                       │
│  [ ขาว | ดำ ]                    │
│                                  │
│  ─── แสดงเมื่อ ออนไลน์ ───────── │
│  [ สร้างห้อง ]  [____] [เข้าร่วม]│
│                                  │
│  ธีมหมาก — ฝ่ายขาว               │  ← labeled clearly
│  [ dropdown ขาว/กระดาน ▼ ]  [✨] │
│  ธีมหมาก — ฝ่ายดำ                │
│  [ dropdown ดำ         ▼ ]       │
│                                  │
│  เสียง                           │
│  [ dropdown ชุดเสียง ▼ ] [🔊] ━━━│  ← volume slider
│                                  │
│  [ เริ่มเกมใหม่ (primary) ]       │  ← sticky ใน sheet
└──────────────────────────────────┘
```

Sheet behavior:
- `height: auto` max 80vh, scroll ภายใน sheet
- drag handle 40×4px radius 2px centered
- backdrop: rgba(3,5,10,0.55) blur(4px) — ค่าเดียวกับ .overlay ที่มีอยู่
- dismiss: tap backdrop หรือ swipe down

---

## 4. Piece-Legend / How-to Affordance

ปุ่ม `[?]` มุมบนขวา (ข้าง ⚙️) เปิด bottom-sheet "ตำนานหมาก" แสดง grid 7 ชิ้น (ขุน ราชินี/เม็ด ช้าง ม้า เรือ เบี้ย) พร้อมรูปและชื่อ เหมาะกับธีม robot/hero/ตำนาน

---

## 5. Component Inventory

| Component | ขนาด | สี/token | สถานะ |
|---|---|---|---|
| Topbar | h:52px padding:env(safe-area-inset-top) + 8px | `--panel` bg | static |
| Brand chip | h:36px px:14px | `--panel` border `--border` | static |
| Gear button | 44×44px radius:12px | `--panel` | tap → open sheet |
| Help button | 44×44px radius:12px | `--panel` | tap → open legend |
| Status pill | h:36px px:14px radius:12px | bg `--panel` | color by kind: normal=`--muted`, check=#ff8a4c, over=`--accent`, thinking=`--accent2` |
| Turn badge | 16×16px radius:50% border 2px | white=#f3f5f8 / black=#1c2128 | changes per setTurn() |
| Board zone | square min(vw-24, vh-220) | none (canvas underneath) | no overlap constraint |
| Action bar | h:60px px:16px | transparent | bottom safe-area aware |
| Undo btn | min-w:100px h:44px | `--panel` `--border` | btn class |
| New-game btn | min-w:140px h:44px | btn primary (yellow gradient) | btn.primary class |
| Bottom-sheet | max-h:80vh radius-top:20px | `--panel-solid` `--border` | slide-up anim 300ms ease |
| Sheet section label | 12px `--muted` font-weight:700 | | static |
| Seg control | h:44px per-btn min 80px | active=`--accent2` gradient | segbtn / segbtn.active |
| Select dropdown | h:40px w:100% | existing .select | grouped under labeled row |
| AI Theme btn | 44×44px | .btn | ✨ icon only on mobile |
| Mute btn | 44×44px | .btn.icon | toggled .muted class |
| Volume slider | w:100% h:44px touch area | accent-color:`--accent` (orange) | .range |
| Drag handle | 40×4px radius:2px | rgba(255,255,255,0.2) | visual only |

---

## 6. การ Map กับโครงสร้าง hud.ts + styles.css ที่มีอยู่

### hud.ts — ไม่ต้องเปลี่ยน logic มาก

| เดิม | ใหม่ | หมายเหตุ |
|---|---|---|
| `topbar` | คงเดิม | เพิ่ม gear btn + help btn |
| `dock` → `position:absolute bottom` | แยกเป็น 2 ส่วน: `action-bar` (bottom) + `settings-sheet` (hidden) | dock class ถูกแทนที่ |
| `modeSeg, diffWrap, aiSideWrap, onlineWrap, themeWrap, blackWrap, soundWrap` | ย้ายเข้า `.settings-sheet` ทั้งหมด | ห่อใน section divs |
| `newBtn, undoBtn` | ย้ายเข้า `.action-bar` | แสดงตลอดเวลา |
| `sidepanel` | hidden บน mobile (ยังซ่อนอยู่ at max-width:820px) | ไม่เปลี่ยน |
| `overlay` | คงเดิม | game-over overlay ทำงานเหมือนเดิม |

### styles.css — เพิ่ม/แก้ไข

```css
/* เพิ่ม */
.action-bar { position:absolute; bottom:env(safe-area-inset-bottom,0); left:0; right:0; ... }
.settings-sheet { position:absolute; bottom:0; left:0; right:0; max-height:80vh; ... }
.settings-sheet.open { transform:translateY(0); }
.sheet-section { margin-bottom:16px; }
.sheet-section-label { font-size:12px; color:var(--muted); ... }

/* แก้ไข */
.dock → ไม่ใช้แล้ว (หรือเปลี่ยนชื่อเป็น .action-bar)
@media (max-width:820px) เพิ่ม rule ซ่อน .settings-sheet เริ่มต้น
```

### JavaScript ที่ต้องเพิ่มใน hud.ts
```ts
// gear button toggle
gearBtn.addEventListener('click', () => sheet.classList.toggle('open'));
backdropEl.addEventListener('click', () => sheet.classList.remove('open'));
// touch swipe-down to close (touchstart/touchmove/touchend)
```

---

## 7. Accessibility Notes

- touch target ทุก interactive element ≥ 44×44px (WCAG 2.5.5)
- status pill เปลี่ยนสีพร้อมข้อความ (ไม่ใช้สีอย่างเดียว)
- font-size ≥ 13px ทุก label; section label 12px ยอมรับได้เพราะเป็น secondary
- sheet backdrop มี click-to-close (ไม่ต้องหา close button)
- volume slider มี label "เสียง" และ mute button อยู่ใกล้กัน
- env(safe-area-inset-*) ใช้กับ topbar และ action-bar ป้องกัน notch / home indicator
- contrast: white text (#eef2f7) บน --panel (rgba 18,22,30,0.72) ผ่าน WCAG AA
- drag handle บน sheet ช่วย discoverability สำหรับ swipe gesture

---

---

# v2 Changes — มุก · 2026-06-23

การแก้ไข 4 จุดตามที่เจ้าของโปรเจกต์ร้องขอ

---

## v2-1. Atmospheric Environment Around the Board ("บรรยากาศสมจริง")

### เหตุผลการออกแบบ

v1 ใช้ radial-gradient มืด ๆ เป็น background เรียบ ๆ ซึ่งทำให้กระดาน 3D ดูลอยอยู่กลางความว่างเปล่า ไม่มี "โลก" ล้อมรอบ ทำให้ theme ที่เลือกสำหรับหมากไม่ส่งผลต่อ atmosphere ของหน้าจอเลย v2 เพิ่ม per-theme backdrop ที่สร้างความรู้สึก "อยู่ในสถานที่" โดยไม่กลบ legibility ของ HUD

### 3 ธีมที่ออกแบบ

**ตำนานไทย (theme-legend)**
- พื้นหลัง: warm amber-brown gradient จากบนลงล่าง (#1a0e04 → #2e1508 → #05060a)
- silhouette SVG inline: หลังคาวัด/ปราสาท เรียงซ้อนกัน 2 ระดับ ท้องฟ้าสีทอง
- glow: radial-gradient สีทองอ่อน (rgba 255,180,60,0.18) ลอยตรงกลางบน filter:blur(20px)
- ธีม: temple at sunset, ให้ความรู้สึกเกมหมากรุกไทยดั้งเดิม

**อวกาศ/หุ่นยนต์ (theme-space)**
- พื้นหลัง: deep navy-black, radial nebula สีม่วง (rgba 100,30,160,0.35) + สีน้ำเงิน (rgba 30,10,90,0.45)
- star field: 20 จุดขนาด 1–1.5px กระจายด้วย background-image radial-gradient จุดเล็ก ๆ ไม่ต้องใช้ canvas
- nebula blob: radial-gradient ม่วง blur(30px) ลอยมุมบน
- ธีม: deep-space sci-fi เข้ากับธีมหุ่นยนต์/ไซไฟ

**ฮีโร่ (theme-hero)**
- พื้นหลัง: dusk navy-blue gradient (#0a1020 → #1e3050 → #0a1020)
- city skyline SVG inline: ตึกสูงหลากขนาด สีดำเกือบทึบ เรียงซ้อนกัน เหมือน Gotham at dusk
- dusk glow: radial-gradient ส้มอ่อน + น้ำเงิน blur(25px) แนวขอบฟ้า
- ธีม: superhero / vigilante night city

### Legibility Protection

- `.board-vignette`: dark radial vignette (transparent center → rgba(5,6,10,0.82) edge) ครอบทุกธีม ป้องกันสีขอบสว่างเกิน
- `.board-vignette::before`: linear-gradient ทึบลงจากบน (200px) คลุมบริเวณ player bars + topbar
- `.board-vignette::after`: linear-gradient ทึบขึ้นจากล่าง (180px) คลุม action bar
- HUD elements ทั้งหมดมี `backdrop-filter: blur(12px)` + `--panel` background อยู่แล้ว → อ่านได้ทุกธีม

### การ Implement จริง (boardView.ts / Three.js)

`EnvironmentStyle` ที่มีอยู่แล้วในโปรเจกต์มี field: `background`, `backdrop`, `fog`, `lights`
**ขยายเพิ่ม** field `backdropLayer` ที่รองรับ 3 วิธี:

```ts
interface EnvironmentStyle {
  // เดิม
  background: string;
  fog: THREE.FogExp2 | null;
  lights: LightConfig[];

  // v2 เพิ่ม
  backdropLayer: {
    type: 'gradient-css' | 'skybox-equirect' | 'ai-image';
    // gradient-css: inject CSS class ชื่อ theme-* ลงใน #board-bg div
    cssClass?: string;
    // skybox-equirect: load texture จาก URL (1 HDR หรือ equirectangular PNG)
    skyboxUrl?: string;
    // ai-image: รับ URL จาก image-gen pipeline ที่มีอยู่แล้ว
    aiImageUrl?: string;
    // ground plane color (สีพื้นที่เห็นใต้กระดาน 3D)
    groundColor?: number;
  };
}
```

**วิธีที่แนะนำสำหรับ mobile:**

1. **gradient-css (ใช้ทันที, 0 network cost)** — inject CSS class บน `<div id="board-bg">` เหมือน mockup ใช้กับธีม legend/space/hero ได้เลย เหมาะ MVP

2. **skybox-equirect (ภาพสวยกว่า, ~200–400KB/ธีม)** — โหลด equirectangular texture ด้วย `THREE.TextureLoader`, set `scene.background = texture` เหมาะธีมที่ต้องการ 360° wrap รอบกระดาน ควร lazy-load + cache

3. **ai-image backdrop (premium, ต้องมี image-gen pipeline)** — ส่ง prompt เช่น "Thai temple at golden sunset, low-detail background, dark vignette, game backdrop" ไปยัง pipeline เดิม รับ URL กลับมา ใช้เป็น CSS `background-image` หรือ Three.js plane mesh หลังกระดาน

**Mobile performance note:**
- gradient-css: 0ms render overhead (GPU composite)
- skybox texture: ควรใช้ format JPEG ≤512×256px สำหรับ equirect, หรือ WebP ≤1024×512px สำหรับ quality สูงขึ้น
- AI image: load once, cache localStorage หรือ IndexedDB, แสดง gradient fallback ระหว่างโหลด
- ไม่ควรใช้ HDR/EXR บน mobile เพราะ decode overhead สูง ใช้ pre-baked PNG/WebP แทน

**Piece readability:** backdrop อยู่ใน `scene.background` หรือ `<div>` หลัง `<canvas>` เสมอ ไม่มีผลต่อ Three.js lighting ที่ใช้ render หมาก กระดาน และ piece materials ยังคง contrast เต็มที่

---

## v2-2. Player Bars (Top + Bottom), Chess.com Style

### เหตุผลการออกแบบ

v1 ใช้ status pill กลางหน้าจอเป็น turn indicator เพียงอย่างเดียว ไม่มีข้อมูลผู้เล่น ไม่มีนาฬิกา ไม่มี captured pieces v2 เพิ่ม player bar 2 แถบ (52px สูง) flush กับกระดานด้านบน-ล่าง อ้างอิง chess.com + lichess ที่พิสูจน์แล้วว่า layout นี้ไม่ทำให้กระดานแคบลงอย่างมีนัยสำคัญ แต่เพิ่ม persona และ context ของเกมชัดเจนขึ้น

### Anatomy ของ Player Bar

```
[ avatar ] [ ชื่อ + label ฝ่าย ]  [ captured pieces tray ]  [ mm:ss ]
  32×32px    13px bold / 10px muted   12px emoji ×n             14px tabular
```

- **avatar**: 32×32px ใช้ emoji โดย default (🤖 AI, 👤 player, 🌐 online opponent) เปลี่ยนเป็น URL photo ได้ใน online mode
- **ชื่อ**: "คุณ" / "AI ระดับกลาง" / "player code" ตามโหมด
- **turn badge**: dot 8×8px สีขาว/ดำ ข้างชื่อ (ยังคง design language เดิม)
- **captured-tray**: emoji ขนาด 12px แสดงหมากที่จับได้ + material delta (+2, +3 สีทอง)
- **clock**: `mm:ss` tabular-nums ขนาด 14px; state: default (muted) / ticking (accent yellow) / low-time (check orange + pulse animation)

### Active Turn Highlight

แถบที่เป็น turn จะมี `border-color: var(--accent2)` + `box-shadow: 0 0 0 1px rgba(58,160,255,0.25)` — เป็น visual primary ของ turn indicator แทน status pill เดิม (status pill ยังอยู่แต่แสดงเฉพาะตอน "รุก!" เท่านั้น)

### Flip Board Button

ปุ่ม ⇅ (52×52px) วางใน action bar ซ้ายสุด หมุน 180deg เมื่อกด ส่งสัญญาณ CSS `transform` ให้ user เห็น feedback ทันที ใน production เรียก `boardView.flipBoard()` ที่ rotate camera position ใน Three.js

### Mode Labels

| โหมด | Top bar label | Bottom bar label |
|---|---|---|
| 2 คน (local) | ผู้เล่น 2 / ฝ่ายดำ | ผู้เล่น 1 / ฝ่ายขาว |
| vs AI | AI ระดับกลาง / ฝ่ายดำ | คุณ / ฝ่ายขาว |
| ออนไลน์ | รหัสคู่แข่ง / ฝ่ายดำ | คุณ / ฝ่ายขาว |

### Map กับ hud.ts

```ts
// เพิ่ม elements
const playerBarTop    = document.getElementById('player-bar-top');
const playerBarBottom = document.getElementById('player-bar-bottom');
const clockTop        = document.getElementById('clock-top');
const clockBottom     = document.getElementById('clock-bottom');
const capturedTop     = document.getElementById('captured-top');
const capturedBottom  = document.getElementById('captured-bottom');

// setTurn() เดิม — เพิ่ม
function setTurn(side: 'white' | 'black') {
  playerBarBottom.classList.toggle('active-turn', side === 'white');
  playerBarTop.classList.toggle('active-turn',    side === 'black');
  clockBottom.classList.toggle('ticking', side === 'white');
  clockTop.classList.toggle('ticking',    side === 'black');
  // status pill ยังคง setCheck() เหมือนเดิม
}

// updateCaptured(side, pieces[]) — ใหม่
function updateCaptured(side: 'white' | 'black', pieces: PieceType[]) {
  const tray = side === 'white' ? capturedBottom : capturedTop;
  tray.innerHTML = pieces.map(p => pieceEmoji(p)).join('') + materialDeltaHTML(pieces);
}
```

---

## v2-3. Quick-Start Landing State

### เหตุผลการออกแบบ

v1 เปิดขึ้นมาแล้วเห็น in-game UI ทันที ผู้ใช้ครั้งแรกไม่รู้ว่าต้องทำอะไรก่อน และถ้าต้องการเริ่มเกมเลยก็ไม่มีทางลัด ต้องเปิด settings sheet ก่อน v2 เพิ่ม "landing state" — overlay โปร่งใสครึ่งนึงที่ทับบน board ที่ยังหมุน 3D อยู่เบื้องหลัง ให้ความรู้สึก "ready to play" ทันที

### Layout

```
         [ ♟ ]              ← logo emoji 44px
   หมากรุกไทย 3D            ← title 20px bold
  เลือกโหมดแล้วเริ่มเลย     ← subtitle 12px muted

  [ ▶ เล่นเลย (240px) ]     ← primary CTA 60px yellow gradient

  [ 🤖 vs AI ] [ 🌐 ออนไลน์ ] [ ⚙ ตั้งค่า ]  ← secondary 78×72px each
```

- **backdrop**: rgba(5,6,10,0.55) blur(2px) — โปร่งพอที่กระดาน 3D เบื้องหลังยังมองเห็นเป็น atmosphere แต่ไม่รบกวน text
- **"▶ เล่นเลย"**: กด dismiss overlay แล้วเริ่ม 2-player ทันที (mode ที่ simple ที่สุด)
- **ปุ่ม secondary**: กด dismiss แล้ว pre-select mode ใน settings sheet เปิดขึ้นมาอัตโนมัติ
- **ไม่มี forced setup**: ผู้ใช้ที่แค่อยากเล่น tap เดียวเริ่มได้เลย ไม่ต้องผ่าน settings

### Behavior หลัง dismiss

ระบบจำโหมดล่าสุดด้วย localStorage `makruk_lastMode` หากมีค่าอยู่ landing ยังแสดง แต่ "▶ เล่นเลย" จะ resume โหมดนั้นแทน 2-player default

### Map กับ hud.ts

```ts
// เพิ่ม element
const quickstartOverlay = document.getElementById('quickstart-overlay');

// เรียกตอน app load (หลัง init board)
function showLanding() {
  quickstartOverlay.style.display = 'flex';
}

// ▶ เล่นเลย
qsPlayBtn.addEventListener('click', () => {
  quickstartOverlay.style.display = 'none';
  startGame({ mode: localStorage.getItem('makruk_lastMode') ?? '2p' });
});

// vs AI shortcut
qsAiBtn.addEventListener('click', () => {
  quickstartOverlay.style.display = 'none';
  openSettingsSheet();
  preselectMode('ai');
});
```

---

## v2-4. In-Game Extras: Move History + Hint

### เหตุผลการออกแบบ

Move history ช่วยให้ผู้เล่นทบทวนการเดินที่ผ่านมาและเรียนรู้จากเกม เป็น feature มาตรฐานของแอปหมากรุกทุกตัว (chess.com, lichess) แต่ถ้าแสดงเต็มจอจะบังกระดาน v2 ใช้ 2-tier approach: strip บาง ๆ แสดงเสมอ, full drawer เปิดเมื่อต้องการ

Hint ช่วยผู้เล่นมือใหม่ที่ยังไม่รู้กลยุทธ์ วางเป็นปุ่มเล็ก ๆ ใน action bar ไม่รบกวน flow ปกติ

### Move History Strip (32px)

```
[ 1. ง5–ง4   จ8–ง7   2. ม1–ง3   ช1–ช4 ▶ ]
  ← overflow hidden, latest move accent blue →
```

- วางต่ำกว่า top player bar 6px (`top: calc(safe-top + 158px)`)
- height 32px — ไม่กินพื้นที่กระดาน (กระดาน 3D เริ่มต้นประมาณ top:200px)
- horizontal overflow hidden (ตัดขวา)
- latest move ใช้สี `--accent2` (blue) เพื่อบอกว่าเป็น move ล่าสุด
- tap ทั้ง strip → เปิด history-sheet (full drawer, max-height 60vh)

### History Full Sheet

```
┌──────────────────────────────────┐
│  ประวัติการเดิน           [✕]    │
├──────────────────────────────────┤
│  1   ง5–ง4        จ8–ง7          │
│  2   ม1–ง3        ม8–ง6          │
│  3   ช1–ข2        ง7–ง5          │
│ [4]  ช1–ช4 ←     —              │  ← current move highlighted
└──────────────────────────────────┘
```

- notation: สัญลักษณ์ไทย คอลัมน์ ก–ฉ, แถว 1–8 (เช่น "ง5–ง4")
- ถ้าต้องการในอนาคต: tap ที่ move เพื่อ jump back ดู board state ณ นั้น (tabbed review mode)

### Hint Button

- ตำแหน่ง: action bar ขวาสุด (52×52px) icon 💡
- กด: highlight ช่องที่แนะนำบนกระดาน 3D (เช่น pulse glow สีทอง 1 วิ) + tooltip ข้อความสั้น
- production: เรียก AI engine (`getHint(board)`) ซึ่ง engine มีอยู่แล้วในโปรเจกต์ (Fairy-Stockfish หรือ custom minimax)
- ใช้ throttle 3 วิ/ครั้ง เพื่อไม่ให้ user spam engine call

### ไม่บังกระดาน

| Element | ตำแหน่ง | เหตุผล |
|---|---|---|
| move strip | top:158px height:32px | อยู่เหนือกระดาน (กระดาน~top:200px) |
| hint button | action bar ล่างสุด | อยู่ใต้กระดานเสมอ |
| history full sheet | bottom-sheet max-h:60vh | slide up from bottom, กระดานยังเห็นบน ~40vh |

### Map กับ hud.ts

```ts
// move history
const moveStrip  = document.getElementById('move-history-strip');
const histSheet  = document.getElementById('history-sheet');

function appendMove(moveNum: number, white: string, black: string | null) {
  // เพิ่ม entry ใน strip (DOM + history array)
  // scroll strip to right เพื่อแสดง latest
  moveStrip.scrollLeft = moveStrip.scrollWidth;
  // เพิ่ม row ใน history table
}

// hint
const hintBtn = document.getElementById('hint-btn');
let hintThrottle = false;
hintBtn.addEventListener('click', async () => {
  if (hintThrottle) return;
  hintThrottle = true;
  const move = await aiEngine.getHint(currentBoard);
  boardView.highlightHint(move);        // glow effect ใน Three.js
  setTimeout(() => { hintThrottle = false; }, 3000);
});
```

---

## v2 Component Inventory (เพิ่มเติมจาก v1)

| Component | ขนาด | สี/token | สถานะ |
|---|---|---|---|
| `.board-bg.theme-*` | 100% inset z:0 | per-theme gradient + SVG silhouette | swap class on theme change |
| `.board-vignette` | 100% inset z:3 pointer-events:none | radial + linear gradient dark | always on |
| `.player-bar` | h:52px radius:14px | `--panel` blur:12px | top + bottom |
| `.player-bar.active-turn` | h:52px | border `--accent2` + box-shadow | CSS class toggle |
| `.player-avatar` | 32×32px radius:50% | rgba(255,255,255,0.10) | emoji default |
| `.captured-tray` | flex overflow:hidden | 12px emoji | updateCaptured() |
| `.player-clock` | 56px min-w tabular | muted / ticking accent / low-time check | setClockState() |
| `.player-clock.low-time` | same | check orange + pulse anim | < 30s remaining |
| `.move-history-strip` | h:32px radius:10px | rgba(12,16,24,0.72) blur:8px | tap → open history-sheet |
| `.history-sheet` | max-h:60vh | `--panel-solid` | slide-up anim |
| `.history-row.current-row` | — | accent2 bg 6% | current move |
| `.hint-btn` | 52×52px radius:14px | accent yellow 10% | throttle 3s |
| `.flip-btn` | 52×52px radius:14px | `--panel` | rotate(180deg) on click |
| `.quickstart-overlay` | 100% inset z:60 | rgba(5,6,10,0.55) blur:2px | display:flex on load |
| `.qs-play-btn` | 240×60px radius:18px | accent yellow gradient | primary CTA |
| `.qs-secondary-btn` | 78×72px radius:16px | `--panel` blur:12px | 3 buttons row |

---

## v2 References เพิ่มเติม

- Chess.com Mobile UI Kit (Figma Community): https://www.figma.com/community/file/1387489577727434401/chess-com-app-ui-free-ui-kit-recreated
- Chess.com wireframe analysis: https://medium.com/@nicololongato/chess-coms-mobile-app-a-wireframe-analysis-3067fc632446
- Three.js Backgrounds and Skyboxes: https://threejs.org/manual/en/backgrounds.html
- Three.js procedural sky system: https://discourse.threejs.org/t/complete-sky-system-for-three-js-skybox-sun-moon-day-night-cycle-clouds-stars-lensflares/88311

---

## v2 Layout Diagram (Updated)

```
┌──────────────────────────────────┐  ← safe-area-top
│  [♟ หมากรุกไทย 3D]    [?] [⚙]  │  ← topbar 52px (z:20)
│                                  │
│  [ 🤖 AI ระดับกลาง ♟♟♝ +2 05:00]│  ← player-bar-top 52px (z:20)
│  [ 1.ง5–ง4 จ8–ง7 2.ม1–ง3 ช1–ช4▶]│  ← move-history-strip 32px (z:20)
│                                  │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │   THREE.js CANVAS (3D)     │  │  ← board ~286×286px centered
│  │   + atmospheric backdrop   │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  [ 👤 คุณ ♞♟ 04:32 ● ]          │  ← player-bar-bottom 52px active (z:20)
│                                  │
│  [⇅] [↩ ย้อน] [♻ เกมใหม่] [💡] │  ← action-bar 52px (z:20)
└──────────────────────────────────┘  ← safe-area-bottom

layer stack (z-index):
  z:0   .board-bg (atmospheric gradient + SVG silhouette)
  z:3   .board-vignette (dark overlay + top/bottom scrims)
  z:4   .board-3d-placeholder / Three.js canvas
  z:10  .ui-overlay (pointer-events:none wrapper)
  z:20  all HUD elements (topbar, player bars, strip, action-bar)
  z:30  .sheet-backdrop
  z:40  .settings-sheet / .legend-sheet
  z:41  .legend-sheet
  z:42  .history-sheet
  z:50  .gameover-overlay
  z:60  .quickstart-overlay (landing state)
```
