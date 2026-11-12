#!/usr/bin/env node
// build.mjs — the opuscar film orchestrator (ENGINE v6: animated film).
// 1. plan: seeded creative decisions + THE DIRECTOR (storyboard: worlds,
//    Seeker staging, props, camera, lighting, narration-synced fx) + schema
//    validation before any pixels exist
// 2. voice: per-sentence Fish TTS with real emotion tags + word timings
// 3. assemble: plan.json + film dir (page + engine + fonts)
// 4. render: headless Chrome frame-by-frame (lemo-opuscar core/render)
// 5. mix: voice + procedural sfx (incl. thunder/steps/sun swell) + music
// 6. mux: −14 LUFS master → final mp4
// 7. qc: automated gates + contact sheet
//
// Usage: node build.mjs <reelId> [--stage plan|render|mix|mux|qc|all] [--fresh-voice]
// preview.mjs imports REELS/buildPlan/writeFilmDir for dry-run visual checks.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { voiceFilm } from "./voice.mjs";
import { buildStoryboard, validateStoryboard } from "./director.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url)); // engine/opuscar
const LEMO = "/home/z/my-project/repos/lemo-opuscar";
const REELS_FONTS = "/home/z/my-project/scripts/reels/public/fonts";
const PY = path.join(ROOT, ".venv/bin/python");
// sandbox chrome for playwright-core (fresh installs fetch their own)
const CHROME = "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
if (fs.existsSync(CHROME)) process.env.PLAYWRIGHT_CHROME = process.env.PLAYWRIGHT_CHROME || CHROME;

// ————————————————————————————————— reel definitions ———————————————————————
// Every reel now stages as an ANIMATED FILM (v6): the director reads the
// narration and casts worlds/objects/actor beats. Narratives are ours; the
// Seeker character, props and worlds are original code-drawn assets.

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
    bpm: 96, root: 45,
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
    bpm: 112, root: 41,
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
  {
    key: 15, id: "dark_starting_line", name: "Nobody Is Coming (Animated Film)", file: "reel_15_nobody_film",
    voiceRef: "bf322df2096a46f18c579d0baa36f41d", // Adrian — gravel narrator
    seed: 15003,
    palette: { name: "journey_dawn", bg0: "#0a0d1c", bg1: "#17203a", colors: ["#f5c542", "#5b6ee1", "#8fa3d9"], accent: "#f5c542", text: "#f2f0ea" },
    bpm: 92, root: 45,
    sentences: [
      { text: "Nobody is coming.", role: "hook" },
      { text: "Not a hero. Not a miracle. Not luck.", role: "tension" },
      { text: "The dark you're standing in? That's your starting line.", role: "contrast" },
      { text: "So get up, and start walking.", role: "imperative" },
      { text: "The road will be empty. That's exactly the point.", role: "tension" },
      { text: "The climb will try to break you.", role: "tension" },
      { text: "Let the storm come.", role: "imperative" },
      { text: "Because the sun only rises for the ones who kept moving.", role: "contrast" },
      { text: "Every step you take alone is building the person they'll all meet one day.", role: "punchline" },
    ],
  },
  {
    key: 16, id: "five_am_city", name: "While You Were Sleeping", file: "reel_16_while_sleeping",
    voiceRef: "9a9cf47702da476aa4629e2506d4a857", // Energetic Male
    seed: 16004,
    palette: { name: "cold_gears", bg0: "#070d16", bg1: "#14263c", colors: ["#f5c542", "#4ea3d8", "#c9d7ee"], accent: "#f5c542", text: "#eef2f8" },
    bpm: 104, root: 43,
    sentences: [
      { text: "Five A M. Nobody claps.", role: "hook" },
      { text: "The alarm screams while the bed whispers stay.", role: "tension" },
      { text: "Winners live in the minutes everyone else wastes.", role: "contrast" },
      { text: "While you were sleeping, someone was building.", role: "contrast" },
      { text: "Page by page. Rep by rep. Day by day.", role: "tension" },
      { text: "Time doesn't care about your feelings.", role: "tension" },
      { text: "It only counts what you actually did.", role: "imperative" },
      { text: "So stack your days like coins, and let them compound.", role: "contrast" },
      { text: "One day, the sum will speak for you.", role: "punchline" },
    ],
  },
];

