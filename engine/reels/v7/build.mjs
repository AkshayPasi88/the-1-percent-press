// v7 build — turns each v7 scene spec into a complete HyperFrames project
// (build/<reelId>/): root index.html (scene hosts + narration audio), one
// composition file per scene (world SVG + canonical character + GSAP motion),
// assets (fonts, audio, character reference). Deterministic: same spec ->
// byte-identical project.
//
// Usage: node v7/build.mjs [--reel 1,2|all] [--scene 3] [--reel-id gold_math]
//   --scene renders a single-scene preview project (build/<id>-s<i>/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORLDS, hexA, mixHex } from "./lib/worlds.mjs";
import { rngFor } from "./lib/prng.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const buildDir = path.join(root, "build");
const charSvg = fs.readFileSync(path.join(root, "v7", "assets", "characters", "theone.svg"), "utf8");
const sceneKit = fs.readFileSync(path.join(root, "v7", "lib", "scene-kit.js"), "utf8");
const characterJs = fs.readFileSync(path.join(root, "v7", "lib", "character.js"), "utf8");

const GSAP = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
const W = 1080;
const H = 1920;
const FPS = 30;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const onlyArg = flag("--reel");
const sceneIdx = flag("--scene") !== null ? parseInt(flag("--scene"), 10) : null;
const onlyId = flag("--reel-id");

