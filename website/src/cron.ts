export interface Env {
  FREE_MODELS_KV: KVNamespace;
  CRON_SECRET?: string;
}

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models?output_modalities=all";
const KV_KEY = "openrouter:free-models:latest";
const FREE_SUFFIX = ":free";

export const STORED_VERSION = 2;
export const NEW_WINDOW_DAYS = 7;
export const PRUNE_AFTER_DAYS = 30;
const BACKFILL_DAYS = NEW_WINDOW_DAYS + 1;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Model {
  id: string;
  name: string;
  context_length: number | null;
}

export interface TrackedFreeModel {
  id: string;
  name: string;
  context_length: number | null;
  firstSeenAt: string;
}

export interface StoredPayload {
  version: 2;
  updatedAt: string;
  count: number;
  newWindowDays: number;
  models: TrackedFreeModel[];
}

export function backfillTimestamp(now: string): string {
  return new Date(Date.parse(now) - BACKFILL_DAYS * DAY_MS).toISOString();
}

export function isNewPure(firstSeenAt: unknown, nowRef: unknown, windowDays: number = NEW_WINDOW_DAYS): boolean {
  if (typeof firstSeenAt !== "string" || typeof nowRef !== "string") return false;
  const firstMs = Date.parse(firstSeenAt);
  const refMs = Date.parse(nowRef);
  if (!Number.isFinite(firstMs) || !Number.isFinite(refMs)) return false;
  const w =
    typeof windowDays === "number" && Number.isFinite(windowDays) && windowDays >= 0
      ? windowDays
      : NEW_WINDOW_DAYS;
  const diff = refMs - firstMs;
  if (diff < 0) return false;
  return diff <= w * DAY_MS;
}

export function mergeFirstSeen(
  prior: Map<string, string>,
  currentIds: string[],
  now: string,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of currentIds) {
    const prev = prior.get(id);
    if (typeof prev === "string" && Number.isFinite(Date.parse(prev))) out.set(id, prev);
    else out.set(id, now);
  }
  return out;
}

export function pruneRegistry(
  registry: Map<string, string>,
  currentIds: Set<string> | string[],
  now: string,
  maxAbsentDays: number = PRUNE_AFTER_DAYS,
): Map<string, string> {
  const current = currentIds instanceof Set ? currentIds : new Set(currentIds);
  const refMs = Date.parse(now);
  const out = new Map<string, string>();
  for (const [id, stamp] of registry) {
    if (current.has(id)) {
      out.set(id, stamp);
      continue;
    }
    const ms = Date.parse(stamp);
    if (!Number.isFinite(ms) || !Number.isFinite(refMs)) continue;
    if (refMs - ms <= maxAbsentDays * DAY_MS) out.set(id, stamp);
  }
  return out;
}

export function isSmallListDrop(prevCount: number, freshCount: number): boolean {
  return prevCount > 0 && freshCount < prevCount * 0.5;
}

export async function loadPriorCatalog(kv: KVNamespace, now: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const raw = await kv.get(KV_KEY);
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return out;
  const models = (parsed as { models?: unknown }).models;
  if (!Array.isArray(models)) return out;
  const backfill = backfillTimestamp(now);
  for (const item of models) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = record["id"];
    if (typeof id !== "string" || !id) continue;
    const stamp = record["firstSeenAt"];
    if (typeof stamp === "string" && Number.isFinite(Date.parse(stamp))) out.set(id, stamp);
    else out.set(id, backfill);
  }
  return out;
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

function isFreeModel(modelId: unknown, pricing: Record<string, unknown> | null | undefined): boolean {
  if (typeof modelId !== "string" || !modelId.endsWith(FREE_SUFFIX)) return false;
  return isFreePricing(pricing);
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
    const modelId = record["id"];
    const pricing = record["pricing"] as Record<string, unknown> | undefined;
    if (!isFreeModel(modelId, pricing)) continue;
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
  const now = new Date().toISOString();
  const fresh = await fetchWithRetry(2);
  const prior = await loadPriorCatalog(env.FREE_MODELS_KV, now);
  if (isSmallListDrop(prior.size, fresh.length)) {
    console.warn(`Small-list guard: fresh=${fresh.length} prev=${prior.size}, keeping previous flags`);
    return;
  }
  const currentIds = fresh.map((m) => m.id);
  const prunedPrior = pruneRegistry(prior, new Set(currentIds), now);
  let merged: Map<string, string>;
  if (prunedPrior.size === 0) {
    const backfill = backfillTimestamp(now);
    merged = new Map(currentIds.map((id) => [id, backfill] as [string, string]));
  } else {
    merged = mergeFirstSeen(prunedPrior, currentIds, now);
  }
  const tracked: TrackedFreeModel[] = fresh.map((m) => ({
    id: m.id,
    name: m.name,
    context_length: m.context_length,
    firstSeenAt: merged.get(m.id) ?? now,
  }));
  const payload: StoredPayload = {
    version: STORED_VERSION,
    updatedAt: now,
    count: tracked.length,
    newWindowDays: NEW_WINDOW_DAYS,
    models: tracked,
  };
  await env.FREE_MODELS_KV.put(KV_KEY, JSON.stringify(payload));
  console.log(`Stored ${tracked.length} free models at ${payload.updatedAt}`);
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
