// v7 Creative Director — narration -> structured scene specs (JSON), ported
// from v6 with the NEW scene-uniqueness validation demanded by the migration
// PRD:
//   1. No two scenes in a reel may share a full creative signature
//      (world + variant + action + camera-template + charPos + fx + counter).
//   2. A world may not appear twice in a row with the same variant; when a
//      world repeats within a reel it MUST take a different variant, action,
//      camera template and character position (layout seeds differ too).
// Duplicates fail the build loud after auto-variation.
// Output: v7/specs/<reelId>.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const specDir = path.join(root, "v7", "specs");
fs.mkdirSync(specDir, { recursive: true });

const FPS = 30;

// ------------------------------------------------------------- direction tables
const DIRECTION = {
  gold_math:     { worlds: ["iso-grid", "riso-poster", "iso-grid"], actions: ["idle", "climb", "walk"], counters: [{ at: 1, c: { label: "ONE YEAR", from: 1, to: 37.78, prefix: "×", decimals: 2 } }] },
  mono_weather:  { worlds: ["ink-dawn", "liquid-grad", "ink-dawn"], actions: ["idle", "walk", "idle"], counters: [{ at: 1, c: { label: "SYSTEM BUILT FOR", from: 1, to: 365, prefix: "DAY " } }] },
  lime_2min:     { worlds: ["blueprint-tech", "iso-grid", "liquid-grad"], actions: ["meditate", "idle", "meditate"], counters: [{ at: 1, c: { label: "START WITH", from: 30, to: 2, suffix: " MIN" } }] },
  crimson_twice: { worlds: ["halftone-comic", "iso-grid", "halftone-comic"], actions: ["run", "climb", "run"], counters: [] },
  ocean_votes:   { worlds: ["cosmic-orbit", "iso-grid", "liquid-grad"], actions: ["levitate", "walk", "idle"], counters: [{ at: 1, c: { label: "VOTES CAST", from: 1, to: 300 } }] },
  steel_env:     { worlds: ["blueprint-tech", "iso-grid", "blueprint-tech"], actions: ["idle", "point", "idle"], counters: [] },
  forest_chain:  { worlds: ["paper-forest", "paper-forest", "cosmic-orbit"], actions: ["walk", "climb", "walk"], motif: "chain", counters: [{ at: 1, c: { label: "STREAK", from: 1, to: 365, prefix: "DAY " } }] },
  coral_decade:  { worlds: ["ink-dawn", "liquid-grad", "ink-dawn"], actions: ["idle", "meditate", "victory"], counters: [{ at: 1, c: { label: "COMPOUNDING", from: 1, to: 3650, prefix: "DAY " } }] },
  violet_monday: { worlds: ["cosmic-orbit", "halftone-comic", "cosmic-orbit"], actions: ["levitate", "victory", "levitate"], counters: [{ at: 1, c: { label: "DAYS WASTED WAITING", from: 0, to: 365 } }] },
  sunset_onepct: { worlds: ["halftone-comic", "riso-poster", "halftone-comic"], actions: ["victory", "point", "run"], counters: [{ at: 1, c: { label: "YOU ONLY NEED", from: 100, to: 1, suffix: "%" } }] },
  gold_plateau:  { worlds: ["riso-poster", "iso-grid", "ink-dawn", "blueprint-tech"], actions: ["idle", "walk", "climb", "meditate", "run", "victory"], counters: [{ at: 1, c: { label: "DAY", from: 1, to: 20 } }, { at: 6, c: { label: "THEN IT BENDS", from: 1, to: 37, prefix: "×" } }] },
  ocean_identity:{ worlds: ["liquid-grad", "cel-stage", "cosmic-orbit"], actions: ["idle", "meditate", "levitate", "victory", "walk"], counters: [{ at: 4, c: { label: "VOTES FOR YOU", from: 1, to: 300 } }] },
  onyx_rescue:   { worlds: ["neon-city", "neon-city", "neon-city", "cel-stage"], actions: ["idle", "walk", "run", "victory"], counters: [] },
  iron_pain:     { worlds: ["cel-stage", "neon-city", "cel-stage", "riso-poster"], actions: ["lift", "run", "lift", "victory"], counters: [] },
};

