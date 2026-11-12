#!/usr/bin/env node
// debug_story2.mjs — no server: inline plan, load engine sources, decorate
// scenes IN-BROWSER (exactly like main.js does), then drawStory per story
// scene and dump PNGs + actor-zone pixel stats.
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const FILM = process.argv[2];
const plan = JSON.parse(fs.readFileSync(path.join(FILM, "plan.json"), "utf8"));
const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "engine");
const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";

const b = await chromium.launch({ headless: true, executablePath: EXE });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("pageerror", (e) => console.log("PAGE EXCEPTION:", e.message));
await page.goto("about:blank");
await page.setContent(`<!doctype html><html><body><canvas id="c" width="1080" height="1920"></canvas></body></html>`);
for (const f of ["lib.js", "bg.js", "type.js", "camera.js", "transitions.js", "objects.js", "characters.js", "worlds.js", "story.js"]) {
  await page.addScriptTag({ content: fs.readFileSync(path.join(ENGINE, f), "utf8") });
}

// decorate all scenes exactly like main.js decorate() does
await page.evaluate(({ plan }) => {
  const E = window.ENGINE;
  window.__plan = plan;
  for (const s of plan.scenes) {
    s.noise = E.makeNoise((s.seed ^ E.hash(s.type || s.world || "s")) >>> 0);
    s.phase = (E.hash(s.id) % 628) / 100;
    s.palette = plan.palette;
    if (s.kind === "story") E.decorStory(s, plan);
  }
}, { plan });

const outDir = "/tmp/dbgstory";
fs.mkdirSync(outDir, { recursive: true });
for (const s of plan.scenes) {
  if (s.kind !== "story" || !s.actor) continue;
  const t = +(((s.t0 + s.t1) / 2).toFixed(2));
  const res = await page.evaluate(({ si, t }) => {
    const E = window.ENGINE;
    const s = window.__plan.scenes[si];
    const c = document.getElementById("c");
    const ctx = c.getContext("2d");
    const W = 1080, H = 1920;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    try {
      E.drawStory(ctx, W, H, t, s, window.__plan);
    } catch (e) {
      return { t, err: String((e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")) };
    }
    const ax = W * (s.actor.x ?? 0.5), ay = H * (s.actor.y ?? 0.86), ah = W * (s.actor.h ?? 0.34);
    const x0 = Math.max(0, ax - ah), y0 = Math.max(0, ay - ah * 1.35);
    const w = Math.floor(Math.min(W - x0, ah * 2)), h = Math.floor(Math.min(H - y0, ah * 1.5));
    const img = ctx.getImageData(x0, y0, w, h);
    let lit = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] + img.data[i + 1] + img.data[i + 2] > 90) lit++;
    }
    return { t, lit, pct: +(100 * lit / (w * h)).toFixed(1), png: c.toDataURL("image/jpeg", 0.7) };
  }, { si: plan.scenes.indexOf(s), t });
  if (res.err) { console.log(`${s.id} ${s.world}/${s.actor.action} t=${t} ERR`, res.err); continue; }
  fs.writeFileSync(path.join(outDir, `${s.id}_${s.world}.jpg`), Buffer.from(res.png.split(",")[1], "base64"));
  console.log(`${s.id} ${s.world}/${s.actor.action} t=${t} actorzone=${res.pct}%`);
}
console.log("PNGs → /tmp/dbgstory");
await b.close();
