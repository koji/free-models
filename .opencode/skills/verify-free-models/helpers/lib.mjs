#!/usr/bin/env node
// Shared internals for verify-free-models helpers. Not invoked directly.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const SKILL_DIR = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")));
export const REPO_ROOT = path.dirname(path.dirname(path.dirname(SKILL_DIR)));
export const WEBSITE_DIR = path.join(REPO_ROOT, "website");
export const WRANGLER_JS = path.join(WEBSITE_DIR, "node_modules", "wrangler", "bin", "wrangler.js");

export function scratchRoot(runId) {
  return path.join(os.tmpdir(), "verify-free-models", runId);
}
export function stateDir(runId) {
  return path.join(scratchRoot(runId), "state");
}
export function artifactsDir(runId, feature) {
  return path.join(scratchRoot(runId), "artifacts", feature);
}

export function findEdge() {
  const bases = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application",
    "C:\\Program Files\\Microsoft\\Edge\\Application",
    "C:\\Program Files\\Google\\Chrome\\Application",
  ];
  for (const base of bases) {
    for (const name of ["msedge.exe", "chrome.exe"]) {
      const direct = path.join(base, name);
      if (fs.existsSync(direct)) return direct;
    }
    if (!fs.existsSync(base)) continue;
    const versions = fs.readdirSync(base).filter((e) => /^\d+\./.test(e)).sort();
    for (const v of versions.reverse()) {
      for (const name of ["msedge.exe", "chrome.exe"]) {
        const nested = path.join(base, v, name);
        if (fs.existsSync(nested)) return nested;
      }
    }
  }
  return null;
}

export function readPid(file) {
  try {
    const pid = parseInt(fs.readFileSync(file, "utf8").trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function pidAlive(pid) {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitForHttp(url, { timeoutMs = 90000, wantStatus = null } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      last = res.status;
      if (wantStatus === null || res.status === wantStatus) return res.status;
    } catch (e) {
      last = e.cause?.code || e.message;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timed out waiting for ${url} (last: ${last})`);
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}
