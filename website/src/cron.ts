export interface Env {
  FREE_MODELS_KV: KVNamespace;
  CRON_SECRET?: string;
}

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const KV_KEY = "openrouter:free-models:latest";

interface Model {
  id: string;
  name: string;
  context_length: number | null;
}

interface StoredPayload {
  updatedAt: string;
  count: number;
  models: Model[];
}

function toDecimal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value));
  if (Number.isNaN(n)) return null;
  return n;
}

function isFreePricing(pricing: Record<string, unknown> | null | undefined): boolean {
  if (!pricing || typeof pricing !== "object" || Object.keys(pricing).length === 0) return false;
  let hasNumeric = false;
  for (const v of Object.values(pricing)) {
    const dec = toDecimal(v);
    if (dec === null) continue;
    hasNumeric = true;
    if (dec !== 0) return false;
  }
  return hasNumeric;
}

async function fetchFreeModels(): Promise<Model[]> {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "openrouter-free-models-bot/1.0",
    },
  });
  if (!res.ok) throw new Error(`OpenRouter fetch failed: ${res.status} ${res.statusText}`);
  const payload = (await res.json()) as { data?: unknown };
  const items = Array.isArray(payload.data) ? payload.data : [];
  const models: Model[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const pricing = record["pricing"] as Record<string, unknown> | undefined;
    if (!isFreePricing(pricing)) continue;
    const modelId = record["id"];
    if (typeof modelId !== "string" || !modelId) continue;
    const name = typeof record["name"] === "string" && record["name"] ? (record["name"] as string) : modelId;
    const cl = record["context_length"];
    const contextLength = typeof cl === "number" && Number.isFinite(cl) ? cl : null;
    models.push({ id: modelId, name, context_length: contextLength });
  }
  models.sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()));
  return models;
}

async function fetchWithRetry(attempts = 2): Promise<Model[]> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchFreeModels();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        // brief backoff
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

async function runScheduled(env: Env): Promise<void> {
  const models = await fetchWithRetry(2);
  const payload: StoredPayload = {
    updatedAt: new Date().toISOString(),
    count: models.length,
    models,
  };
  await env.FREE_MODELS_KV.put(KV_KEY, JSON.stringify(payload));
  console.log(`Stored ${models.length} free models at ${payload.updatedAt}`);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await runScheduled(env);
    } catch (e) {
      console.error("Cron failed:", e);
      // Do not overwrite KV on failure — keep previous data
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Manual trigger — protected by CRON_SECRET to avoid unauthenticated abuse
    if (url.pathname === "/__scheduled" && request.method === "POST") {
      if (env.CRON_SECRET) {
        const auth = request.headers.get("authorization");
        const expected = `Bearer ${env.CRON_SECRET}`;
        if (auth !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
      } else {
        // No secret configured — deny manual trigger in production to prevent abuse
        return new Response("manual trigger disabled (set CRON_SECRET)", { status: 403 });
      }
      try {
        await runScheduled(env);
        return new Response("scheduled ok", { status: 200 });
      } catch (e) {
        return new Response(`scheduled failed: ${String(e)}`, { status: 500 });
      }
    }
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }
    return new Response("Not found", { status: 404 });
  },
};
