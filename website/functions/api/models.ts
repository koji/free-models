interface Env {
  FREE_MODELS_KV: KVNamespace;
}

const KV_KEY = "openrouter:free-models:latest";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const kv = context.env.FREE_MODELS_KV;
  if (!kv) {
    return new Response(JSON.stringify({ error: "KV binding not configured" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const raw = await kv.get(KV_KEY);
  if (!raw) {
    return new Response(JSON.stringify({ error: "data not yet available" }), {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(raw, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
};
