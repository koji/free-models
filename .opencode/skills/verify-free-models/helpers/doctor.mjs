#!/usr/bin/env node
// Read-only health check. Usage: node helpers/doctor.mjs --run-id ID
import fs from "node:fs";
import path from "node:path";
import { findEdge, parseArgs, pidAlive, readPid, scratchRoot, stateDir, WEBSITE_DIR, WRANGLER_JS } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) { console.log("usage: node helpers/doctor.mjs --run-id ID"); process.exit(0); }
const runId = args["run-id"];
if (!runId) { console.error("usage: node helpers/doctor.mjs --run-id ID"); process.exit(2); }
const failures = [];
const notes = [];

if (process.versions.node < "20") failures.push(`node ${process.version} is older than 20`);
else notes.push(`node ${process.version}`);
if (!fs.existsSync(WRANGLER_JS)) failures.push("wrangler is not installed under website/node_modules");
else notes.push("wrangler present");
const edge = findEdge();
if (!edge) failures.push("no Edge or Chrome binary found");
else notes.push(`browser: ${edge}`);

const state = stateDir(runId);
const pagesPid = readPid(path.join(state, "pages.pid"));
const edgePid = readPid(path.join(state, "edge.pid"));
let port = 8788;
try { port = parseInt(fs.readFileSync(path.join(state, "pages.port"), "utf8").trim(), 10) || 8788; } catch { /* default */ }
let cdp = "http://127.0.0.1:9223";
try { cdp = fs.readFileSync(path.join(state, "edge.cdp"), "utf8").trim() || cdp; } catch { /* default */ }

if (pagesPid === null) failures.push("no pages pidfile; start the server first");
else if (!pidAlive(pagesPid)) failures.push(`pages pid ${pagesPid} is dead; stale pidfile, stop and start fresh`);
else {
  notes.push(`pages pid ${pagesPid} alive`);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/models`);
    const body = await res.json();
    if (res.status === 200 && Array.isArray(body.models)) notes.push(`api seeded with ${body.models.length} models`);
    else if (res.status === 503) notes.push("api answers 503, store is empty");
    else failures.push(`api answered ${res.status} with an unexpected body`);
  } catch (e) {
    failures.push(`pages pid is alive but the port does not answer: ${e.cause?.code || e.message}`);
  }
}
if (edgePid === null) failures.push("no edge pidfile; start the browser first");
else if (!pidAlive(edgePid)) failures.push(`edge pid ${edgePid} is dead; stale pidfile, stop and start fresh`);
else {
  notes.push(`edge pid ${edgePid} alive`);
  try {
    const res = await fetch(`${cdp}/json/version`);
    if (res.ok) notes.push("CDP answers");
    else failures.push(`CDP answered ${res.status}`);
  } catch (e) {
    failures.push(`edge pid is alive but CDP does not answer: ${e.cause?.code || e.message}`);
  }
}

for (const n of notes) console.log(`ok: ${n}`);
if (failures.length > 0) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  console.log("DOCTOR FAIL");
  process.exit(1);
}
console.log("DOCTOR OK");
