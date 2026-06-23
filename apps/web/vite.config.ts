import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// ใช้ alias ชี้ไปที่ซอร์ส TS ของ engine โดยตรง
// → Vite/esbuild แปลงให้เอง, แก้ engine แล้ว HMR ทันที, ไม่ต้อง build แยก
export default defineConfig(({ mode }) => ({
  // GitHub Pages เสิร์ฟที่ /<repo>/ → ใช้ base ตอน build production; dev/Vercel ใช้ '/'
  base: mode === 'production' ? '/makruk-3d/' : '/',
  resolve: {
    alias: {
      '@makruk/engine': fileURLToPath(
        new URL('../../packages/engine/src/index.ts', import.meta.url)
      ),
    },
  },
  server: {
    host: true,
    open: false,
  },
}));
