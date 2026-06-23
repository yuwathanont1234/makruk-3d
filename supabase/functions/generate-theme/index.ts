// Supabase Edge Function: generate-theme
// รับ { prompt } → flux-schnell สร้างภาพหมาก 6 ชนิด → Trellis แปลงเป็นโมเดล 3D (GLB) → เก็บใน Storage → คืน manifest { models }
// ต้องตั้ง secret: REPLICATE_API_TOKEN
// หมายเหตุ: image→3D ช้า (อาจ ~นาที/ตัว) — ถ้า 6 ตัวเกิน time limit ของ edge function ให้ทำเป็น background job ภายหลัง
import { createClient } from 'jsr:@supabase/supabase-js@2';

const PIECES = ['khun', 'met', 'khon', 'ma', 'rua', 'bia'] as const;
const ROLE: Record<string, string> = {
  khun: 'the KING',
  met: 'the QUEEN / royal advisor',
  khon: 'the BISHOP / noble',
  ma: 'the KNIGHT (a horse)',
  rua: 'the ROOK / tower',
  bia: 'the PAWN / foot soldier',
};

// ---------------------------------------------------------------------------
// CORS allow-list
// Env ALLOWED_ORIGINS: comma-separated list of allowed origins.
// Default covers the GitHub Pages deployment and local dev.
// We echo back the request Origin ONLY if it is in the list; otherwise we
// omit the header entirely so the browser denies cross-origin requests.
// ---------------------------------------------------------------------------
const DEFAULT_ALLOWED_ORIGINS = 'https://yuwathanont1234.github.io,http://localhost:5173';

function buildCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowed = new Set(
    (Deno.env.get('ALLOWED_ORIGINS') ?? DEFAULT_ALLOWED_ORIGINS)
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (requestOrigin && allowed.has(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
    headers['Vary'] = 'Origin';
  }
  // If origin is not in the list the header is omitted → browser blocks CORS.
  return headers;
}

const jsonResp = (obj: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// ---------------------------------------------------------------------------
// Replicate helpers (unchanged logic)
// ---------------------------------------------------------------------------
async function pollPrediction(token: string, pred: any) {
  while (pred.status && !['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    pred = await (
      await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } })
    ).json();
  }
  if (pred.status !== 'succeeded') throw new Error(pred.error || pred.status || 'prediction failed');
  return pred.output;
}

async function genImage(token: string, prompt: string): Promise<string> {
  const res = await fetch(
    'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: { prompt, aspect_ratio: '1:1', output_format: 'png', num_outputs: 1 },
      }),
    },
  );
  const out = await pollPrediction(token, await res.json());
  return Array.isArray(out) ? out[0] : out;
}

function findGlb(output: any): string {
  if (!output) throw new Error('no 3d output');
  if (typeof output === 'string') return output;
  if (output.model_file) return output.model_file;
  if (output.glb) return output.glb;
  for (const v of Object.values(output)) {
    if (typeof v === 'string' && (v as string).includes('.glb')) return v as string;
  }
  throw new Error('no glb in 3d output');
}

async function genModel(token: string, imageUrl: string): Promise<string> {
  // Trellis: image → 3D GLB
  const res = await fetch('https://api.replicate.com/v1/models/firtoz/trellis/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        images: [imageUrl],
        texture_size: 1024,
        mesh_simplify: 0.9,
        generate_model: true,
        save_gaussian_ply: false,
      },
    }),
  });
  return findGlb(await pollPrediction(token, await res.json()));
}

// ---------------------------------------------------------------------------
// Bounded concurrency: process at most `concurrency` items simultaneously.
// This prevents all 6 Replicate calls from firing at once (cost-bomb guard).
// ---------------------------------------------------------------------------
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