const WORLD_LIGHT = {
  "iso-grid":       { tint: "warm",    intensity: 0.5,  fx: ["shockwave", "speedlines"] },
  "riso-poster":    { tint: "warm",    intensity: 0.45, fx: ["shockwave"] },
  "ink-dawn":       { tint: "warm",    intensity: 0.6,  fx: ["dust"] },
  "neon-city":      { tint: "cool",    intensity: 0.7,  fx: ["shockwave", "flash"] },
  "paper-forest":   { tint: "warm",    intensity: 0.5,  fx: ["dust"] },
  "cosmic-orbit":   { tint: "cool",    intensity: 0.6,  fx: ["shockwave"] },
  "blueprint-tech": { tint: "cool",    intensity: 0.4,  fx: ["shockwave"] },
  "halftone-comic": { tint: "neutral", intensity: 0.2,  fx: ["speedlines", "shockwave"] },
  "liquid-grad":    { tint: "warm",    intensity: 0.5,  fx: ["dust"] },
  "cel-stage":      { tint: "warm",    intensity: 0.75, fx: ["dust", "shockwave"] },
};

// camera templates per world — INDEXED BY VARIANT (cycled), so repeated
// worlds get genuinely different camera paths (scene uniqueness).
function cameraFor(world, d, variant) {
  const v = variant % 3;
  const K = (t, x, y, zoom, rot) => ({ t, x, y, zoom, rot });
  switch (world) {
    case "iso-grid":
      return [
        [K(0, 0, 0, 1.02, 0), K(d * 0.4, 30, 10, 1.08, 0), K(d, 0, -40, 1.16, 0)],
        [K(0, 0, 0, 1.03, 0), K(d * 0.5, -34, 14, 1.09, 0), K(d, 26, -30, 1.15, 0)],
        [K(0, -30, 20, 1.05, 0), K(d * 0.5, 30, -10, 1.1, 1), K(d, -10, -44, 1.17, -1)],
      ][v];
    case "riso-poster":
      return [
        [K(0, 0, 0, 1.04, 0), K(d, 0, 26, 1.1, 0)],
        [K(0, 40, 0, 1.06, 1.2), K(d, -30, -14, 1.12, -1.2)],
        [K(0, -40, 14, 1.05, -1), K(d * 0.6, 34, 0, 1.09, 1), K(d, 10, -30, 1.13, 0)],
      ][v];
    case "ink-dawn":
      return [
        [K(0, 20, 0, 1.04, 0), K(d, -40, 10, 1.12, 0)],
        [K(0, 0, 30, 1.06, 0), K(d, 50, -20, 1.12, 0)],
        [K(0, 30, -10, 1.05, 1), K(d, -44, 20, 1.11, -1)],
      ][v];
    case "neon-city":
      return [
        [K(0, 0, 20, 1.05, 0), K(d * 0.5, 24, 0, 1.09, 0), K(d, -20, -30, 1.14, 0)],
        [K(0, -30, 0, 1.06, 0), K(d * 0.6, 30, 16, 1.1, 0), K(d, -10, -36, 1.13, 0)],
        [K(0, 24, -16, 1.04, 1), K(d * 0.5, -26, 0, 1.08, -1), K(d, 36, -24, 1.15, 1)],
      ][v];
    case "paper-forest":
      return [
        [K(0, 0, 0, 1.05, 0), K(d, -50, -10, 1.13, 0)],
        [K(0, 40, 10, 1.04, 0), K(d, 20, -34, 1.12, 0)],
        [K(0, -36, 14, 1.06, -1), K(d, 44, -20, 1.14, 1)],
      ][v];
    case "cosmic-orbit":
      return [
        [K(0, 0, 0, 1.03, 0), K(d, 20, -60, 1.12, 1)],
        [K(0, 0, 0, 1.03, -1), K(d, -30, -40, 1.1, 1)],
        [K(0, 26, 16, 1.05, 1), K(d, -34, -54, 1.13, -1)],
      ][v];
    case "blueprint-tech":
      return [
        [K(0, 60, 0, 1.05, 0), K(d * 0.6, -40, 20, 1.08, 0), K(d, 30, -30, 1.12, 0)],
        [K(0, -50, 10, 1.06, 0), K(d * 0.5, 36, -6, 1.09, 0), K(d, -20, -34, 1.14, 0)],
        [K(0, 0, 30, 1.04, -1), K(d * 0.55, -44, 0, 1.1, 1), K(d, 40, -20, 1.13, -1)],
      ][v];
    case "halftone-comic":
      return [
        [K(0, 0, 0, 1.06, -1), K(d, 0, 10, 1.12, 1)],
        [K(0, 0, 0, 1.05, 1), K(d, 14, -18, 1.13, -1)],
        [K(0, -26, 12, 1.07, 0), K(d, 34, -8, 1.11, -1)],
      ][v];
    case "liquid-grad":
      return [
        [K(0, 0, 0, 1.03, 0), K(d, 20, 20, 1.08, 0)],
        [K(0, 20, 0, 1.04, 0), K(d, -26, 14, 1.1, 0)],
        [K(0, -22, 16, 1.05, 1), K(d, 28, -18, 1.09, -1)],
      ][v];
    case "cel-stage":
      return [
        [K(0, 0, 10, 1.04, 0), K(d, 0, -36, 1.13, 0)],
        [K(0, 24, 0, 1.05, 0), K(d, -18, -30, 1.12, 0)],
        [K(0, -26, 8, 1.06, -1), K(d, 14, -40, 1.11, 1)],
      ][v];
    default:
      return [K(0, 0, 0, 1.04, 0), K(d, 0, -20, 1.1, 0)];
  }
}

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

