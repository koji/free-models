#!/usr/bin/env node
// Starts and stops verification instances. Usage:
//   node helpers/serve.mjs start --target pages --run-id ID [--port 8788]
//   node helpers/serve.mjs start --target edge --run-id ID [--cdp-port 9223]
//   node helpers/serve.mjs stop --run-id ID
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { findEdge, parseArgs, pidAlive, readPid, scratchRoot, stateDir, waitForHttp, WEBSITE_DIR, WRANGLER_JS } from "./lib.mjs";

function usage() {
  console.log("usage: node helpers/serve.mjs start|stop --target pages|edge --run-id ID [--port 8788] [--cdp-port 9223]");
  process.exit(2);
}

function pidFile(state, target) {
  return path.join(state, `${target}.pid`);
}

async function startPages(args) {
  const runId = args["run-id"];
  const port = parseInt(args.port || "8788", 10);
  const state = stateDir(runId);
  fs.mkdirSync(path.join(state, "persist"), { recursive: true });
  const existing = readPid(pidFile(state, "pages"));
  if (pidAlive(existing)) throw new Error(`pages already running for run ${runId} (pid ${existing})`);
  try {
    await fetch(`http://127.0.0.1:${port}/`);
    throw new Error(`port ${port} answers but no pidfile owns it; refusing a foreign instance`);
  } catch (e) {
    if (!/refusing/.test(e.message) && !/fetch failed|ECONNREFUSED/.test(e.cause?.code || e.message)) throw e;
    if (/refusing/.test(e.message)) throw e;
  }
  const log = fs.openSync(path.join(state, "pages.log"), "w");
  const err = fs.openSync(path.join(state, "pages.err"), "w");
  const child = spawn(process.execPath, [WRANGLER_JS, "pages", "dev", "public", "--kv", "FREE_MODELS_KV", "--port", String(port), "--persist-to", path.join(state, "persist"), "--log-level", "warn"], {
    cwd: WEBSITE_DIR, detached: true, stdio: ["ignore", log, err],
  });
  child.unref();
  fs.writeFileSync(pidFile(state, "pages"), String(child.pid));
  fs.writeFileSync(path.join(state, "pages.port"), String(port));
  await waitForHttp(`http://127.0.0.1:${port}/`, { timeoutMs: 120000 });
  console.log(`pages up on ${port} (pid ${child.pid})`);
}

async function startEdge(args) {
  const runId = args["run-id"];
  const cdpPort = parseInt(args["cdp-port"] || "9223", 10);
  const state = stateDir(runId);
  const existing = readPid(pidFile(state, "edge"));
  if (pidAlive(existing)) throw new Error(`edge already running for run ${runId} (pid ${existing})`);
  const edge = findEdge();
  if (!edge) throw new Error("no Edge or Chrome binary found");
  const profile = path.join(state, "edge-profile");
  fs.mkdirSync(profile, { recursive: true });
  const log = fs.openSync(path.join(state, "edge.log"), "w");
  const child = spawn(edge, ["--headless", "--disable-gpu", "--no-sandbox", `--user-data-dir=${profile}`, `--remote-debugging-port=${cdpPort}`, "about:blank"], {
    detached: true, stdio: ["ignore", log, log],
  });
  child.unref();
  fs.writeFileSync(pidFile(state, "edge"), String(child.pid));
  fs.writeFileSync(path.join(state, "edge.cdp"), `http://127.0.0.1:${cdpPort}`);
  await waitForHttp(`http://127.0.0.1:${cdpPort}/json/version`, { timeoutMs: 60000 });
  console.log(`edge up on CDP ${cdpPort} (pid ${child.pid})`);
}

async function stop(runId) {
  const state = stateDir(runId);
  for (const target of ["edge", "pages"]) {
    const file = pidFile(state, target);
    const pid = readPid(file);
    if (pid === null) continue;
    if (!pidAlive(pid)) { fs.rmSync(file, { force: true }); continue; }
    try { process.kill(pid); } catch { /* already gone */ }
    const deadline = Date.now() + 15000;
    while (pidAlive(pid) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
    if (pidAlive(pid)) throw new Error(`${target} pid ${pid} refused to exit; kill it by hand, it is yours`);
    fs.rmSync(file, { force: true });
    console.log(`${target} stopped`);
  }
  for (const dir of [path.join(state, "persist"), path.join(state, "edge-profile")]) {
    for (let i = 0; i < 6; i++) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        break;
      } catch (e) {
        if (i === 5) console.error(`warn: scratch left at ${dir}; the servers are down, delete it by hand (${e.message})`);
        else await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
  console.log(`state cleaned for run ${runId}; artifacts kept`);
}

const [cmd, ...rest] = parseArgs(process.argv.slice(2))._;
const args = parseArgs(process.argv.slice(2));
if (args.help) usage();
if (!args["run-id"]) usage();
try {
  if (cmd === "start" && args.target === "pages") await startPages(args);
  else if (cmd === "start" && args.target === "edge") await startEdge(args);
  else if (cmd === "stop") await stop(args["run-id"]);
  else usage();
} catch (e) {
  console.error(`SERVE FAIL: ${e.message}`);
  process.exit(1);
}