// ---------------------------------------------------------------------------
// IP daily rate-limit using public.theme_gen_log(ip, day, count).
// Uses the service-role client so it bypasses RLS.
// Increments the counter atomically via the increment_theme_gen RPC, which
// executes a single INSERT … ON CONFLICT DO UPDATE SET count = count + 1
// in Postgres and returns the new count. This avoids the race condition in the
// previous upsert+read approach and the bug where upsert reset count to 1.
// Fails OPEN: if the RPC errors we log and continue so a missing migration
// doesn't take down the function.
// ---------------------------------------------------------------------------
async function checkAndIncrementRateLimit(
  sb: ReturnType<typeof createClient>,
  ip: string,
  maxPerDay: number,
): Promise<{ limited: boolean; count: number }> {
  try {
    const today = new Date().toISOString().slice(0, 10) as unknown as string; // YYYY-MM-DD

    // Single atomic RPC: INSERT … ON CONFLICT DO UPDATE SET count = count + 1
    // Returns the incremented count as an integer.
    const { data, error } = await (sb as any).rpc('increment_theme_gen', {
      p_ip: ip,
      p_day: today,
    });

    if (error) {
      // Function missing (migration not yet applied) or other DB error — fail-open.
      console.error('increment_theme_gen rpc error (fail-open):', error.message);
      return { limited: false, count: 0 };
    }

    const count: number = typeof data === 'number' ? data : parseInt(String(data), 10) || 1;
    return { limited: count > maxPerDay, count };
  } catch (err) {
    console.error('rate-limit check threw (fail-open):', err);
    return { limited: false, count: 0 };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const cors = buildCorsHeaders(requestOrigin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // --- Prompt validation ---
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResp({ error: 'invalid JSON body' }, 400, cors);
    }

    if (!body.prompt || typeof body.prompt !== 'string') {
      return jsonResp({ error: 'prompt must be a non-empty string' }, 400, cors);
    }
    const prompt = body.prompt.trim();
    if (prompt.length < 3) {
      return jsonResp({ error: 'prompt too short (minimum 3 characters)' }, 400, cors);
    }
    if (prompt.length > 200) {
      return jsonResp({ error: 'prompt too long (maximum 200 characters)' }, 400, cors);
    }

    // --- REPLICATE_API_TOKEN guard (keep existing 500 behaviour) ---
    const token = Deno.env.get('REPLICATE_API_TOKEN');
    if (!token) {
      return jsonResp({ error: 'REPLICATE_API_TOKEN not set on the function' }, 500, cors);
    }

    // --- Supabase service-role client ---
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- IP rate-limit ---
    const rawIp = req.headers.get('x-forwarded-for') ?? 'unknown';
    const clientIp = rawIp.split(',')[0].trim() || 'unknown';
    const maxPerDay = parseInt(Deno.env.get('MAX_GEN_PER_IP_PER_DAY') ?? '5', 10);

    const { limited, count } = await checkAndIncrementRateLimit(sb, clientIp, maxPerDay);
    if (limited) {
      return jsonResp(
        { error: `rate limit exceeded: ${count} generations today (max ${maxPerDay})` },
        429,
        cors,
      );
    }

    const themeId = 'ai-' + crypto.randomUUID().slice(0, 8);

    // --- Process pieces with bounded concurrency (max 2 at a time) ---
    // Hard-cap to the 6 known piece types — PIECES is exactly 6 items.
    const pieces = PIECES.slice(0, 6);

    const entries = await mapWithConcurrency(
      pieces,
      2, // max concurrent Replicate calls
      async (pt) => {
        const p = `A single ${prompt}-themed chess piece representing ${ROLE[pt]}, one centered full-body character/object, T-pose if a character, isolated on plain flat light grey background, soft studio lighting, clean game asset, high detail`;
        const img = await genImage(token, p);
        const glb = await genModel(token, img);
        const bytes = new Uint8Array(await (await fetch(glb)).arrayBuffer());
        const storagePath = `${themeId}/${pt}.glb`;
        const up = await sb.storage
          .from('themes')
          .upload(storagePath, bytes, { contentType: 'model/gltf-binary', upsert: true });
        if (up.error) throw up.error;
        return [pt, sb.storage.from('themes').getPublicUrl(storagePath).data.publicUrl] as [
          string,
          string,
        ];
      },
    );

    return jsonResp(
      { id: themeId, name: prompt.slice(0, 40), models: Object.fromEntries(entries) },
      200,
      cors,
    );
  } catch (e) {
    // Rebuild cors in case requestOrigin reference is needed (same req)
    return jsonResp(
      { error: String(e && (e as any).message ? (e as any).message : e) },
      500,
      cors,
    );
  }
});
