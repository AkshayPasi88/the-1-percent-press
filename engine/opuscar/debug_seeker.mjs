#!/usr/bin/env node
// debug_seeker.mjs — probe drawSeeker on a bare canvas: does it draw, where,
// and with what pixel coverage? Also probes drawStory for one scene.
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const FILM = process.argv[2] || path.dirname(fileURLToPath(import.meta.url)) + "/films/dark_starting_line";
const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";

const b = await chromium.launch({ headless: true, executablePath: EXE });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("console", (m) => { if (m.type() === "error") console.log("PAGE ERROR:", m.text()); });
page.on("pageerror", (e) => console.log("PAGE EXCEPTION:", e.message));
// load engine sources fresh from the ENGINE dir (not the stale film copy)
const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "engine");
await page.goto("about:blank");
await page.setContent(`<!doctype html><html><body><canvas id="c" width="1080" height="1920"></canvas></body></html>`);
for (const f of ["lib.js", "objects.js", "characters.js"]) {
  await page.addScriptTag({ content: fs.readFileSync(path.join(ENGINE, f), "utf8") });
}

const out = await page.evaluate(() => {
  const c = document.getElementById("c");
  const ctx = c.getContext("2d");
  const W = 1080, H = 1920;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#101010";
  ctx.fillRect(0, 0, W, H);
  const E = window.ENGINE;
  const card = E.seekerCard({ colors: ["#f5c542", "#5b6ee1", "#8fa3d9"], accent: "#f5c542" });
  // draw a big seeker centre-frame
  try {
    E.drawSeeker(ctx, W / 2, H * 0.8, 500, 2.0, { action: "stand", phase: 0, tt: 1 }, card, { dir: 1, rim: 0.8, shadow: 1 });
  } catch (e) { return { err: "drawSeeker threw: " + e.message }; }
  // pixel coverage in the character zone
  const img = ctx.getImageData(W / 2 - 260, H * 0.8 - 520, 520, 540);
  let lit = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (Math.abs(img.data[i] - 16) + Math.abs(img.data[i + 1] - 16) + Math.abs(img.data[i + 2] - 16) > 30) lit++;
  }
  // bounding box of non-background pixels
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let y = 0; y < 540; y++) for (let x = 0; x < 520; x++) {
    const i = (y * 520 + x) * 4;
    if (Math.abs(img.data[i] - 16) + Math.abs(img.data[i + 1] - 16) + Math.abs(img.data[i + 2] - 16) > 30) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { lit, bbox: { minX, maxX, minY, maxY }, expect: { w: 520, h: 540 } };
});
console.log("SEEKER PROBE:", JSON.stringify(out));
await b.close();
