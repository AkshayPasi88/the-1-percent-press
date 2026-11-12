#!/usr/bin/env node
// director.mjs — the Creative Director Agent (engine v6).
// Understands the narration (roles + keywords), selects the visual world per
// sentence, stages the Seeker, places custom objects, designs camera, lighting
// and narration-synced fx (lightning on the word "storm", sunrise on "sun"),
// and validates the storyboard schema before any frame is rendered.
//
// The output plan keeps the v5 contract (segments/hook/cta/scenes) and adds:
//   scenes[].kind = "story" with { world, actor, props, light, fxs }
//   plan.fxs = [{ t, type, ... }]  (shared clock: visuals + thunder in the mix)
import fs from "node:fs";

// ————————————————————————————————— seeded helpers ————————————————————————
export function mulberry(seed) {
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

// ————————————————————————————————— world casting ————————————————————————
// How the director reads a line: keyword scores per world template. The
// chain [dark_mountain → road → climb → storm → summit] is the fallback
// narrative escalation for journey-style scripts.

const WORLD_KEYWORDS = {
  dark_mountain: "dark night alone save rescue hero miracle luck nobody coming standing start starting line cold moon mountain sleep waiting",
  road: "walk walking road path leave move moving start empty alone mile quiet street step journey begin",
  climb: "climb climbing steep hill mountain up upper rise rising break breaking hard grip hold hands fall rock",
  storm: "storm rain thunder wind fight test break rage weather pain cold lightning dark forge",
  summit: "sun sunrise dawn light rise rises rising top summit peak keep moving don stop one day meet become future build built everything worth arrive",
  vault: "money coin gold rich pay bank cash value price fortune worth stack compound",
  city: "city build building future empire construct tower skyline create make work craft",
  study: "read reading book page study learn mind knowledge quiet night lamp discipline habit",
};
const CHAIN = ["dark_mountain", "road", "climb", "storm", "summit"];

const ACTION_BY_WORLD = {
  dark_mountain: { first: "kneel", then: ["stand", "rise"] },
  road: { first: "walk", then: ["walk", "walk"] },
  climb: { first: "climb", then: ["climb"] },
  storm: { first: "lean", then: ["lean", "climb"] },
  summit: { first: "walk", then: ["triumph", "stand"] },
  vault: { first: "stand", then: ["stand"] },
  city: { first: "stand", then: ["stand"] },
  study: { first: "stand", then: ["stand"] },
};

// world → stage design: actor size/pos, camera pool, lighting, props
const STAGE = {
  dark_mountain: {
    actor: { x: 0.5, y: 0.86, h: 0.3, dir: 1 },
    cams: ["push", "pull", "crane", "drift"],
    light: { mood: "dark", rim: 0.45, shadow: 0.85 },
    props: () => [],
  },
  road: {
    actor: { x: 0.5, y: 0.88, h: 0.36, dir: 1, stride: 2.6 },
    cams: ["follow", "push", "panL", "panR"],
    light: { mood: "dark", rim: 0.55, shadow: 0.7 },
    props: () => [],
  },
  climb: {
    actor: { x: 0.42, y: 0.66, h: 0.3, dir: 1, stride: 1.7 },
    cams: ["push", "crane", "tilt", "drift"],
    light: { mood: "dark", rim: 0.6, shadow: 0.75 },
    props: () => [],
    climbPath: { x0: 0.36, x1: 0.55, y0: 0.84, y1: 0.42 },
  },
  storm: {
    actor: { x: 0.5, y: 0.86, h: 0.34, dir: 1 },
    cams: ["shake", "punch", "push"],
    light: { mood: "storm", rim: 0.4, shadow: 0.8 },
    props: () => [],
  },
  summit: {
    actor: { x: 0.5, y: 0.86, h: 0.32, dir: 1 },
    cams: ["pull", "crane", "push", "follow"],
    light: { mood: "dawn", rim: 0.9, shadow: 0.5 },
    props: () => [],
    flag: { x: 0.66, y: 0.885, s: 0.18 },
  },
  vault: {
    actor: { x: 0.42, y: 0.86, h: 0.32, dir: 1 },
    cams: ["push", "pull", "drift"],
    light: { mood: "gold", rim: 0.8, shadow: 0.6 },
    props: (rng) => [{ obj: "coins", x: 0.72, y: 0.86, s: 0.16, o: { stack: 6 + Math.floor(rng() * 5), seed: 12 } }],
  },
  city: {
    actor: { x: 0.42, y: 0.9, h: 0.3, dir: 1 },
    cams: ["push", "pull", "crane"],
    light: { mood: "dark", rim: 0.5, shadow: 0.75 },
    props: () => [],
    cityProg: { prog0: 0.25, prog1: 0.95 },
  },
  study: {
    actor: { x: 0.44, y: 0.88, h: 0.3, dir: 1 },
    cams: ["push", "drift", "pull"],
    light: { mood: "gold", rim: 0.7, shadow: 0.65 },
    props: () => [{ obj: "books", x: 0.68, y: 0.9, s: 0.2 }],
  },
};

// props cued by keywords in the line (the world answers the narration)
const CUE_PROPS = [
  { re: /\b(starting line|starting-line)\b/, prop: { obj: "startline", x: 0.5, y: 0.9, o: { w: 0.66 } } },
  { re: /\b(clock|time|five am|5 am|hour)\b/, prop: { obj: "bigclock", x: 0.72, y: 0.3, s: 0.3, o: { urgency: 0.6 } } },
  { re: /\balarm\b/, prop: { obj: "alarm", x: 0.74, y: 0.42, s: 0.13, o: { shake: 1 } } },
  { re: /\b(coins?|money|gold|pay)\b/, prop: { obj: "coins", x: 0.72, y: 0.86, s: 0.15, o: { stack: 8 } } },
  { re: /\b(page|read|book|study)\b/, prop: { obj: "books", x: 0.7, y: 0.9, s: 0.2 } },
  { re: /\b(birds?|dawn|morning)\b/, prop: { obj: "birds", x: 0.25, y: 0.18, s: 0.03, o: { n: 5 } } },
];

function scoreWorld(text, world) {
  const words = String(text).toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  const keys = WORLD_KEYWORDS[world].split(" ");
  let s = 0;
  for (const k of keys) {
    if (k.length > 2 && words.includes(" " + k + " ")) s += k.length > 5 ? 2 : 1;
    else if (words.includes(k)) s += 0.6;
  }
  return s;
}

// ————————————————————————————————— the storyboard ————————————————————————

/**
 * Build the storyboard: story scenes for each body sentence + hook word-slam
 * scenes + CTA bed scenes. rng is the film's seeded stream (deterministic).
 *   reel: { sentences, palette, bpm, ... }
 *   lines: TTS lines [{ dur, words }] aligned with reel.sentences
 *   timeline: [{ t0, t1, role, words }] per sentence (from the planner)
 */
export function buildStoryboard(rng, reel, lines, timeline, hook, ctaT0, DUR) {
  const scenes = [];
  const fxs = [];
  let n = 0;
  let worldCursor = -1;
  let lastWorld = null;

  const mk = (spec) => {
    n++;
    spec.id = "s" + n;
    spec.seed = Math.floor(rng() * 0xfffffff);
    spec.speed = +rrange(rng, 0.85, 1.3).toFixed(2);
    return spec;
  };

  // ——— hook: word-slam scenes over abstract bg (kind:"hook") ———
  const BG = ["rings", "flow", "tunnel", "shards", "stripes", "glitch"];
  for (let i = 0; i < hook.words.length; i++) {
    const w0 = hook.words[i].t0;
    const w1 = i + 1 < hook.words.length ? hook.words[i + 1].t0 : hook.t1;
    const prev = i > 0 ? BG[(i - 1) % BG.length] : null;
    let type = BG[i % BG.length];
    if (type === prev) type = BG[(i + 3) % BG.length];
    scenes.push(mk({
      kind: "hook", t0: +(w0 - 0.05).toFixed(3), t1: +Math.max(w0 + 0.2, w1).toFixed(3),
      type, cam: pick(rng, ["punch", "shake", "push"]),
      trans: pick(rng, ["flash", "flash", "streak", "glitchBurst"]),
    }));
  }

  // ——— body: one story scene per sentence (split if very long) ———
  for (let si = 1; si < timeline.length; si++) {
    const segm = timeline[si];
    const text = segm.text || reel.sentences[si].text;
    const isLast = si === timeline.length - 1;

    // choose the world: keyword scores first, escalation chain as fallback
    let world = null, best = 0;
    for (const w of Object.keys(WORLD_KEYWORDS)) {
      const s = scoreWorld(text, w) - (w === lastWorld ? 0.8 : 0); // discourage repeats
      if (s > best) { best = s; world = w; }
    }
    if (!world || best < 1.2) {
      worldCursor = Math.min(worldCursor + 1, CHAIN.length - 1);
      world = CHAIN[worldCursor];
      // repeated fallback (short script): cycle forward for variety
      if (world === lastWorld) worldCursor = Math.min(worldCursor + 1, CHAIN.length - 1), world = CHAIN[worldCursor];
    } else {
      worldCursor = CHAIN.indexOf(world);
    }
    lastWorld = world;
    const stage = STAGE[world];

    // actor action: first appearance in a world gets the defining beat,
    // later returns vary from the pool
    const actions = ACTION_BY_WORLD[world];
    const seen = scenes.filter((s) => s.world === world).length > 0;
    const action = !seen ? actions.first : pick(rng, actions.then);

    // scene window: the sentence + a breath of lead-in/out
    let t0 = +(segm.t0 - 0.1).toFixed(3);
    let t1 = +(segm.t1 + (isLast ? 0.5 : 0.3)).toFixed(3);
    // split overlong scenes on the beat grid (keeps 1–3s change cadence)
    const beat = 60 / reel.bpm;
    const MAXS = 4.4;
    const parts = [];
    if (t1 - t0 > MAXS) {
      let s = t0;
      while (t1 - s > MAXS) {
        const beats = [4, 6, 8, 12, 16].map((b) => b * beat).filter((d) => d <= MAXS && d < t1 - s);
        const d = beats.length ? pick(rng, beats) : MAXS;
        parts.push([s, s + d]);
        s += d;
      }
      parts.push([s, t1]);
    } else parts.push([t0, t1]);

    parts.forEach(([p0, p1], pi) => {
      const sc = mk({
        kind: "story", t0: +p0.toFixed(3), t1: +p1.toFixed(3),
        world, type: "story", // type kept for noise seeding
        cam: pick(rng, stage.cams),
        trans: pi === 0 ? pick(rng, ["ink", "ink", "wipe"]) : pick(rng, ["cut", "flash", "streak"]),
        light: Object.assign({}, stage.light),
        props: [],
      });
      // actor staging
      const a = Object.assign({}, stage.actor);
      if (action === "rise") { a.action = "rise"; a.from = "kneel"; }
      else a.action = action;
      if (world === "climb" && stage.climbPath) {
        const f0 = pi / Math.max(1, parts.length), f1 = (pi + 1) / Math.max(1, parts.length);
        a.x0 = lerpN(stage.climbPath.x0, stage.climbPath.x1, f0);
        a.x1 = lerpN(stage.climbPath.x0, stage.climbPath.x1, f1);
        a.y0 = lerpN(stage.climbPath.y0, stage.climbPath.y1, f0);
        a.y1 = lerpN(stage.climbPath.y0, stage.climbPath.y1, f1);
        a.x = a.x0; a.y = a.y0;
      }
      sc.actor = a;
      // director-cued props + stage default props
      sc.props = stage.props(rng).slice();
      if (pi === 0) {
        for (const cue of CUE_PROPS) {
          if (cue.re.test(String(text).toLowerCase())) { sc.props.push(Object.assign({}, cue.prop)); break; }
        }
      }
      // world params
      if (world === "city") sc.prog0 = lerpN(0.2, 0.9, pi / Math.max(1, parts.length)), sc.prog1 = lerpN(0.2, 0.9, (pi + 0.7) / Math.max(1, parts.length));
      if (world === "summit") {
        sc.rise0 = pi === 0 ? 0.12 : 0.5;
        sc.rise1 = pi === parts.length - 1 ? 0.85 : 0.55;
        if (isLast) { sc.rise0 = 0.85; sc.rise1 = 1.0; sc.light = { mood: "gold", rim: 0.95, shadow: 0.4 }; sc.cam = "pull"; }
      }
      scenes.push(sc);
    });

    // ——— narration-synced fx events (shared clock with the mix) ———
    const words = (segm.words || []).map((w) => ({ ...w }));
    const findW = (re) => {
      for (const w of words) if (re.test(w.text.toLowerCase())) return w;
      return null;
    };
    // lightning on the storm word (or mid-line in storm scenes)
    if (world === "storm") {
      const w = findW(/storm|thunder|lightning|rain/) || midWord(words);
      if (w) fxs.push({ t: +w.t0.toFixed(3), type: "lightning", x: 0.24 + rng() * 0.4, dx: (rng() - 0.5) * 0.2, y: 0.55 });
      if (rng() > 0.35) {
        const w2 = midWord(words);
        if (w2 && w2.t0 > (w ? w.t0 : -1) + 1.2) fxs.push({ t: +(w2.t0 + 0.4).toFixed(3), type: "lightning", x: 0.3 + rng() * 0.4, dx: (rng() - 0.5) * 0.2, y: 0.4 });
      }
    }
    // sunrise swell on the sun word
    if (world === "summit" && !isLast) {
      const w = findW(/sun|rise|rises|dawn|light/) || midWord(words);
      if (w) fxs.push({ t: +w.t0.toFixed(3), type: "sunrise" });
    }
    // flag plant near the end of the final scene
    if (world === "summit" && isLast) {
      const flagT = +(segm.t1 + 0.15).toFixed(3);
      fxs.push({ t: flagT, type: "flag" });
      const sc = scenes[scenes.length - 1];
      sc.props.push({ obj: "flag", x: STAGE.summit.flag.x, y: STAGE.summit.flag.y, s: STAGE.summit.flag.s, o: { wind: 0.6 } });
      sc.actor = Object.assign({}, sc.actor, { action: "triumph" });
    }
  }

  // ——— CTA bed: two calm readable scenes ———
  const CALM = ["waves", "blobs", "orbits", "rings"];
  const c1 = pick(rng, CALM), c2 = pick(rng, CALM.filter((c) => c !== c1));
  scenes.push(mk({ kind: "cta", t0: +ctaT0.toFixed(3), t1: +(ctaT0 + 1.9).toFixed(3), type: c1, cam: "drift", trans: "wipe" }));
  scenes.push(mk({ kind: "cta", t0: +(ctaT0 + 1.9).toFixed(3), t1: +DUR.toFixed(3), type: c2, cam: "push", trans: "cut" }));

  // stitch: sort + close gaps
  scenes.sort((a, b) => a.t0 - b.t0);
  for (let i = 0; i < scenes.length - 1; i++) {
    if (scenes[i + 1].t0 - scenes[i].t1 > 0.05) scenes[i].t1 = +(scenes[i + 1].t0).toFixed(3);
  }
  // hook scene 0 starts at 0
  if (scenes[0].t0 > 0) scenes[0].t0 = 0;
  scenes[scenes.length - 1].t1 = DUR;

  const storyScenes = scenes.filter((s) => s.kind === "story");
  return { scenes, fxs, storyScenes };
}

const midWord = (words) => (words && words.length ? words[Math.floor(words.length / 2)] : null);
const lerpN = (a, b, f) => a + (b - a) * f;

// ————————————————————————————————— schema validation —————————————————————
/** Throws on any storyboard violation — the render never starts from a bad plan. */
export function validateStoryboard(plan, engine) {
  const errs = [];
  const S = plan.scenes;
  const known = new Set((engine && engine.WORLDS_LIST) || ["dark_mountain", "road", "climb", "storm", "summit", "vault", "city", "study"]);
  const ACTIONS = new Set(["kneel", "stand", "rise", "walk", "run", "climb", "lean", "triumph"]);
  const CAMS = new Set(["push", "pull", "panL", "panR", "punch", "shake", "tilt", "drift", "crane", "follow"]);

  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (!(s.t1 > s.t0)) errs.push(`${s.id}: t1<=t0`);
    if (s.kind === "story") {
      if (!known.has(s.world)) errs.push(`${s.id}: unknown world "${s.world}"`);
      if (s.actor && !ACTIONS.has(s.actor.action)) errs.push(`${s.id}: bad action "${s.actor.action}"`);
      if (!CAMS.has(s.cam)) errs.push(`${s.id}: bad cam "${s.cam}"`);
      if (!s.light || !s.light.mood) errs.push(`${s.id}: story scene missing lighting`);
    } else if (!CAMS.has(s.cam)) errs.push(`${s.id}: bad cam "${s.cam}"`);
    if (i > 0 && s.t0 - S[i - 1].t1 > 0.02) errs.push(`gap between ${S[i - 1].id} and ${s.id}`);
  }
  // coverage: every body sentence window overlaps a story scene
  for (let i = 1; i < plan.segments.length; i++) {
    const segm = plan.segments[i];
    const covered = S.some((s) => s.kind === "story" && s.t0 < segm.t1 && s.t1 > segm.t0);
    if (!covered) errs.push(`sentence ${i} has no story scene`);
  }
  // character consistency: exactly one card ever (implicit via plan.palette);
  // fxs must land inside the film
  for (const fx of plan.fxs || []) {
    if (fx.t < 0 || fx.t > plan.DUR) errs.push(`fx ${fx.type} at ${fx.t}s outside film`);
  }
  // pacing: no story scene longer than 4.6s (change cadence rule)
  for (const s of S) if (s.kind === "story" && s.t1 - s.t0 > 4.62) errs.push(`${s.id} too long (${(s.t1 - s.t0).toFixed(2)}s)`);
  // variety: at least 3 distinct worlds in a journey film
  const worlds = new Set(S.filter((s) => s.kind === "story").map((s) => s.world));
  if (plan.segments.length > 6 && worlds.size < 3) errs.push(`only ${worlds.size} worlds staged`);

  if (errs.length) {
    throw new Error("storyboard validation failed:\n  - " + errs.join("\n  - "));
  }
  return true;
}
