#!/usr/bin/env node
// debug_live.mjs — serve the film dir over http, open the REAL page, call
// window.render(t) at story times, and inspect canvas pixels + errors.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const FILM = path.resolve(process.argv[2]);
const PORT = 8931;
const EXE = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";

const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: FILM, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 600));

const b = await chromium.launch({ headless: true, executablePath: EXE });
const page = await b.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE ERROR:", m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("PAGE EXCEPTION:", String(e).slice(0, 500)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 15000 }).catch((e) => {
  console.log("READY timeout:", e.message);
  console.log("bootError:", page.evaluate(() => window.__bootError));
});
await page.waitForTimeout(300);

const info = await page.evaluate(() => {
  return {
    ready: !!window.READY, dur: window.DUR,
    hasDrawStory: typeof window.ENGINE?.drawStory === "function",
    hasDrawSeeker: typeof window.ENGINE?.drawSeeker === "function",
    bootError: window.__bootError || null,
    scripts: [...document.scripts].map((s) => s.src.split("/").pop()),
  };
});
console.log("PAGE:", JSON.stringify(info, null, 1));

for (const t of [4.02, 11.32, 24.3, 31.46]) {
  try {
    const res = await page.evaluate((t) => {
      const c = document.getElementById("c");
      const ctx = c.getContext("2d");
      window.render(t);
      // gold-pixel detector in the actor band (y 0.55..0.9H): hood color #f5c542
      const img = ctx.getImageData(0, Math.floor(1920 * 0.55), 1080, Math.floor(1920 * 0.35));
      let gold = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        const [r, g, bb] = [img.data[i], img.data[i + 1], img.data[i + 2]];
        if (r > 180 && g > 130 && bb < 120 && Math.abs(r - 245) < 70 && Math.abs(g - 197) < 70) gold++;
      }
      return { t, goldPixels: gold };
    }, t);
    console.log("GOLD SCAN:", JSON.stringify(res));
  } catch (e) {
    console.log("RENDER THREW at", t, String(e).slice(0, 400));
  }
}
srv.kill();
await b.close();
