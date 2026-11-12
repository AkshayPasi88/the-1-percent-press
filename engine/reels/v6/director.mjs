// v6 Creative Director — narration → structured scene specs (JSON).
// Deterministic (seeded), rule-based: sentences become scenes, worlds and
// actions are assigned from per-reel creative tables, cameras are keyed data,
// counters derive from each reel's message. Output: v6/specs/<reelId>.json
//
// Scene spec schema (the contract AnimatedWorld consumes):
//   scene  : { id, world, startSec, endSec, camera[keys], action, character,
//              lighting{tint,intensity}, fx[], counter?, motif?, narration?,
//              type: hook|caption|cta }
//   reel   : { id, style, audio, durations, fps, theme, hookLines, scenes[],
//              cta, envelope[] (per-frame), onsets[] (frame idx), brand }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const specDir = path.join(root, "v6", "specs");
fs.mkdirSync(specDir, { recursive: true });

const FPS = 30;

// ------------------------------------------------------------------ tables
// worlds + actions chosen per reel — the creative direction layer.
const DIRECTION = {
  gold_math: {
    worlds: ["iso-grid", "riso-poster", "iso-grid"],
    actions: ["idle", "climb", "walk"],
    counters: [{ at: 1, c: { label: "ONE YEAR", from: 1, to: 37.78, prefix: "×", decimals: 2 } }],
  },
  mono_weather: {
    worlds: ["ink-dawn", "liquid-grad", "ink-dawn"],
    actions: ["idle", "walk", "idle"],
    counters: [{ at: 1, c: { label: "SYSTEM BUILT FOR", from: 1, to: 365, prefix: "DAY " } }],
  },
  lime_2min: {
    worlds: ["blueprint-tech", "iso-grid", "liquid-grad"],
    actions: ["meditate", "idle", "meditate"],
    counters: [{ at: 1, c: { label: "START WITH", from: 30, to: 2, suffix: " MIN" } }],
  },
  crimson_twice: {
    worlds: ["halftone-comic", "iso-grid", "halftone-comic"],
    actions: ["run", "climb", "run"],
    counters: [],
  },
  ocean_votes: {
    worlds: ["cosmic-orbit", "iso-grid", "liquid-grad"],
    actions: ["levitate", "walk", "idle"],
    counters: [{ at: 1, c: { label: "VOTES CAST", from: 1, to: 300 } }],
  },
  steel_env: {
    worlds: ["blueprint-tech", "iso-grid", "blueprint-tech"],
    actions: ["idle", "point", "idle"],
    counters: [],
  },
  forest_chain: {
    worlds: ["paper-forest", "paper-forest", "cosmic-orbit"],
    actions: ["walk", "climb", "walk"],
    motif: "chain",
    counters: [{ at: 1, c: { label: "STREAK", from: 1, to: 365, prefix: "DAY " } }],
  },
  coral_decade: {
    worlds: ["ink-dawn", "liquid-grad", "ink-dawn"],
    actions: ["idle", "meditate", "victory"],
    counters: [{ at: 1, c: { label: "COMPOUNDING", from: 1, to: 3650, prefix: "DAY " } }],
  },
  violet_monday: {
    worlds: ["cosmic-orbit", "halftone-comic", "cosmic-orbit"],
    actions: ["levitate", "victory", "levitate"],
    counters: [{ at: 1, c: { label: "DAYS WASTED WAITING", from: 0, to: 365 } }],
  },
  sunset_onepct: {
    worlds: ["halftone-comic", "riso-poster", "halftone-comic"],
    actions: ["victory", "point", "run"],
    counters: [{ at: 1, c: { label: "YOU ONLY NEED", from: 100, to: 1, suffix: "%" } }],
  },
  gold_plateau: {
    worlds: ["riso-poster", "iso-grid", "ink-dawn", "blueprint-tech"],
    actions: ["idle", "walk", "climb", "meditate", "run", "victory"],
    counters: [
      { at: 1, c: { label: "DAY", from: 1, to: 20 } },
      { at: 6, c: { label: "THEN IT BENDS", from: 1, to: 37, prefix: "×" } },
    ],
  },
  ocean_identity: {
    worlds: ["liquid-grad", "cel-stage", "cosmic-orbit"],
    actions: ["idle", "meditate", "levitate", "victory", "walk"],
    counters: [{ at: 4, c: { label: "VOTES FOR YOU", from: 1, to: 300 } }],
  },
  onyx_rescue: {
    worlds: ["neon-city", "neon-city", "neon-city", "cel-stage"],
    actions: ["idle", "walk", "run", "victory"],
    counters: [],
  },
  iron_pain: {
    worlds: ["cel-stage", "neon-city", "cel-stage", "riso-poster"],
    actions: ["lift", "run", "lift", "victory"],
    counters: [],
  },
};

