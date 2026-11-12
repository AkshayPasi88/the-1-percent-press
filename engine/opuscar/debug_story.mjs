#!/usr/bin/env node
// debug_story.mjs — load the REAL film page (via lemo page.mjs http server),
// render frames at story-scene times, and measure pixel coverage in the actor
// zone to find where the character lands (or doesn't).
import { openDemo } from "/home/z/my-project/repos/lemo-opuscar/core/render/page.mjs";
import path from "node:path";
import fs from "node:fs";

const FILM = process.argv[2];
if (!FILM || !fs.existsSync(path.join(FILM, "plan.json"))) { console.error("usage: node debug_story.mjs <filmDir>"); process.exit(2); }

const { browser, page } = await openDemo(FILM, { w: 1080, h: 1920, q: "" });
const plan = JSON.parse(fs.readFileSync(path.join(FILM, "plan.json"), "utf8"));
const DUR = await page.evaluate(() => window.DUR);
console.log("film DUR:", DUR);

for (const s of plan.scenes) {
  if (s.kind !== "story" || !s.actor) continue;
  const t = (s.t0 + s.t1) / 2;
  const res = await page.evaluate((t) => {
    window.render(t);
    const c = document.getElementById("c");
    const ctx = c.getContext("2d");
    const W = c.width, H = c.height;
    // actor zone: around expected position (x*W, y*H), generous box
    const ax = W * 0.5, ay = H * 0.86, ah = W * 0.34;
    const x0 = Math.max(0, ax - ah * 0.8), y0 = Math.max(0, ay - ah * 1.25);
    const w = Math.min(W - x0, ah * 1.6), h = Math.min(H - y0, ah * 1.45);
    const img = ctx.getImageData(x0, y0, Math.floor(w), Math.floor(h));
    let lit = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] + img.data[i + 1] + img.data[i + 2] > 60) lit++;
    }
    // page errors?
    const errs = window.__renderErrors || [];
    return { t, lit, area: Math.floor(w) * Math.floor(h), errs };
  }, t);
  console.log(`${s.id} ${s.world}/${s.actor.action} t=${res.t.toFixed(1)} lit=${res.lit} (${(100 * res.lit / res.area).toFixed(1)}% of actor zone)`);
}
await browser.close();
