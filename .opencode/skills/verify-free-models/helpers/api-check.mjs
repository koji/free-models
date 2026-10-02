#!/usr/bin/env node
// Asserts the /api/models contract. Usage:
//   node helpers/api-check.mjs --base http://127.0.0.1:8788 --mode seeded|empty [--show-body]
import { parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) { console.log("usage: node helpers/api-check.mjs --base URL --mode seeded|empty [--show-body]"); process.exit(0); }
const base = (args.base || "").replace(/\/$/, "");
const mode = args.mode;
if (!base || (mode !== "seeded" && mode !== "empty")) {
  console.error("usage: node helpers/api-check.mjs --base URL --mode seeded|empty [--show-body]");
  process.exit(2);
}
const failures = [];
function check(name, cond, detail = "") {
  console.log(`${cond ? "ok" : "FAIL"}: ${name}${detail ? " (" + detail + ")" : ""}`);
  if (!cond) failures.push(name);
}

const res = await fetch(`${base}/api/models`);
const text = await res.text();
let body = null;
try { body = JSON.parse(text); } catch { /* stays null */ }
if (args["show-body"]) console.log(text);

if (mode === "seeded") {
  check("status is 200", res.status === 200, `got ${res.status}`);
  check("content-type is json", (res.headers.get("content-type") || "").includes("application/json"));
  check("cache header is public 10m", res.headers.get("cache-control") === "public, max-age=600", res.headers.get("cache-control") || "missing");
  check("body parses", body !== null);
  if (body !== null) {
    check("models is an array", Array.isArray(body.models));
    check("count matches models length", body.count === (body.models || []).length, `count=${body.count}`);
    for (const m of body.models || []) {
      const goodId = typeof m.id === "string" && m.id.length > 0;
      const goodName = typeof m.name === "string";
      const goodCtx = typeof m.context_length === "number" || m.context_length === null;
      if (!goodId || !goodName || !goodCtx) { check(`model entry well-formed (${m.id})`, false); break; }
    }
    if (Array.isArray(body.models)) check(`all ${body.models.length} model entries well-formed`, true);
  }
} else {
  check("status is 503", res.status === 503, `got ${res.status}`);
  check("body carries error", body !== null && typeof body.error === "string", body && body.error);
  check("cache header is no-store", res.headers.get("cache-control") === "no-store", res.headers.get("cache-control") || "missing");
}

if (failures.length > 0) { console.log("API FAIL"); process.exit(1); }
console.log("API PASS");