const WORLD_LIGHT = {
  "iso-grid": { tint: "warm", intensity: 0.5, fx: ["shockwave", "speedlines"] },
  "riso-poster": { tint: "warm", intensity: 0.45, fx: ["shockwave"] },
  "ink-dawn": { tint: "warm", intensity: 0.6, fx: ["dust"] },
  "neon-city": { tint: "cool", intensity: 0.7, fx: ["shockwave"] },
  "paper-forest": { tint: "warm", intensity: 0.5, fx: ["dust"] },
  "cosmic-orbit": { tint: "cool", intensity: 0.6, fx: ["shockwave"] },
  "blueprint-tech": { tint: "cool", intensity: 0.4, fx: ["shockwave"] },
  "halftone-comic": { tint: "neutral", intensity: 0.2, fx: ["speedlines", "shockwave"] },
  "liquid-grad": { tint: "warm", intensity: 0.5, fx: ["dust"] },
  "cel-stage": { tint: "warm", intensity: 0.75, fx: ["dust", "shockwave"] },
};

function seeded(seedStr) {
  const h = crypto.createHash("md5").update(seedStr).digest();
  let a = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// camera templates keyed per world feel
function cameraFor(world, d, r) {
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const K = (t, x, y, zoom, rot) => ({ t, x, y, zoom, rot });
  switch (world) {
    case "iso-grid":
      return [K(0, 0, 0, 1.02, 0), K(d * 0.4, 30, 10, 1.08, 0), K(d, 0, -40, 1.16, 0)];
    case "riso-poster":
      return pick([
        [K(0, 0, 0, 1.04, 0), K(d, 0, 26, 1.1, 0)],
        [K(0, 40, 0, 1.06, 1.2), K(d, -30, -14, 1.12, -1.2)],
      ]);
    case "ink-dawn":
      return pick([
        [K(0, 20, 0, 1.04, 0), K(d, -40, 10, 1.12, 0)],
        [K(0, 0, 30, 1.06, 0), K(d, 50, -20, 1.12, 0)],
      ]);
    case "neon-city":
      return [K(0, 0, 20, 1.05, 0), K(d * 0.5, 24, 0, 1.09, 0), K(d, -20, -30, 1.14, 0)];
    case "paper-forest":
      return [K(0, 0, 0, 1.05, 0), K(d, -50, -10, 1.13, 0)];
    case "cosmic-orbit":
      return pick([
        [K(0, 0, 0, 1.03, 0), K(d, 20, -60, 1.12, 1)],
        [K(0, 0, 0, 1.03, -1), K(d, -30, -40, 1.1, 1)],
      ]);
    case "blueprint-tech":
      return [K(0, 60, 0, 1.05, 0), K(d * 0.6, -40, 20, 1.08, 0), K(d, 30, -30, 1.12, 0)];
    case "halftone-comic":
      return [K(0, 0, 0, 1.06, -1), K(d, 0, 10, 1.12, 1)];
    case "liquid-grad":
      return [K(0, 0, 0, 1.03, 0), K(d, 20, 20, 1.08, 0)];
    case "cel-stage":
      return [K(0, 0, 10, 1.04, 0), K(d, 0, -36, 1.13, 0)];
    default:
      return [K(0, 0, 0, 1.04, 0), K(d, 0, -20, 1.1, 0)];
  }
}

// ------------------------------------------------------------- narration parse
function parseSentences(voice) {
  const clean = voice.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

function allocWords(text, start, end) {
  const words = text.split(/\s+/).filter(Boolean);
  const total = words.reduce((a, w) => a + w.length + 1, 0);
  let acc = start;
  return words.map((w) => {
    const share = ((w.length + 1) / total) * (end - start);
    const wd = { w, start: acc, end: acc + share };
    acc += share;
    return wd;
  });
}

// ------------------------------------------------------------------- build
for (const reel of props.reels) {
  const dir = DIRECTION[reel.id];
  const r = seeded(reel.id);
  const audioDur = reel.audioDurationSec;
  const sentences = parseSentences(reel.voice);

  // sentence timing: proportional to word count across the audio
  const weights = sentences.map((s) => s.split(/\s+/).length);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const gaps = 0.05;
  const usable = audioDur - 0.12 - gaps * (sentences.length - 1);
  let cursor = 0.12;
  const timed = sentences.map((s, i) => {
    const d = (weights[i] / totalW) * usable;
    const start = cursor;
    const end = start + d;
    cursor = end + gaps;
    return {
      text: s,
      start,
      end,
      words: allocWords(s, start, end),
    };
  });

  // scenes: hook (sentence 0) → caption scenes → CTA
  const ctaStart = timed[timed.length - 1].end + 0.3;
  const ctaDur = reel.style === "cinematic" ? 4.2 : 2.8;
  const scenes = [];

  timed.forEach((s, i) => {
    const startSec = i === 0 ? 0 : s.start - 0.2;
    const endSec = i === timed.length - 1 ? ctaStart - 0.05 : timed[i + 1].start - 0.15 + 0.1;
    const world = dir.worlds[i % dir.worlds.length];
    const d = Math.max(0.5, endSec - startSec);
    const action = dir.actions[i % dir.actions.length];
    const wl = WORLD_LIGHT[world];
    const counterHit = (dir.counters ?? []).find((c) => c.at === i);
    scenes.push({
      id: `${reel.id}-s${i}`,
      world,
      startSec: Math.max(0, startSec),
      endSec,
      camera: cameraFor(world, d, r),
      action,
      character: true,
      charPos: [540, 1500],
      charScale: 1.2,
      lighting: { tint: wl.tint, intensity: wl.intensity },
      fx: wl.fx,
      counter: counterHit ? counterHit.c : undefined,
      motif: dir.motif && world === "paper-forest" ? dir.motif : undefined,
      narration: s,
      type: i === 0 ? "hook" : "caption",
    });
  });

  scenes.push({
    id: `${reel.id}-cta`,
    world: "cta",
    startSec: ctaStart,
    endSec: ctaStart + ctaDur,
    camera: [{ t: 0, x: 0, y: 0, zoom: 1, rot: 0 }],
    action: "victory",
    character: false,
    charPos: [540, 900],
    charScale: 1,
    lighting: { tint: "neutral", intensity: 0.3 },
    fx: [],
    type: "cta",
  });

  const durationSec = ctaStart + ctaDur + 0.35;
  const frames = Math.ceil(durationSec * FPS);

  // audio reactivity: pad the probe envelope to the full composition
  const probe = JSON.parse(
    fs.readFileSync(path.join(root, "v6", "probe", `${reel.id}.json`), "utf8")
  );
  const envelope = new Array(frames).fill(0);
  for (let f = 0; f < Math.min(frames, probe.envelope.length); f++) {
    envelope[f] = probe.envelope[f];
  }

  const spec = {
    id: reel.id,
    name: reel.name,
    style: reel.style ?? "hype",
    audio: reel.audio,
    audioDurationSec: audioDur,
    durationSec,
    fps: FPS,
    theme: reel.theme,
    hookLines: reel.hookLines,
    scenes,
    cta: { startSec: ctaStart, lines: [reel.name] },
    envelope,
    onsets: probe.onsets,
    brand: props.brand,
  };
  const out = path.join(specDir, `${reel.id}.json`);
  fs.writeFileSync(out, JSON.stringify(spec, null, 1));
  console.log(
    `spec ${reel.id}: ${scenes.length} scenes, ${durationSec.toFixed(2)}s, ${frames} frames`
  );
}
console.log("director done");