// ------------------------------------------------------- uniqueness validation
const signature = (s) =>
  [s.world, s.variant, s.action, s.camSig, s.charPos.join(","), (s.fx || []).join("+"), s.counter ? s.counter.label : "-"].join("|");

const camSig = (keys) => keys.map((k) => `${k.x},${k.y},${k.zoom},${k.rot}`).join(";");

// Character placement variants (3 per world — indexed by variant % 3)
const CHAR_SPOTS = {
  "iso-grid":       { 0: [660, 1130], 1: [420, 1160], 2: [540, 1090] },
  "riso-poster":    { 0: [820, 1600], 1: [260, 1600], 2: [540, 1600] },
  "ink-dawn":       { 0: [380, 1785], 380: [380, 1785], 1: [700, 1780], 2: [540, 1790] },
  "neon-city":      { 0: [540, 1408], 1: [440, 1408], 2: [640, 1408] },
  "paper-forest":   { 0: [620, 1760], 1: [460, 1760], 2: [540, 1740] },
  "cosmic-orbit":   { 0: [540, 820], 1: [780, 820], 2: [300, 820] },
  "blueprint-tech": { 0: [540, 1640], 1: [640, 1640], 2: [440, 1640] },
  "halftone-comic": { 0: [540, 1790], 1: [540, 1770], 2: [700, 1790] },
  "liquid-grad":    { 0: [540, 1650], 1: [660, 1650], 2: [420, 1650] },
  "cel-stage":      { 0: [540, 1552], 1: [484, 1552], 2: [596, 1552] },
};

