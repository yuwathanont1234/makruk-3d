// Supabase Edge Function: generate-theme
// รับ { prompt } → flux-schnell สร้างภาพหมาก 6 ชนิด → Trellis แปลงเป็นโมเดล 3D (GLB) → เก็บใน Storage → คืน manifest { models }
// ต้องตั้ง secret: REPLICATE_API_TOKEN
// หมายเหตุ: image→3D ช้า (อาจ ~นาที/ตัว) — ถ้า 6 ตัวเกิน time limit ของ edge function ให้ทำเป็น background job ภายหลัง
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PIECES = ['khun', 'met', 'khon', 'ma', 'rua', 'bia'];
const ROLE: Record<string, string> = {
  khun: 'the KING',
  met: 'the QUEEN / royal advisor',
  khon: 'the BISHOP / noble',
  ma: 'the KNIGHT (a horse)',
  rua: 'the ROOK / tower',
  bia: 'the PAWN / foot soldier',
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function pollPrediction(token: string, pred: any) {
  while (pred.status && !['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(pred.error || pred.status || 'prediction failed');
  return pred.output;
}

async function genImage(token: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({ input: { prompt, aspect_ratio: '1:1', output_format: 'png', num_outputs: 1 } }),
  });
  const out = await pollPrediction(token, await res.json());
  return Array.isArray(out) ? out[0] : out;
}

function findGlb(output: any): string {
  if (!output) throw new Error('no 3d output');
  if (typeof output === 'string') return output;
  if (output.model_file) return output.model_file;
  if (output.glb) return output.glb;
  for (const v of Object.values(output)) {
    if (typeof v === 'string' && v.includes('.glb')) return v;
  }
  throw new Error('no glb in 3d output');
}

async function genModel(token: string, imageUrl: string): Promise<string> {
  // Trellis: image → 3D GLB
  const res = await fetch('https://api.replicate.com/v1/models/firtoz/trellis/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { images: [imageUrl], texture_size: 1024, mesh_simplify: 0.9, generate_model: true, save_gaussian_ply: false },
    }),
  });
  return findGlb(await pollPrediction(token, await res.json()));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') return json({ error: 'missing prompt' }, 400);
    const token = Deno.env.get('REPLICATE_API_TOKEN');
    if (!token) return json({ error: 'REPLICATE_API_TOKEN not set on the function' }, 500);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const themeId = 'ai-' + crypto.randomUUID().slice(0, 8);

    const entries = await Promise.all(
      PIECES.map(async (pt) => {
        const p = `A single ${prompt}-themed chess piece representing ${ROLE[pt]}, one centered full-body character/object, T-pose if a character, isolated on plain flat light grey background, soft studio lighting, clean game asset, high detail`;
        const img = await genImage(token, p);
        const glb = await genModel(token, img);
        const bytes = new Uint8Array(await (await fetch(glb)).arrayBuffer());
        const path = `${themeId}/${pt}.glb`;
        const up = await sb.storage.from('themes').upload(path, bytes, { contentType: 'model/gltf-binary', upsert: true });
        if (up.error) throw up.error;
        return [pt, sb.storage.from('themes').getPublicUrl(path).data.publicUrl];
      })
    );

    return json({ id: themeId, name: String(prompt).slice(0, 40), models: Object.fromEntries(entries) });
  } catch (e) {
    return json({ error: String(e && (e as any).message ? (e as any).message : e) }, 500);
  }
});
