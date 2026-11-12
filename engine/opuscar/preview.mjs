#!/usr/bin/env node
// preview.mjs — dry-run visual smoke test: builds a plan with FAKE word
// timings (no TTS calls) and renders stills at key beats of every world so
// the animation code can be checked before the expensive voice+render pass.
//   node preview.mjs <reelId> [--shots 9]
import { REELS, buildPlan, writeFilmDir } from "./build.mjs";
import { mulberry } from "./director.mjs";
import { validateStoryboard } from "./director.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LEMO = "/home/z/my-project/repos/lemo-opuscar";

const key = Number(process.argv[2] || 15);
const reel = REELS.find((r) => r.key === key);
if (!reel) { console.error("reel not found"); process.exit(2); }

// fake but plausible lines: ~0.36 s per word, words evenly spread
const lines = reel.sentences.map((s, i) => {
  const words = s.text.replace(/\[[^\]]*\]/g, "").split(/\s+/).filter(Boolean);
  const dur = 0.5 + words.length * 0.36;
  const wt = [];
  let c = 0.05;
  for (const w of words) {
    const d = (dur - 0.1) / words.length;
    wt.push({ text: w, t0: +c.toFixed(3), t1: +(c + d * 0.82).toFixed(3) });
    c += d;
  }
  return { id: String(i + 1).padStart(2, "0"), text: s.text, dur, words: wt };
});

const rng = mulberry(reel.seed);
for (const s of reel.sentences) {
  const pools = {
    hook: ["shouting"], tension: ["intense, low voice"], imperative: ["firm and commanding"],
    contrast: ["energetic"], reflective: ["whispering"], punchline: ["dramatic"],
  };
  s.delivery = pools[s.role][0];
  s.speed = 1.0;
}
const plan = buildPlan(rng, reel, lines);
validateStoryboard(plan, { WORLDS_LIST: ["dark_mountain", "road", "climb", "storm", "summit", "vault", "city", "study"] });
const dir = writeFilmDir(reel, plan);
console.log(`plan: DUR ${plan.DUR}s, ${plan.scenes.length} scenes, worlds: ${plan.worlds.join(" → ")}`);

// shot list: mid of every story scene + hook mid + cta mid (cap 12)
const shots = [];
for (const s of plan.scenes) {
  if (s.kind === "story") shots.push({ t: +((s.t0 + s.t1) / 2).toFixed(2), label: `${s.world}/${s.actor?.action}` });
}
shots.push({ t: 1.2, label: "hook" });
shots.push({ t: +(plan.DUR - 1.2).toFixed(2), label: "cta" });
const list = shots.slice(0, 12);
console.log("stills:", list.map((s) => `${s.t}s:${s.label}`).join(", "));

for (const s of list) {
  const out = path.join(dir, "out", `still_${String(s.t).replace(".", "_")}_${s.label.replace(/\W+/g, "_")}.jpg`);
  execFileSync("node", [`${LEMO}/core/render/still.mjs`, dir, String(s.t), "1.4", "--size", "1080x1920", "--out", out], { stdio: "inherit" });
}
console.log("done →", path.join(dir, "out"));