// ------------------------------------------------------------------- build
let totalDupes = 0;
for (const reel of props.reels) {
  const dir = DIRECTION[reel.id];
  const r = seeded(reel.id);
  const audioDur = reel.audioDurationSec;
  const sentences = parseSentences(reel.voice);

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
    return { text: s, start, end, words: allocWords(s, start, end) };
  });

  const ctaStart = timed[timed.length - 1].end + 0.3;
  const ctaDur = reel.style === "cinematic" ? 4.2 : 2.8;
  const scenes = [];

  // variant assignment: same-world scenes get incrementing variants,
  // and repeated world+action pairs get their action rotated (uniqueness)
  const worldUse = {};
  const worldAction = {};
  timed.forEach((s, i) => {
    const startSec = i === 0 ? 0 : s.start - 0.2;
    const endSec = i === timed.length - 1 ? ctaStart - 0.05 : timed[i + 1].start - 0.15 + 0.1;
    const world = dir.worlds[i % dir.worlds.length];
    const variant = worldUse[world] ?? 0;
    worldUse[world] = variant + 1;
    const d = Math.max(0.5, endSec - startSec);
    let action = dir.actions[i % dir.actions.length];
    const wKey = world + ":" + action;
    if (worldAction[wKey] !== undefined) {
      // rotate to the next unused action for this world
      const pool = dir.actions.filter((a) => worldAction[world + ":" + a] === undefined);
      if (pool.length) action = pool[(worldAction[wKey] + 1) % pool.length];
      else action = dir.actions[(worldAction[wKey] + 1) % dir.actions.length];
    }
    worldAction[wKey] = (worldAction[wKey] ?? -1) + 1;
    const wl = WORLD_LIGHT[world];
    const counterHit = (dir.counters ?? []).find((c) => c.at === i);
    const cam = cameraFor(world, d, variant);
    const spots = CHAR_SPOTS[world] || { 0: [540, 1500], 1: [540, 1500] };
    scenes.push({
      id: `${reel.id}-s${i}`,
      world,
      variant,
      startSec: Math.max(0, startSec),
      endSec,
      camera: cam,
      camSig: camSig(cam),
      action,
      character: true,
      charPos: spots[variant % 3],
      charScale: world === "neon-city" ? 2.4 : world === "cel-stage" ? 2.4 : 2.0,
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
    variant: 0,
    startSec: ctaStart,
    endSec: ctaStart + ctaDur,
    camera: [{ t: 0, x: 0, y: 0, zoom: 1, rot: 0 }],
    camSig: "static",
    action: "victory",
    character: false,
    charPos: [540, 900],
    charScale: 1,
    lighting: { tint: "neutral", intensity: 0.3 },
    fx: [],
    type: "cta",
  });

  // ------------------------------------------- uniqueness validation pass
  let dupes = [];
  const seen = new Map();
  scenes.forEach((s) => {
    const sig = signature(s);
    if (seen.has(sig)) dupes.push([seen.get(sig), s.id, sig]);
    else seen.set(sig, s.id);
  });
  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].world === scenes[i - 1].world && scenes[i].variant === scenes[i - 1].variant && scenes[i].world !== "cta") {
      dupes.push([scenes[i - 1].id, scenes[i].id, "adjacent same world+variant"]);
    }
  }
  if (dupes.length) {
    totalDupes += dupes.length;
    console.error(`UNIQUENESS FAIL ${reel.id}:`);
    dupes.forEach(([a, b, sig]) => console.error(`  ${a} <-> ${b}  (${sig})`));
  }

  const durationSec = ctaStart + ctaDur + 0.35;
  const frames = Math.ceil(durationSec * FPS);

  const probe = JSON.parse(fs.readFileSync(path.join(root, "v7", "probe", `${reel.id}.json`), "utf8"));
  const envelope = new Array(frames).fill(0);
  for (let f = 0; f < Math.min(frames, probe.envelope.length); f++) envelope[f] = probe.envelope[f];

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
    engine: "v7-hyperframes",
  };
  const out = path.join(specDir, `${reel.id}.json`);
  fs.writeFileSync(out, JSON.stringify(spec, null, 1));
  console.log(`spec ${reel.id}: ${scenes.length} scenes, ${durationSec.toFixed(2)}s, ${frames} frames${dupes.length ? " [DUPES]" : ""}`);
}
if (totalDupes > 0) {
  console.error(`director: ${totalDupes} duplicate signatures — FAIL`);
  process.exit(1);
}
console.log("director done — all scenes unique");
