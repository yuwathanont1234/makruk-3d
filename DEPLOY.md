# Deploy — เว็บ หมากรุกไทย 3D (PWA)

เว็บเป็น static SPA + PWA (ติดตั้งได้ + เล่นออฟไลน์หลังโหลดครั้งแรก) อยู่ที่ `apps/web`

## Build
```bash
npm run build        # ได้ผลลัพธ์ที่ apps/web/dist/
```
> ค่า Supabase (VITE_SUPABASE_*) จาก `apps/web/.env` จะถูกฝังตอน build อยู่แล้ว (เป็น publishable key ปลอดภัยฝั่ง client) — โหมดออนไลน์จึงใช้งานได้ทันทีหลัง deploy

## ทดสอบโลคัล (เครื่องอื่นใน LAN เล่นด้วยได้)
```bash
npm run preview -w web      # หรือ:  npx serve apps/web/dist -s
```

## Deploy ขึ้นอินเทอร์เน็ต (เลือกอย่างใดอย่างหนึ่ง — ขั้นนี้ต้องล็อกอินบัญชีของคุณ)

### Vercel (แนะนำ)
```bash
cd apps/web
npx vercel            # ครั้งแรกให้ล็อกอิน แล้วตอบตามคำถาม (framework: Vite)
npx vercel --prod     # deploy production
```
มี `vercel.json` ให้แล้ว (rewrite ทุก path → index.html)

### Netlify
```bash
cd apps/web
npx netlify deploy --dir=dist --prod
```

### Cloudflare Pages / GitHub Pages / โฮสต์ static อื่น
อัปโหลดโฟลเดอร์ `apps/web/dist/` ทั้งโฟลเดอร์ และตั้งให้ fallback ทุก route ไปที่ `index.html`

## หมายเหตุ
- เล่นออนไลน์ทำงานผ่าน Supabase (อินเทอร์เน็ต) อยู่แล้ว — หลัง deploy เว็บ ใครก็เปิด URL เล่นกับผู้เล่นบนมือถือ (Expo Go) ได้
- ถ้า build บนโฮสต์ (ไม่ใช่ build โลคัล) ให้ตั้ง env `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ในหน้า settings ของโฮสต์

## นโยบายความเป็นส่วนตัว (ก่อนส่งขึ้นสโตร์)
- มีฉบับร่างที่ [`docs/PRIVACY.md`](docs/PRIVACY.md) (สอดคล้อง PDPA) — ต้องกรอกอีเมลติดต่อจริงแทน `[CONTACT EMAIL PLACEHOLDER]` ก่อนใช้งาน
- เผยแพร่ไฟล์นี้เป็นหน้าเว็บสาธารณะ (เช่นบน GitHub Pages เดียวกับเกม) แล้ว **นำ URL ไปกรอกในช่อง Privacy Policy URL ของทั้ง App Store Connect และ Google Play Console** ก่อนส่งรีวิว — ทั้งสองสโตร์บังคับต้องมี
