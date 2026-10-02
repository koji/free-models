#!/usr/bin/env node
// Evaluates JS in the app tab over CDP and captures evidence. Usage:
//   node helpers/cdp-eval.mjs --eval "JS" [--url U] [--navigate] [--settle-ms N] [--screenshot P] [--dump P] [--cdp URL] [--viewport WxH]
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
if (args.help) { console.log('usage: node helpers/cdp-eval.mjs --eval "JS" [--url U] [--navigate] [--settle-ms N] [--screenshot P] [--dump P] [--cdp URL] [--viewport WxH]'); process.exit(0); }
const expr = args.eval;
const appUrl = args.url || "http://127.0.0.1:8788/";
const cdp = args["cdp"] || "http://127.0.0.1:9223";
const settleMs = parseInt(args["settle-ms"] || (args.navigate ? "3000" : "500"), 10);
if (!expr) { console.error('usage: node helpers/cdp-eval.mjs --eval "JS" [--url U] [--navigate] [--settle-ms N] [--screenshot P] [--dump P]'); process.exit(2); }

let seq = 1;
function rpc(ws, method, params = {}) {
  const id = seq++;
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) {
        ws.removeEventListener("message", onMsg);
        m.error ? reject(new Error(`${method}: ${JSON.stringify(m.error)}`)) : resolve(m.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(ws, expression) {
  const r = await rpc(ws, "Runtime.evaluate", { expression, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.text}`);
  return r.result.value;
}

const tabs = await (await fetch(`${cdp}/json/list`)).json();
const target = tabs.find((t) => t.type === "page");
if (!target) throw new Error("no page target; start edge through serve.mjs first");
const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
await new Promise((res, rej) => {
  ws.addEventListener("open", () => res(), { once: true });
  ws.addEventListener("error", (e) => rej(new Error(String(e.error || e.message))), { once: true });
});
try {
  await rpc(ws, "Page.enable");
  if (args.navigate) {
    await rpc(ws, "Page.navigate", { url: appUrl });
    for (let i = 0; i < 20; i++) {
      if ((await evaluate(ws, "document.readyState")) === "complete") break;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await new Promise((r) => setTimeout(r, settleMs));
  const value = await evaluate(ws, expr);
  console.log(JSON.stringify(value));
  if (args.dump) {
    fs.mkdirSync(path.dirname(args.dump), { recursive: true });
    fs.writeFileSync(args.dump, await evaluate(ws, "document.documentElement.outerHTML"));
    console.error(`dump: ${args.dump}`);
  }
  if (args.viewport) {
    const m = /^(\d+)x(\d+)$/.exec(args.viewport);
    if (!m) throw new Error('--viewport needs WIDTHxHEIGHT, for example 1280x1000');
    await rpc(ws, "Emulation.setDeviceMetricsOverride", { width: parseInt(m[1], 10), height: parseInt(m[2], 10), deviceScaleFactor: 1, mobile: false });
  }
  if (args.screenshot) {
    fs.mkdirSync(path.dirname(args.screenshot), { recursive: true });
    const shot = await rpc(ws, "Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(args.screenshot, Buffer.from(shot.data, "base64"));
    console.error(`screenshot: ${args.screenshot}`);
  }
} finally {
  ws.close();
}