const EMPHASIS = new Set(("nobody save stop waiting future responsibility discipline regret pain choose " +
  "purpose minutes years today tomorrow yesterday better best action excuses results live compounds " +
  "alarms boring rep page skip drown sleeping dreams work understand introduce " +
  "hero miracle luck dark starting line get walking empty point climb break storm sun rises moving kept " +
  "step alone building meet one day five am claps screams bed whisper stay winners minutes wastes " +
  "feelings counts stack coins sum speak").split(" "));

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

// ————————————————————————————————— the planner (v6) ————————————————————

export function buildPlan(rng, reel, lines) {

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

  const hookSeg = segs[0];
  const hook = { id: "hook", t0: hookSeg.t0, t1: hookSeg.t1, words: hookSeg.words };

  // 2. typography layout per sentence
  for (const segm of segs) {
    const n = segm.words.length;
    if (segm.role === "punchline" && n <= 5) segm.layout = "spot";
    else if (n <= 3) segm.layout = "spot";
    else segm.layout = pick(rng, ["stack", "stack", "block", "arc"]);
  }

  // 3. THE DIRECTOR: storyboard the film (worlds + actor + props + fx)
  const { scenes, fxs, storyScenes } = buildStoryboard(rng, reel, lines, segs, hook, ctaT0, DUR);

  // 4. music energy map
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
    hook, segments: segs, scenes, fxs,
    cta: { t0: ctaT0, t1: DUR },
    deliveries: reel.sentences.map((s) => ({ role: s.role, delivery: s.delivery, speed: s.speed })),
    engine: "v6-film", worlds: [...new Set(storyScenes.map((s) => s.world))],
  };
}

// ————————————————————————————————— film dir ————————————————————————————

export function writeFilmDir(reel, plan) {
  const dir = path.join(ROOT, "films", reel.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "fonts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "out"), { recursive: true });
  // engine + page
  for (const f of ["lib.js", "bg.js", "type.js", "camera.js", "transitions.js",
    "objects.js", "characters.js", "worlds.js", "story.js", "main.js"]) {
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
  if (!reel) { console.error("usage: node build.mjs <13..16> [--stage plan|render|mix|mux|qc|all] [--fresh-voice]"); process.exit(2); }
  const stageIdx = process.argv.indexOf("--stage");
  const stage = stageIdx > 0 ? process.argv[stageIdx + 1] : "all";
  const freshVoice = process.argv.includes("--fresh-voice");
  const dir = path.join(ROOT, "films", reel.id);
  console.log(`▸ ${reel.name} [${reel.id}] stage=${stage}`);

  if (stage === "all" || stage === "plan") {
    if (freshVoice) fs.rmSync(path.join(dir, "voice"), { recursive: true, force: true });
    const rng = mulberry(reel.seed);
    for (const s of reel.sentences) {
      s.delivery = pick(rng, DELIVERY_POOLS[s.role]);
      const [sa, sb] = SPEED_BY_ROLE[s.role];
      s.speed = +rrange(rng, sa, sb).toFixed(2);
    }
    const film = { dir, sentences: reel.sentences, reference_id: reel.voiceRef };
    const lines = await voiceFilm(film);
    const plan = buildPlan(rng, reel, lines);
    // schema gate: never render an invalid storyboard
    validateStoryboard(plan, { WORLDS_LIST: ["dark_mountain", "road", "climb", "storm", "summit", "vault", "city", "study"] });
    const d = writeFilmDir(reel, plan);
    console.log(`  plan.json → ${d}  (DUR ${plan.DUR}s, ${plan.scenes.length} scenes, ${plan.worlds.length} worlds, ${plan.fxs.length} fx events)`);
    console.log("  deliveries:", plan.deliveries.map((x) => `${x.role}:${x.delivery}`).join(" | "));
    console.log("  worlds:", plan.worlds.join(" → "));
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

export { REELS };
const __isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (__isMain) main().catch((e) => { console.error(e); process.exit(1); });
