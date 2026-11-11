#!/usr/bin/env node
// build.mjs — the opuscar reel orchestrator.
// 1. plan: seeded creative decisions per reel (emotion delivery, scene
//    sequence, camera, transitions, typography layouts, keywords, palette)
// 2. voice: per-sentence Fish TTS with real emotion tags + word timings
// 3. assemble: plan.json + film dir (page + engine + fonts)
// 4. render: headless Chrome frame-by-frame (lemo-opuscar core/render)
// 5. mix: voice + procedural sfx + music (python/numpy) → mix.wav
// 6. mux: −14 LUFS master → final mp4
// 7. qc: automated checks + contact sheet
//
// Usage: node build.mjs <reelId> [--stage plan|render|mix|mux|qc|all] [--fresh-voice]
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { voiceFilm } from "./voice.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url)); // scripts/opuscar
const LEMO = "/home/z/my-project/repos/lemo-opuscar";
const REELS_FONTS = "/home/z/my-project/scripts/reels/public/fonts";
const PY = path.join(ROOT, ".venv/bin/python");

// ————————————————————————————————— reel definitions ———————————————————————
// Narratives are the approved ones (hype_scripts.json #13/#14); each sentence
// gets a ROLE, and the seeded planner picks a real Fish delivery from that
// role's pool → "random with feelings", meaningful per line.

const DELIVERY_POOLS = {
  hook: ["shouting", "angry, shouting", "fierce and loud"],
  tension: ["intense, low voice", "dead serious", "cold and heavy"],
  imperative: ["firm and commanding", "shouting", "angry and sharp"],
  contrast: ["energetic", "excited", "building intensity"],
  reflective: ["whispering", "calm and quiet", "sad, soft voice"],
  punchline: ["dramatic", "slow and intense", "building to a peak"],
};
const SPEED_BY_ROLE = { hook: [1.0, 1.06], tension: [0.96, 1.02], imperative: [1.0, 1.08], contrast: [1.04, 1.14], reflective: [0.92, 0.98], punchline: [0.94, 1.0] };

const REELS = [
  {
    key: 13, id: "onyx_rescue", name: "Nobody Is Coming to Save You", file: "reel_13_onyx_rescue",
    voiceRef: "bf322df2096a46f18c579d0baa36f41d", // Adrian — gravel narrator
    seed: 13001,
    palette: { name: "onyx_gold", bg0: "#0b0b10", bg1: "#16121c", colors: ["#f5c542", "#e8e6e3", "#9c8446"], accent: "#f5c542", text: "#f4f2ee" },
    bpm: 96, root: 45, // A minor-ish
    sentences: [
      { text: "Nobody is coming to save you.", role: "hook" },
      { text: "And that's the best thing you need to understand.", role: "tension" },
      { text: "Stop waiting for the perfect moment.", role: "imperative" },
      { text: "Stop waiting for someone to believe in you.", role: "imperative" },
      { text: "Your future is your responsibility.", role: "tension" },
      { text: "While others are sleeping on their dreams, work on yours.", role: "contrast" },
      { text: "While others make excuses, take action.", role: "contrast" },
      { text: "You don't need to be the best today.", role: "reflective" },
      { text: "You just need to be better than yesterday.", role: "reflective" },
      { text: "One day, your discipline will introduce you, where your excuses once held you back.", role: "punchline" },
    ],
  },
  {
    key: 14, id: "iron_pain", name: "Pain of Discipline vs Pain of Regret", file: "reel_14_iron_pain",
    voiceRef: "9a9cf47702da476aa4629e2506d4a857", // Energetic Male — harder edge
    seed: 14002,
    palette: { name: "blood_ink", bg0: "#0a0506", bg1: "#1c0d10", colors: ["#ff2e3f", "#ff8c94", "#7a1620"], accent: "#ff2e3f", text: "#f7e9e6" },
    bpm: 112, root: 41, // F minor-ish
    sentences: [
      { text: "You will feel pain either way.", role: "hook" },
      { text: "The pain of discipline, or the pain of regret.", role: "tension" },
      { text: "Discipline hurts for minutes.", role: "contrast" },
      { text: "Regret hurts for years.", role: "tension" },
      { text: "Choose your pain on purpose.", role: "imperative" },
      { text: "Nobody sees the five A M alarms.", role: "contrast" },
      { text: "Nobody claps for the boring days.", role: "reflective" },
      { text: "That is where the results live.", role: "tension" },
      { text: "Every rep you don't skip, every page you do read, it compounds.", role: "contrast" },
      { text: "Choose discipline today, so tomorrow you don't drown in regret.", role: "punchline" },
    ],
  },
];

const EMPHASIS = new Set(("nobody save stop waiting future responsibility discipline regret pain choose " +
  "purpose minutes years today tomorrow yesterday better best action excuses results live compounds " +
  "alarms boring rep page skip drown sleeping dreams work understand introduce").split(" "));

// ————————————————————————————————— seeded helpers ————————————————————————
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const rrange = (rng, a, b) => a + rng() * (b - a);

// ————————————————————————————————— the planner ——————————————————————————