const jobs = props.reels
  .map((reel, i) => ({ reel, n: i + 1 }))
  .filter(({ reel, n }) => {
    if (onlyId) return reel.id === onlyId;
    if (onlyArg && onlyArg !== "all") return onlyArg.split(",").map(Number).includes(n);
    return true;
  });

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// character markup with scene-prefixed ids (ids must be unique across the
// assembled render page — every scene inlines the SAME canonical rig)
function characterMarkup(p) {
  return charSvg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/id="to-/g, `id="${p}to-`)
    .trim();
}

function fontFaceCSS() {
  return `@font-face{font-family:'Anton';src:url('assets/fonts/Anton-Regular.ttf');font-weight:400;font-display:block}
@font-face{font-family:'Source Sans 3';src:url('assets/fonts/SourceSans3-400.ttf');font-weight:400;font-display:block}
@font-face{font-family:'Source Sans 3';src:url('assets/fonts/SourceSans3-600.ttf');font-weight:600;font-display:block}
@font-face{font-family:'Source Sans 3';src:url('assets/fonts/SourceSans3-700.ttf');font-weight:700;font-display:block}`;
}

// ---------------------------------------------------------------- type layers
function typeMarkup(scene, spec, p) {
  const th = spec.theme;
  let m = "";
  let css = "";
  if (scene.type === "hook") {
    m += `<div id="${p}hook">`;
    spec.hookLines.forEach((line, li) => {
      const size = line.length > 14 ? 96 : 128;
      m += `<div class="hk-line" style="font-size:${size}px">`;
      line.split("").forEach((ch, ci) => {
        m += ch === " " ? `<span class="hk-ch sp">&nbsp;</span>` : `<span class="hk-ch" id="${p}hk-${li}-${ci}">${esc(ch)}</span>`;
      });
      m += `</div>`;
    });
    m += `</div>`;
    css += `#${p}hook{position:absolute;top:220px;left:60px;right:60px;display:flex;flex-direction:column;align-items:center;gap:10px;z-index:10}
.hk-line{font-family:'Anton';line-height:1.04;color:${th.ink};text-transform:uppercase;text-align:center;letter-spacing:2px;text-shadow:5px 4px 0 ${mixHex(th.accent, "#000000", 0.52)}}
.hk-ch{display:inline-block;opacity:0}
.hk-ch.sp{width:0.35em}`;
  }
  if (scene.narration && scene.type === "caption") {
    m += `<div id="${p}cap"><div class="cap-box">`;
    scene.narration.words.forEach((w, i) => {
      m += `<span class="cw" id="${p}cw-${i}">${esc(w.w)}</span>`;
    });
    m += `</div></div>`;
    css += `#${p}cap{position:absolute;bottom:172px;left:80px;right:80px;display:flex;justify-content:center;z-index:10}
.cap-box{max-width:860px;background:rgba(8,8,10,0.62);border:2px solid ${hexA(th.accent, 0.35)};border-radius:26px;padding:22px 34px;display:flex;flex-wrap:wrap;justify-content:center;gap:0 14px}
.cw{font-family:'Source Sans 3';font-weight:700;font-size:47px;line-height:1.25;color:${hexA(th.ink, 0.62)};display:inline-block}`;
  }
  if (scene.counter) {
    m += `<div id="${p}ctr"><div class="ctr-label">${esc(scene.counter.label)}</div><div class="ctr-num" id="${p}ctr-num">${esc(scene.counter.prefix || "")}${scene.counter.from}${esc(scene.counter.suffix || "")}</div></div>`;
    css += `#${p}ctr{position:absolute;top:250px;left:0;right:0;display:flex;flex-direction:column;align-items:center;z-index:10}
.ctr-label{font-family:'Source Sans 3';font-weight:600;font-size:44px;letter-spacing:10px;color:${th.inkSoft};text-transform:uppercase;background:rgba(8,8,10,0.45);border-radius:999px;padding:8px 30px}
.ctr-num{font-family:'Anton';font-size:200px;letter-spacing:4px;color:${th.ink};margin-top:10px}`;
  }
  if (scene.type !== "cta") {
    m += `<div id="${p}brand"><span class="bdot"></span>${esc(spec.brand.handle.toUpperCase())}</div>`;
    css += `#${p}brand{position:absolute;top:92px;left:0;right:0;display:flex;justify-content:center;z-index:11}
#${p}brand{font-family:'Source Sans 3';font-weight:600;font-size:34px;letter-spacing:4px;color:${th.inkSoft};background:rgba(8,8,10,0.4);border-radius:999px;padding:10px 28px;width:max-content;margin:0 auto}
.bdot{width:12px;height:12px;border-radius:6px;background:${th.accent};display:inline-block}`;
  }
  if (scene.type === "cta") {
    m += `<div id="${p}cta-type">
      <div class="cta-title">${esc(spec.brand.ebookTitle)}</div>
      <div class="cta-sub">${esc(spec.brand.ebookSub)}</div>
      <div class="cta-chip" id="${p}cta-chip">${esc(spec.brand.cta)}</div>
      <div class="cta-handle">${esc(spec.brand.handle.toUpperCase())}</div>
    </div>`;
    css += `#${p}cta-type{position:absolute;top:1020px;left:60px;right:60px;display:flex;flex-direction:column;align-items:center;z-index:10}
.cta-title{font-family:'Anton';font-size:110px;color:${th.ink};letter-spacing:2px;text-shadow:6px 5px 0 ${mixHex(th.accent, "#000000", 0.55)}}
.cta-sub{font-family:'Source Sans 3';font-weight:600;font-size:33px;color:${th.inkSoft};margin-top:14px;letter-spacing:1px;max-width:760px;text-align:center}
.cta-chip{margin-top:44px;font-family:'Source Sans 3';font-weight:700;font-size:40px;letter-spacing:3px;color:#0B0C10;background:${th.accent};border-radius:999px;padding:20px 46px;box-shadow:0 10px 40px ${hexA(th.accent, 0.4)}}
.cta-handle{margin-top:26px;font-family:'Source Sans 3';font-weight:600;font-size:30px;letter-spacing:5px;color:${th.inkSoft}}`;
  }
  return { m, css };
}

// ---------------------------------------------------------------- fx markup
function fxMarkup(scene, spec, p) {
  const th = spec.theme;
  const has = (k) => (scene.fx || []).includes(k);
  let m = "";
  if (has("shockwave")) m += `<circle id="${p}fx-ring" cx="540" cy="820" r="60" fill="none" stroke="${hexA(th.accent, 0.5)}" stroke-width="14" opacity="0"/>`;
  if (has("speedlines")) {
    const R = rngFor("sl:" + spec.id + ":" + scene.id);
    let lines = "";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + R() * 0.4;
      const r1 = 300;
      const r2 = r1 + 260 + R() * 240;
      lines += `<line x1="${(540 + Math.cos(a) * r1).toFixed(1)}" y1="${(820 + Math.sin(a) * r1).toFixed(1)}" x2="${(540 + Math.cos(a) * r2).toFixed(1)}" y2="${(820 + Math.sin(a) * r2).toFixed(1)}" stroke="${hexA(th.ink, 0.4)}" stroke-width="7" stroke-linecap="round"/>`;
    }
    m += `<g id="${p}fx-speed" opacity="0">${lines}</g>`;
  }
  if (has("dust")) {
    const R = rngFor("dust:" + scene.id);
    let dots = "";
    for (let i = 0; i < 30; i++) dots += `<circle id="${p}fx-d${i}" cx="${(R() * 1200 - 60).toFixed(1)}" cy="${(R() * 2000 - 80).toFixed(1)}" r="${(1.5 + R() * 2.5).toFixed(1)}" fill="${hexA(th.ink, 0.3)}"/>`;
    m += `<g id="${p}fx-dust">${dots}</g>`;
  }
  if (has("flash")) m += `<rect id="${p}fx-flash" x="0" y="0" width="${W}" height="${H}" fill="${hexA(th.accent, 1)}" opacity="0"/>`;
  return m;
}

// dust drift tweens (linear, continuous)
function dustAnim(scene, p, dur) {
  if (!(scene.fx || []).includes("dust")) return "";
  let a = "";
  for (let i = 0; i < 30; i++) {
    const R = rngFor("dust:" + scene.id + ":" + i);
    const dy = 12 + R() * 20;
    a += `tl.fromTo("#${p}fx-d${i}",{attr:{transform:"translate(0 0)"}},{attr:{transform:"translate(${(Math.sin(R() * 9) * 30).toFixed(1)} ${(-dy * dur).toFixed(1)})"}},0);\n`;
  }
  return a;
}

// ---------------------------------------------------------------- scene file
function buildSceneFile(scene, spec, isFirst) {
  const slug = scene.world;
  const sid = `s${String(scene.index).padStart(2, "0")}-${slug}`;
  const p = sid + "-";
  const worldGen = WORLDS[scene.world];
  if (!worldGen) throw new Error(`unknown world: ${scene.world}`);

  const startF = scene.startFrame;
  const dur = scene.durFrame / FPS;

  // scene-local envelope + onsets
  const env = [];
  for (let f = startF; f < startF + scene.durFrame; f++) env.push(spec.envelope[f] ?? 0);
  const onsets = spec.onsets
    .filter((f) => f >= startF && f < startF + scene.durFrame)
    .map((f) => Math.round(((f - startF) / FPS) * 1000) / 1000);

  const ctx = { dur, onsets };
  const world = worldGen(scene, spec, p, ctx);
  const type = typeMarkup(scene, spec, p);
  const fx = fxMarkup(scene, spec, p);
  const th = spec.theme;

  const char = scene.character ? world.char : null;
  const charM = char
    ? `<g id="${p}char">${characterMarkup(p)}</g>`
    : "";

  const gradeTint = scene.lighting.tint === "cool" ? "#3A56C8" : scene.lighting.tint === "warm" ? th.accent : th.ink;
  const gradeOp = (scene.lighting.intensity * 0.16).toFixed(3);

  const script = `(function () {
  const v7 = {};
${sceneKit}
${characterJs}
  const SID = ${JSON.stringify(sid)};
  const P = ${JSON.stringify(p)};
  const DUR = ${JSON.stringify(Math.round(dur * 1000) / 1000)};
  const ENV = ${JSON.stringify(env)};
  const ONSETS = ${JSON.stringify(onsets)};
  const SCENE = ${JSON.stringify({
    action: scene.action,
    type: scene.type,
    camera: scene.camera,
    fx: scene.fx,
    counter: scene.counter || null,
    hookLines: scene.type === "hook" ? spec.hookLines : null,
    words: scene.narration ? scene.narration.words.map((w) => ({ w: w.w, start: w.start - scene.startSec, end: w.end - scene.startSec })) : null,
    startSec: scene.startSec,
  })};
  const TH = ${JSON.stringify(th)};
  const gsap = window.gsap;
  const tl = gsap.timeline({ paused: true });

  v7.wipe(tl, P, ${isFirst ? "true" : "false"}, DUR);
  v7.camera(tl, P, SCENE.camera, DUR);
  v7.envProxy(tl, P, SID, ENV, DUR);
${world.anim}
${dustAnim(scene, p, dur)}
  v7.onsetFx(tl, P, TH, ONSETS, SCENE.fx, DUR);
${char ? `v7.placeCharacter(P, ${JSON.stringify(char.pos)}, ${char.scale}, ${char.facing});
  v7.character(tl, P, SCENE.action, DUR);` : ""}
  if (SCENE.type === "hook" && SCENE.hookLines) v7.hook(tl, P, SCENE.hookLines, TH, DUR);
  if (SCENE.words) v7.captions(tl, P, SCENE.words, TH, DUR, SCENE.startSec);
  if (SCENE.counter) v7.counter(tl, P, SCENE.counter, DUR);
  if (SCENE.type !== "cta") v7.brand(tl, P, DUR);
${scene.type === "cta" ? `  // CTA type choreography
  tl.set("#" + P + "cta-type", { opacity: 0 }, 0.001);
  tl.fromTo("#" + P + "cta-type", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.4)" }, 0.5);
  tl.fromTo("#" + P + "cta-chip", { scale: 1 }, { scale: 1.06, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: ${Math.max(1, Math.ceil(dur / 0.7)) - 1} }, 1.2);` : ""}

  window.__timelines[SID] = tl;
  tl.seek(0);
})();`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080, height=1920"/>
<title>${sid}</title>
<script src="${GSAP}"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000}
${fontFaceCSS()}
.clip{position:absolute;inset:0;overflow:hidden}
#${sid}{position:absolute;inset:0;font-family:'Source Sans 3',sans-serif;background:${th.bg};--pulse:0;--acc:${th.accent}}
#${p}camera{position:absolute;inset:0;will-change:transform}
#${p}world{position:absolute;left:0;top:0}
#${p}grade{position:absolute;inset:0;z-index:5;pointer-events:none;background:
  radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,${(0.34 * scene.lighting.intensity).toFixed(2)}) 100%),
  linear-gradient(180deg, ${hexA(gradeTint, gradeOp)}, ${hexA(gradeTint, gradeOp * 0.4)});}
#${p}wipe{position:absolute;inset:0;z-index:50;background:linear-gradient(180deg,${th.accentDeep},${th.accent});transform:translateY(0)}
#${p}wipe .wipe-edge{position:absolute;left:0;right:0;bottom:0;height:26px;background:${th.ink};opacity:0.9}
#${p}fade{position:absolute;inset:0;z-index:60;background:#000;opacity:0}
${type.css}
</style>
</head>
<body>
<div id="${sid}" data-composition-id="${sid}" data-width="${W}" data-height="${H}">
  <div id="${p}camera">
    <svg id="${p}world" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${world.markup}
${fx}
${charM}
    </svg>
  </div>
  <div id="${p}grade"></div>
  ${type.m}
  <div id="${p}wipe"><div class="wipe-edge"></div></div>
  <div id="${p}fade"></div>
</div>
<script>
${script}
</script>
</body>
</html>`;
  return { sid, html, dur };
}

// ---------------------------------------------------------------- project
function buildProject(reel, n, sceneFilter) {
  const spec = JSON.parse(fs.readFileSync(path.join(root, "v7", "specs", `${reel.id}.json`), "utf8"));

  // frame-quantized contiguous scene windows
  const totalFrames = Math.ceil(spec.durationSec * FPS);
  const boundaries = spec.scenes.map((s) => Math.round(s.startSec * FPS));
  boundaries[0] = 0;
  boundaries.push(totalFrames);
  const scenes = spec.scenes.map((s, i) => ({
    ...s,
    index: i,
    startFrame: boundaries[i],
    durFrame: Math.max(2, boundaries[i + 1] - boundaries[i]),
    startSec: boundaries[i] / FPS,
  }));

  const projName = sceneFilter !== null ? `${reel.id}-s${sceneFilter}` : reel.id;
  const dir = path.join(buildDir, projName);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, "compositions"), { recursive: true });
  fs.mkdirSync(path.join(dir, "assets", "fonts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "assets", "audio"), { recursive: true });
  fs.mkdirSync(path.join(dir, "assets", "characters"), { recursive: true });

  // assets
  for (const f of ["Anton-Regular.ttf", "SourceSans3-400.ttf", "SourceSans3-600.ttf", "SourceSans3-700.ttf"]) {
    fs.copyFileSync(path.join(root, "public", "fonts", f), path.join(dir, "assets", "fonts", f));
  }
  fs.copyFileSync(path.join(root, "public", reel.audio), path.join(dir, "assets", "audio", path.basename(reel.audio)));
  fs.copyFileSync(path.join(root, "v7", "assets", "characters", "theone.svg"), path.join(dir, "assets", "characters", "theone.svg"));

  const selected = sceneFilter !== null ? scenes.filter((s) => s.index === sceneFilter) : scenes;

  let hosts = "";
  let total = 0;
  for (const scene of selected) {
    const { sid, html, dur } = buildSceneFile(scene, spec, scene.index === 0);
    fs.writeFileSync(path.join(dir, "compositions", `${sid}.html`), html);
    const start = (sceneFilter !== null ? 0 : scene.startFrame) / FPS;
    hosts += `  <div id="${sid}" class="clip" data-composition-id="${sid}" data-composition-src="compositions/${sid}.html" data-start="${start.toFixed(4)}" data-duration="${dur.toFixed(4)}" data-width="${W}" data-height="${H}" data-track-kind="graphics" data-track-index="${scene.index}"></div>\n`;
    total += dur;
  }

  const audioDur = Math.min(spec.audioDurationSec, total).toFixed(4);
  const rootHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080, height=1920"/>
<title>${reel.id}</title>
<script src="${GSAP}"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000}
.clip{position:absolute;inset:0;overflow:hidden}
#root{position:absolute;inset:0;background:${spec.theme.bg}}
</style>
</head>
<body>
<div id="root" data-composition-id="root" data-start="0" data-duration="${total.toFixed(4)}" data-width="${W}" data-height="${H}" data-fps="${FPS}">
${hosts}  <audio id="narration" class="clip" src="assets/audio/${path.basename(reel.audio)}" data-start="0" data-duration="${audioDur}" data-volume="1" data-track-index="9"></audio>
</div>
<script>
(function () {
  const tl = gsap.timeline({ paused: true });
  window.__timelines["root"] = tl;
  tl.seek(0);
})();
</script>
</body>
</html>`;
  fs.writeFileSync(path.join(dir, "index.html"), rootHtml);

  fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
    media: { autoProxy: true },
    authoringSkill: "hyperframes",
  }, null, 2));
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: projName, name: projName, createdAt: new Date().toISOString() }, null, 2));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name: projName,
    private: true,
    type: "module",
    scripts: {
      dev: "npx --yes hyperframes@0.9.40 preview",
      check: "npx --yes hyperframes@0.9.40 check",
      render: "npx --yes hyperframes@0.9.40 render",
    },
  }, null, 2));

  console.log(`build ${projName}: ${selected.length} scenes, ${total.toFixed(2)}s, ${Math.round(total * FPS)} frames -> ${path.relative(root, dir)}`);
}

for (const { reel, n } of jobs) {
  if (sceneIdx !== null) {
    const spec = JSON.parse(fs.readFileSync(path.join(root, "v7", "specs", `${reel.id}.json`), "utf8"));
    if (sceneIdx >= spec.scenes.length) continue;
    buildProject(reel, n, sceneIdx);
  } else {
    buildProject(reel, n, null);
  }
}
console.log("build done");