function buildPlan(rng, reel, lines) {

  // 1. timeline: place each voiced sentence with seeded gaps
  const segs = [];
  let cursor = 0.0;
  lines.forEach((line, i) => {
    const s = reel.sentences[i];
    const gap = i === 0 ? 0.15 : i === 1 ? 0.5 : rrange(rng, 0.16, 0.34);
    cursor += gap;
    const words = line.words.map((w) => ({
      text: w.text,
      t0: +(cursor + w.t0).toFixed(3),
      t1: +(cursor + w.t1).toFixed(3),
    }));
    // keyword flag: emphasis lexicon OR long word (cap 4)
    let keys = 0;
    for (const w of words) {
      const bare = w.text.toLowerCase().replace(/[^a-z']/g, "");
      if ((EMPHASIS.has(bare) || bare.length >= 8) && keys < 4) { w.key = true; keys++; }
    }
    segs.push({ i, t0: +cursor.toFixed(3), t1: +(cursor + line.dur).toFixed(3), text: s.text, role: s.role, layout: null, words });
    cursor += line.dur;
  });
  const speechEnd = +cursor.toFixed(3);
  const ctaT0 = +(speechEnd + 0.4).toFixed(3);
  const DUR = +(ctaT0 + 3.9).toFixed(3);

  // hook = sentence 0, but clamp its window to ≤ 2.4s of slam time (word-driven)
  const hookSeg = segs[0];
  const hook = { id: "hook", t0: hookSeg.t0, t1: hookSeg.t1, words: hookSeg.words };

  // 3. typography layout per sentence
  for (const segm of segs) {
    const n = segm.words.length;
    if (segm.role === "punchline" && n <= 5) segm.layout = "spot";
    else if (n <= 3) segm.layout = "spot";
    else segm.layout = pick(rng, ["stack", "stack", "block", "arc"]);
  }

  // 4. scene sequence: fast flips inside the hook (one per word), beat-locked
  //    1–3 s units in the body, no immediate type repeats.
  const beat = 60 / reel.bpm;
  const BG = ["rings", "flow", "waves", "tunnel", "stripes", "shards", "mosaic", "blobs", "matrix", "spotlight", "orbits", "glitch"];
  const TRANS = ["flash", "bars", "wipe", "streak", "glitchBurst", "cut"];
  const CAMS = ["push", "pull", "panL", "panR", "punch", "tilt", "drift"];
  const scenes = [];
  let sceneIdx = 0;
  const bag = [];
  const drawType = () => {
    if (!bag.length) bag.push(...BG.slice().sort(() => rng() - 0.5));
    return bag.pop();
  };
  const mkScene = (t0, t1, zone, forcedType) => {
    sceneIdx++;
    const type = forcedType || drawType();
    const inner = type === "glitch" ? pick(rng, BG.filter((b) => b !== "glitch" && b !== "matrix")) : undefined;
    const isHook = zone === "hook";
    const isPunch = zone === "punch";
    const trans = isHook
      ? pick(rng, ["flash", "flash", "streak", "glitchBurst"])
      : pick(rng, TRANS);
    const cam = isHook
      ? pick(rng, ["punch", "shake", "push"])
      : isPunch
        ? pick(rng, ["punch", "shake", "push"])
        : pick(rng, CAMS);
    scenes.push({
      id: "s" + sceneIdx, t0: +t0.toFixed(3), t1: +t1.toFixed(3),
      type, inner, cam, trans,
      seed: Math.floor(rng() * 0xfffffff),
      speed: +rrange(rng, 0.85, 1.3).toFixed(2),
    });
  };

  // hook: one scene per word (fast bg flips, 0.25–0.7 s each)
  for (let i = 0; i < hook.words.length; i++) {
    const w0 = hook.words[i].t0;
    const w1 = i + 1 < hook.words.length ? hook.words[i + 1].t0 : hook.t1;
    mkScene(w0 - 0.05, Math.max(w0 + 0.2, w1), "hook");
  }
  // body: split each sentence window into beat-locked units of 1–3 s
  let lastTrans = null;
  for (const segm of segs.slice(1)) {
    let s = segm.t0 - 0.08;
    const end = segm.t1 + 0.12;
    while (end - s > 0.4) {
      // beat-multiples that fit inside 1–3 s and the remaining window
      const remain = end - s;
      const beats = [2, 3, 4, 6].map((b) => b * beat).filter((d) => d >= 0.9 && d <= 3.05 && d <= remain + 0.05);
      let dur = beats.length ? pick(rng, beats) : Math.min(remain, 3.05);
      if (remain - dur < 0.9 && remain < 3.4) dur = remain; // absorb the tail
      mkScene(s, Math.min(end, s + dur), segm.role === "punchline" ? "punch" : "body");
      s += dur;
    }
  }
  // CTA zone: two calm, readable scenes (no glyph rain behind the end card)
  const CALM = ["waves", "blobs", "orbits", "rings"];
  const cta1 = pick(rng, CALM), cta2 = pick(rng, CALM.filter((c) => c !== cta1));
  mkScene(ctaT0, ctaT0 + 1.9, "body", cta1);
  mkScene(ctaT0 + 1.9, DUR, "body", cta2);
  scenes.sort((a, b) => a.t0 - b.t0);
  // stitch tiny gaps / overlaps
  for (let i = 0; i < scenes.length - 1; i++) scenes[i].t1 = scenes[i + 1].t0;
  scenes[scenes.length - 1].t1 = DUR;

  // 5. music energy map
  const energyMap = [];
  for (const segm of segs) {
    const lvl = segm.role === "hook" ? 1.0 : segm.role === "reflective" ? 0.42 : segm.role === "punchline" ? 1.0 : 0.86;
    energyMap.push({ t0: segm.t0, t1: segm.t1, level: lvl });
  }
  energyMap.push({ t0: ctaT0, t1: DUR, level: 0.5 });

  return {
    id: reel.id, name: reel.name, seed: reel.seed, DUR,
    bpm: reel.bpm, root: reel.root, energyMap,
    palette: reel.palette,
    brand: JSON.parse(fs.readFileSync("/home/z/my-project/scripts/reels/hype_scripts.json", "utf8")).brand,
    voiceRef: reel.voiceRef,
    hook, segments: segs, scenes,
    cta: { t0: ctaT0, t1: DUR },
    deliveries: reel.sentences.map((s) => ({ role: s.role, delivery: s.delivery, speed: s.speed })),
  };
}

// ————————————————————————————————— film dir ————————————————————————————

function writeFilmDir(reel, plan) {
  const dir = path.join(ROOT, "films", reel.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "fonts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "out"), { recursive: true });
  // engine + page
  for (const f of ["lib.js", "bg.js", "type.js", "camera.js", "transitions.js", "main.js"]) {
    fs.copyFileSync(path.join(ROOT, "engine", f), path.join(dir, f));
  }
  const html = fs.readFileSync(path.join(ROOT, "engine", "index.html"), "utf8").replace("{{FILM_TITLE}}", reel.name);
  fs.writeFileSync(path.join(dir, "index.html"), html);
  // fonts
  for (const f of ["Anton-Regular.ttf", "ArchivoBlack-Regular.ttf", "SourceSans3-600.ttf"]) {
    fs.copyFileSync(path.join(REELS_FONTS, f), path.join(dir, "fonts", f));
  }
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan, null, 1));
  return dir;
}

// ————————————————————————————————— stages ————————————————————————————————

async function main() {
  const key = Number(process.argv[2]);
  const reel = REELS.find((r) => r.key === key);
  if (!reel) { console.error("usage: node build.mjs <13|14> [--stage plan|render|mix|mux|qc|all] [--fresh-voice]"); process.exit(2); }
  const stageIdx = process.argv.indexOf("--stage");
  const stage = stageIdx > 0 ? process.argv[stageIdx + 1] : "all";
  const freshVoice = process.argv.includes("--fresh-voice");
  const dir = path.join(ROOT, "films", reel.id);
  console.log(`▸ ${reel.name} [${reel.id}] stage=${stage}`);

  if (stage === "all" || stage === "plan") {
    if (freshVoice) fs.rmSync(path.join(dir, "voice"), { recursive: true, force: true });
    // seeded deliveries FIRST (voice needs them), same rng stream continues
    // into the planner → fully deterministic per seed
    const rng = mulberry(reel.seed);
    for (const s of reel.sentences) {
      s.delivery = pick(rng, DELIVERY_POOLS[s.role]);
      const [sa, sb] = SPEED_BY_ROLE[s.role];
      s.speed = +rrange(rng, sa, sb).toFixed(2);
    }
    const film = {
      dir,
      sentences: reel.sentences,
      reference_id: reel.voiceRef,
    };
    const lines = await voiceFilm(film);
    const plan = buildPlan(rng, reel, lines);
    const d = writeFilmDir(reel, plan);
    console.log(`  plan.json → ${d}  (DUR ${plan.DUR}s, ${plan.scenes.length} scenes, hook ${plan.hook.words.length} slams)`);
    console.log("  deliveries:", plan.deliveries.map((x) => `${x.role}:${x.delivery}`).join(" | "));
  }

  if (stage === "all" || stage === "render") {
    run("node", [`${LEMO}/core/render/events.mjs`, dir]);
    run("node", [`${LEMO}/core/render/video.mjs`, dir, "--fps", "30", "--size", "1080x1920", "--workers", "4", "--out", `${dir}/out/video.mp4`]);
  }
  if (stage === "all" || stage === "mix") {
    run(PY, [`${ROOT}/mix.py`, dir]);
  }
  if (stage === "all" || stage === "mux") {
    run("sh", [`${LEMO}/core/render/mux.sh`, `${dir}/out/video.mp4`, `${dir}/out/mix.wav`, `${dir}/out/${reel.file}.mp4`, "30", "0"]);
  }
  if (stage === "all" || stage === "qc") {
    run(PY, [`${ROOT}/qc.py`, dir, reel.file]);
  }
}

function run(cmd, args, opts = {}) {
  console.log(`  $ ${cmd} ${args.join(" ").replace(/\/home\/z\/my-project\//g, "~/")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) { console.error(`stage failed: ${cmd} exit ${r.status}`); process.exit(r.status || 1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
