// v7 worlds — ten fully programmatic animated environments, ported from the
// v6 React worlds to declarative SVG + GSAP (HyperFrames contract).
//
// Each generator runs at BUILD time (Node): it uses the seeded PRNG to lay
// out the world (mountains, skylines, stars…), bakes every number into SVG
// markup, and emits GSAP tween source for the motion. Nothing random or
// time-dependent runs in the browser — renders are identical every time.
//
// Scenes that share a world get different `variant` indices so their layouts
// differ (scene-uniqueness requirement).
import { hashStr, mulberry32 } from "./prng.mjs";

const W = 1080;
const H = 1920;

export function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${(+a).toFixed(3)})`;
}
export function mixHex(a, b, k) {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  const ch = (s, i) => parseInt(s.slice(i * 2, i * 2 + 2), 16);
  const to = (v) => Math.round(v).toString(16).padStart(2, "0");
  const c = [0, 1, 2].map((i) => ch(pa, i) + (ch(pb, i) - ch(pa, i)) * k);
  return `#${to(c[0])}${to(c[1])}${to(c[2])}`;
}
const r2 = (v) => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ iso-grid
function IsoGrid(scene, spec, p, ctx) {
  const th = spec.theme;
  const R = mulberry32(hashStr(scene.id + ":iso" + (scene.variant || 0)));
  const dir = scene.variant % 2 === 0 ? 1 : -1;
  const tile = (i, j) => ({ x: W / 2 + (i - j) * 74 * dir, y: 640 + (i + j) * 37 });
  let tiles = "";
  for (let j = 0; j < 14; j++)
    for (let i = 0; i < 9; i++) {
      const { x, y } = tile(i, j);
      if (y > H + 60 || x < -90 || x > W + 90) continue;
      const key = (i * 7 + j * 13) % 9 === 0;
      tiles += `<polygon points="${r2(x)},${r2(y)} ${r2(x + 74 * dir)},${r2(y + 37)} ${r2(x)},${r2(y + 74)} ${r2(x - 74 * dir)},${r2(y + 37)}" fill="${mixHex(th.panel, th.ink, 0.1)}" stroke="${key ? hexA(th.accent, 0.35) : hexA(th.inkSoft, 0.3)}" stroke-width="${key ? 3 : 2}"/>`;
    }
  const blocks = [0, 1, 2, 3, 4, 5].map((k) => {
    const { x, y } = tile(3 + k, k);
    return { x, y, h: 60 + k * 34, k, trig: k === 0 ? -0.6 : k === 1 ? -0.3 : 0.15 + (k - 2) * 0.32 };
  });
  let blockM = "";
  blocks.forEach((b) => {
    blockM += `<g id="${p}iso-b${b.k}" transform="translate(${r2(b.x)} ${r2(b.y)})">
      <polygon points="0,0 74,37 74,74 0,74" fill="${th.panel}" stroke="${th.accent}" stroke-width="3"/>
      <polygon points="0,0 74,37 74,${r2(37 + b.h)} 0,${r2(b.h)}" fill="${mixHex(th.panel, th.bg, 0.55)}"/>
      <polygon points="0,0 -74,37 -74,${r2(37 + b.h)} 0,${r2(b.h)}" fill="${mixHex(th.panel, th.bg, 0.35)}"/>
      <line x1="-74" y1="37" x2="0" y2="0" stroke="${th.accent}" stroke-width="2" opacity="0.5"/>
    </g>`;
  });
  const sq = Array.from({ length: 8 }, (_, i) => {
    const x = 240 + R() * 640;
    const y0 = 1500 - R() * 1400;
    return { x, y0, s: 8 + R() * 10, sp: 40 + R() * 50 };
  });
  let sqM = "";
  sq.forEach((d, i) => {
    sqM += `<rect id="${p}iso-sq${i}" x="0" y="0" width="${r2(d.s)}" height="${r2(d.s)}" rx="3" fill="${hexA(th.accent, 0.45)}" transform="translate(${r2(d.x)} ${r2(d.y0)}) rotate(${r2(i * 45)})"/>`;
  });
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <rect x="0" y="560" width="${W}" height="240" fill="${hexA(th.accent, 0.07)}" style="opacity:calc(1 + var(--pulse,0)*0.6)"/>
  ${tiles}
  ${blockM}
  <polygon id="${p}iso-d0" points="540,${700 - 120} 780,700 540,760 300,700" fill="none" stroke="${hexA(th.inkSoft, 0.3)}" stroke-width="2" stroke-dasharray="12 16"/>
  <polygon id="${p}iso-d1" points="540,${700 - 170} 880,700 540,800 200,700" fill="none" stroke="${hexA(th.inkSoft, 0.3)}" stroke-width="2" stroke-dasharray="12 16"/>
  ${sqM}`;
  const d = ctx.dur;
  let anim = "";
  blocks.forEach((b) => {
    const t0 = Math.max(0.02, b.trig);
    anim += `tl.set("#${p}iso-b${b.k}",{attr:{transform:"translate(${r2(b.x)} ${r2(b.y)}) scale(1 0.02)"}},0.001);
    tl.fromTo("#${p}iso-b${b.k}",{attr:{transform:"translate(${r2(b.x)} ${r2(b.y)}) scale(1 0.02)"}},{attr:{transform:"translate(${r2(b.x)} ${r2(b.y)}) scale(1 1)"},duration:0.5,ease:"back.out(2)"},${r2(t0)});\n`;
  });
  anim += `tl.fromTo("#${p}iso-d0",{attr:{transform:"rotate(0 540 700)"}},{attr:{transform:"rotate(${r2(2 * d)} 540 700)"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}iso-d1",{attr:{transform:"rotate(0 540 700)"}},{attr:{transform:"rotate(${-r2(4 * d)} 540 700)"},duration:${r2(d)},ease:"none"},0);\n`;
  sq.forEach((s, i) => {
    const dy = s.sp * d;
    anim += `tl.fromTo("#${p}iso-sq${i}",{attr:{transform:"translate(${r2(s.x)} ${r2(s.y0)}) rotate(${r2(i * 45)})"}},{attr:{transform:"translate(${r2(s.x)} ${r2(s.y0 - dy)}) rotate(${r2(i * 45 + 20 * d)})"}},0);
    tl.fromTo("#${p}iso-sq${i}",{opacity:0.25},{opacity:0.8,duration:${r2(d / 2)},ease:"sine.inOut",yoyo:true,repeat:1},0);\n`;
  });
  return { markup, anim, char: { pos: [660, 1130], scale: 1.9, facing: -dir } };
}

// ---------------------------------------------------------------- riso-poster
function RisoPoster(scene, spec, p, ctx) {
  const th = spec.theme;
  const v3 = (scene.variant || 0) % 3;
  const flip = v3 === 1;
  const sunY = v3 === 2 ? 560 : 720;
  const bars = [0.5, 0.75, 1, 0.62, 0.88, 0.4, 0.68];
  let barM = "";
  bars.forEach((hh, i) => {
    const x = flip ? W - 140 - i * 130 - 74 : 140 + i * 130;
    barM += `<g id="${p}riso-bar${i}" transform="translate(${r2(x)} 1600)">
      <rect x="4" y="${r2(-560 * hh)}" width="74" height="${r2(560 * hh)}" fill="${hexA(th.accentDeep, 0.4)}"/>
      <rect x="0" y="${r2(-560 * hh)}" width="74" height="${r2(560 * hh)}" fill="${hexA(th.accent, 0.9 - i * 0.07)}"/>
      <rect x="0" y="${r2(-560 * hh)}" width="74" height="6" fill="${th.ink}" opacity="0.6"/>
    </g>`;
  });
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <defs>
    <pattern id="${p}riso-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" fill="${hexA(th.ink, 0.1)}"/></pattern>
    <pattern id="${p}riso-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="14" stroke="${hexA(th.ink, 0.08)}" stroke-width="5"/></pattern>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${p}riso-dots)"/>
  <g id="${p}riso-sun">
    <circle cx="544" cy="${sunY - 4}" r="230" fill="${hexA(th.accentDeep, 0.5)}"/>
    <circle cx="540" cy="${sunY}" r="230" fill="${hexA(th.accent, 0.55)}"/>
    <circle cx="540" cy="${sunY}" r="230" fill="none" stroke="${th.ink}" stroke-width="3" opacity="0.25"/>
  </g>
  <circle id="${p}riso-a0" cx="540" cy="${sunY}" r="310" fill="none" stroke="${hexA(th.inkSoft, 0.35)}" stroke-width="2" stroke-dasharray="30 22"/>
  <circle id="${p}riso-a1" cx="540" cy="${sunY}" r="380" fill="none" stroke="${hexA(th.inkSoft, 0.35)}" stroke-width="2" stroke-dasharray="48 22"/>
  <circle id="${p}riso-a2" cx="540" cy="${sunY}" r="450" fill="none" stroke="${hexA(th.inkSoft, 0.35)}" stroke-width="2" stroke-dasharray="66 22"/>
  <rect x="0" y="980" width="${W}" height="330" fill="url(#${p}riso-hatch)" opacity="0.8"/>
  ${barM}
  <rect x="0" y="1600" width="${W}" height="320" fill="${th.panel}"/>
  <line x1="0" y1="1600" x2="${W}" y2="1600" stroke="${th.ink}" stroke-width="3" opacity="0.4"/>`;
  const d = ctx.dur;
  let anim = "";
  bars.forEach((hh, i) => {
    const t0 = 0.25 + i * 0.14;
    const x = flip ? W - 140 - i * 130 - 74 : 140 + i * 130;
    anim += `tl.set("#${p}riso-bar${i}",{attr:{transform:"translate(${r2(x)} 1600) scale(1 0.01)"}},0.001);
    tl.fromTo("#${p}riso-bar${i}",{attr:{transform:"translate(${r2(x)} 1600) scale(1 0.01)"}},{attr:{transform:"translate(${r2(x)} 1600) scale(1 1)"},duration:1.1,ease:"back.out(1.4)"},${r2(t0)});\n`;
  });
  anim += `tl.fromTo("#${p}riso-a0",{attr:{transform:"rotate(0 540 ${sunY})"}},{attr:{transform:"rotate(${r2(4 * d)} 540 ${sunY})"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}riso-a1",{attr:{transform:"rotate(0 540 ${sunY})"}},{attr:{transform:"rotate(${-r2(7 * d)} 540 ${sunY})"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}riso-a2",{attr:{transform:"rotate(0 540 ${sunY})"}},{attr:{transform:"rotate(${r2(10 * d)} 540 ${sunY})"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}riso-sun",{attr:{transform:"scale(1)"}},{attr:{transform:"scale(1.04)"},duration:0.9,ease:"sine.inOut",yoyo:true,repeat:${Math.max(1, Math.ceil(d / 0.9)) - 1}},0);\n`;
  return { markup, anim, char: { pos: v3 === 1 ? [260, 1600] : v3 === 2 ? [540, 1600] : [820, 1600], scale: 2.1, facing: v3 === 1 ? 1 : -1 } };
}

// ------------------------------------------------------------------ ink-dawn
function InkDawn(scene, spec, p, ctx) {
  const th = spec.theme;
  const v3 = (scene.variant || 0) % 3;
  const sunX = v3 === 0 ? 740 : v3 === 1 ? 300 : 540;
  const strata = [0.1, 0.28, 0.5, 0.72, 0.95].map((k, i) => {
    const R = mulberry32(hashStr(scene.id + ":mtn" + i + "v" + (scene.variant || 0)));
    const pts = [];
    const n = 8;
    const base = 950 + i * 180;
    const amp = 130 + i * 60;
    for (let x = -120; x <= W + 120; x += (W + 240) / n) pts.push(`${r2(x)},${r2(base - R() * amp)}`);
    return { d: `M -240 ${H + 10} L -240 ${base} ${pts.join(" L ")} L ${W + 240} ${base} L ${W + 240} ${H + 10} Z`, fill: mixHex(th.bg, th.ink, 0.12 + k * 0.8), sp: 2 + i * 3, i };
  });
  const birds = Array.from({ length: 5 }, (_, i) => {
    const R = mulberry32(hashStr(scene.id + ":bird" + i));
    return { y: 380 + R() * 220, x0: -210 + R() * 1400, sp: 26 + i * 8 };
  });
  let birdM = "";
  birds.forEach((b, i) => {
    birdM += `<g id="${p}ink-bird${i}"><path d="M -14 -6 Q 0 8 14 -6" stroke="${th.ink}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
  });
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <g id="${p}ink-sun">
    <circle cx="${sunX}" cy="1290" r="110" fill="${hexA(th.accent, 0.95)}"/>
    <circle cx="${sunX}" cy="1290" r="126" fill="none" stroke="${hexA(th.accent, 0.5)}" stroke-width="2"/>
    <circle cx="${sunX}" cy="1290" r="190" fill="none" stroke="${hexA(th.accent, 0.28)}" stroke-width="2" stroke-dasharray="10 14"/>
    <circle cx="${sunX}" cy="1290" r="260" fill="none" stroke="${hexA(th.accent, 0.28)}" stroke-width="2" stroke-dasharray="10 14"/>
  </g>
  ${strata.map((s) => `<g id="${p}ink-m${s.i}"><path d="${s.d}" fill="${s.fill}"/></g>`).join("\n  ")}
  ${[0, 1, 2].map((i) => `<rect id="${p}ink-mist${i}" x="${-140 + i * 220}" y="${1060 + i * 120}" width="1400" height="54" rx="27" fill="${hexA(th.panel, 0.5)}"/>`).join("\n  ")}
  ${birdM}`;
  const d = ctx.dur;
  let anim = `tl.fromTo("#${p}ink-sun",{attr:{transform:"translate(0 650)"}},{attr:{transform:"translate(0 0)"},duration:${r2(d)},ease:"power2.inOut"},0);\n`;
  strata.forEach((s) => {
    const dx = -(s.sp * d * 8);
    anim += `tl.fromTo("#${p}ink-m${s.i}",{attr:{transform:"translate(${r2(-120 * 0.2)} 0)"}},{attr:{transform:"translate(${r2(-120 * 0.2 + dx)} 0)"},duration:${r2(d)},ease:"none"},0);\n`;
  });
  [0, 1, 2].forEach((i) => {
    anim += `tl.fromTo("#${p}ink-mist${i}",{attr:{transform:"translate(0 0)"}},{attr:{transform:"translate(${r2(380)} 0)"},duration:${r2(d)},ease:"none"},0);\n`;
  });
  birds.forEach((b, i) => {
    const xEnd = b.x0 + (b.sp + 40) * d;
    anim += `tl.fromTo("#${p}ink-bird${i}",{attr:{transform:"translate(${r2(b.x0)} ${r2(b.y)}) scale(1 1)"}},{attr:{transform:"translate(${r2(xEnd)} ${r2(b.y - 40)}) scale(1 1)"},duration:${r2(d)},ease:"none"},0);
    tl.fromTo("#${p}ink-bird${i}",{attr:{transform:"translate(${r2(b.x0)} ${r2(b.y)}) scale(1 0.2)"}},{attr:{transform:"translate(${r2(b.x0)} ${r2(b.y)}) scale(1 1)"},duration:0.22,ease:"sine.inOut",yoyo:true,repeat:${Math.max(1, Math.ceil(d / 0.22)) - 1}},0);\n`;
  });
  return { markup, anim, char: { pos: v3 === 0 ? [380, 1785] : v3 === 1 ? [700, 1780] : [540, 1790], scale: 2.0, facing: 1 } };
}

// ----------------------------------------------------------------- neon-city
function NeonCity(scene, spec, p, ctx) {
  const th = spec.theme;
  const R = mulberry32(hashStr(scene.id + ":city" + (scene.variant || 0)));
  const v3 = (scene.variant || 0) % 3;
  const flip = v3 === 1;
  const far = Array.from({ length: 12 }, (_, i) => ({ w: 70 + R() * 110, h: 140 + R() * 320, x: -40 + i * 95 + R() * 30 }));
  const blds = Array.from({ length: 9 }, (_, i) => {
    const w = 90 + R() * 130;
    const h = 260 + R() * 620;
    const x = -60 + i * 130 + R() * 40;
    const win = [];
    const cols = Math.max(2, Math.floor(w / 34));
    const rows = Math.max(3, Math.floor(h / 52));
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) if (R() < 0.45) win.push({ x: 12 + c * 34, y: 18 + r * 52, warm: R() < 0.6 });
    return { x, w, h, win };
  });
  let farM = "", bldM = "", reflM = "";
  far.forEach((b) => { farM += `<rect x="${r2(b.x)}" y="${r2(1430 - b.h)}" width="${r2(b.w)}" height="${r2(b.h)}" fill="${hexA(th.panel, 0.9)}"/>`; });
  blds.forEach((b, i) => {
    bldM += `<g id="${p}neo-b${i}">
      <rect x="${r2(b.x)}" y="${r2(1430 - b.h)}" width="${r2(b.w)}" height="${r2(b.h)}" fill="#0E0F16"/>
      <rect x="${r2(b.x)}" y="${r2(1430 - b.h)}" width="${r2(b.w)}" height="4" fill="${hexA(th.ink, 0.1)}"/>
      ${b.win.map((w) => `<rect x="${r2(b.x + w.x)}" y="${r2(1430 - b.h + w.y)}" width="14" height="20" fill="${w.warm ? hexA("#E8B84B", 0.75) : hexA(th.accent, 0.6)}"/>`).join("")}
    </g>`;
  });
  blds.slice(0, 6).forEach((b) => { reflM += `<rect x="${r2(b.x)}" y="0" width="${r2(b.w)}" height="${r2(b.h)}" fill="${th.panel}"/>`; });
  const drops = Array.from({ length: 46 }, (_, i) => {
    const r = mulberry32(hashStr(scene.id + ":drop" + i));
    return { x: r() * W, y0: r() * H, len: 26 + r() * 34, sp: 700 + r() * 300 };
  });
  let rainM = "";
  drops.forEach((dr, i) => {
    rainM += `<line id="${p}neo-r${i}" x1="${r2(dr.x)}" y1="0" x2="${r2(dr.x - 7)}" y2="${r2(dr.len)}" stroke="${hexA(th.ink, 0.3)}" stroke-width="2"/>`;
  });
  const signX = v3 === 0 ? 96 : v3 === 1 ? 830 : 380;
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <defs>
    <filter id="${p}neo-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="${p}neo-ng" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hexA(th.accent, 0.16)}"/><stop offset="1" stop-color="${hexA(th.accent, 0)}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="540" fill="url(#${p}neo-ng)" style="opacity:calc(1 + var(--pulse,0)*0.6)"/>
  <g id="${p}neo-far" opacity="0.55">${farM}</g>
  ${bldM}
  <g transform="translate(0 1430) scale(1 -0.28)" opacity="0.22">${reflM}</g>
  <rect x="0" y="1430" width="${W}" height="490" fill="#0B0C12"/>
  <rect x="140" y="1408" width="800" height="16" rx="8" fill="#14151D"/>
  <line x1="140" y1="1416" x2="940" y2="1416" stroke="${hexA(th.accent, 0.7)}" stroke-width="3"/>
  <g stroke="${hexA(th.ink, 0.4)}" stroke-width="6">
    <line x1="${signX + 13}" y1="${signX === 96 ? 880 : 960}" x2="${signX + 13}" y2="1408"/>
    <line x1="${flip ? 109 : 843}" y1="${flip ? 880 : 960}" x2="${flip ? 109 : 843}" y2="1408"/>
  </g>
  <g id="${p}neo-sign" filter="url(#${p}neo-glow)">
    <rect x="${signX}" y="560" width="26" height="300" rx="12" fill="none" stroke="${th.accent}" stroke-width="6"/>
    <rect x="${flip ? 830 : 96}" y="700" width="26" height="240" rx="12" fill="none" stroke="${th.accent}" stroke-width="6"/>
    ${[640, 700, 760].map((y) => `<rect x="${signX - 26}" y="${y}" width="80" height="7" rx="3" fill="${th.accent}" opacity="0.8"/>`).join("")}
  </g>
  ${rainM}
  <rect id="${p}fx-flash" x="0" y="0" width="${W}" height="${H}" fill="${hexA(th.accent, 1)}" opacity="0"/>`;
  const d = ctx.dur;
  let anim = `tl.fromTo("#${p}neo-far",{attr:{transform:"translate(-18 0)"}},{attr:{transform:"translate(18 0)"},duration:${r2(d / 2)},ease:"sine.inOut",yoyo:true,repeat:1},0);\n`;
  drops.forEach((dr, i) => {
    const dy = dr.sp * d;
    anim += `tl.fromTo("#${p}neo-r${i}",{attr:{transform:"translate(0 ${r2(dr.y0 - H)})"}},{attr:{transform:"translate(0 ${r2(dr.y0 - H + dy)})"}},0);\n`;
  });
  const flicks = [0.5, 1.3, 2.1, 2.9, 3.7];
  flicks.forEach((t) => {
    if (t < d) {
      anim += `tl.fromTo("#${p}neo-sign",{opacity:1},{opacity:0.55,duration:0.05,yoyo:true,repeat:3,ease:"none"},${r2(t)});\n`;
    }
  });
  return { markup, anim, char: { pos: v3 === 0 ? [540, 1408] : v3 === 1 ? [440, 1408] : [640, 1408], scale: 2.4, facing: 1 }, flashOn: true };
}

// --------------------------------------------------------------- paper-forest
function PaperForest(scene, spec, p, ctx) {
  const th = spec.theme;
  const v3 = (scene.variant || 0) % 3;
  const flip = v3 === 1;
  const rows = [
    { y: 1180, scale: 0.7, col: mixHex(th.bg, "#0A2214", 0.5), sp: 6 },
    { y: 1380, scale: 1.0, col: mixHex(th.bg, "#123324", 0.7), sp: 12 },
    { y: 1600, scale: 1.35, col: mixHex(th.bg, "#1A4730", 0.85), sp: 20 },
  ];
  let treeM = "";
  rows.forEach((row, ri) => {
    Array.from({ length: 7 }, (_, i) => {
      const R = mulberry32(hashStr(scene.id + ":tree" + ri + "-" + i + "v" + (scene.variant || 0)));
      const x = i * 190 + R() * 120;
      const hgt = (150 + R() * 90) * row.scale;
      treeM += `<g id="${p}for-t${ri}-${i}" transform="translate(${r2(-210 + x)} ${row.y})">
        <rect x="${r2(-10 * row.scale)}" y="${r2(-hgt * 0.4)}" width="${r2(22 * row.scale)}" height="${r2(hgt * 0.42)}" rx="8" fill="${mixHex(row.col, "#000000", 0.3)}"/>
        <circle cx="0" cy="${r2(-hgt * 0.55)}" r="${r2(hgt * 0.34)}" fill="${row.col}"/>
        <circle cx="${r2(-hgt * 0.2)}" cy="${r2(-hgt * 0.4)}" r="${r2(hgt * 0.24)}" fill="${mixHex(row.col, "#FFFFFF", 0.05)}"/>
        <circle cx="${r2(hgt * 0.2)}" cy="${r2(-hgt * 0.42)}" r="${r2(hgt * 0.22)}" fill="${mixHex(row.col, "#000000", 0.12)}"/>
      </g>`;
    });
  });
  const fireflies = Array.from({ length: 16 }, (_, i) => {
    const R = mulberry32(hashStr(scene.id + ":ff" + i));
    return { x: 60 + R() * 960, y: 700 + R() * 900, ph: R() * 10 };
  });
  const chain = scene.motif === "chain";
  let chainM = "";
  if (chain)
    Array.from({ length: 7 }, (_, i) => {
      const y = 1560 - i * 64;
      const x = (flip ? W - 300 - i * 84 : 300 + i * 84) + Math.sin(i) * 18;
      chainM += `<g id="${p}for-c${i}" opacity="0"><ellipse cx="${r2(x)}" cy="${r2(y)}" rx="34" ry="20" fill="none" stroke="${th.accent}" stroke-width="9" transform="rotate(${i % 2 ? 18 : -14} ${r2(x)} ${r2(y)})"/></g>`;
    });
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  ${[220, 520, 800].map((x, i) => `<polygon points="${x},-40 ${x + 130},-40 ${x + 320},${H} ${x + 60},${H}" fill="${hexA("#E9FFD8", 0.05 + i * 0.012)}"/>`).join("\n  ")}
  ${treeM}
  ${[1040, 1240, 1460, 1680].map((y, i) => `<rect id="${p}for-fog${i}" x="${-160 + i * 240}" y="${y}" width="1500" height="70" rx="35" fill="${hexA("#CFE8D8", 0.07 + i * 0.02)}"/>`).join("\n  ")}
  ${chainM}
  <g id="${p}for-ff" style="opacity:calc(0.5 + var(--pulse,0)*0.5)">${fireflies.map((f) => `<circle cx="${r2(f.x)}" cy="${r2(f.y)}" r="5" fill="${hexA(th.accent, 0.75)}"/>`).join("")}</g>`;
  const d = ctx.dur;
  let anim = "";
  rows.forEach((row, ri) => {
    for (let i = 0; i < 7; i++) {
      const dx = row.sp * d * (flip ? -1 : 1);
      anim += `tl.fromTo("#${p}for-t${ri}-${i}",{attr:{transform:"translate(${r2(-210 + i * 190)} ${row.y})"}},{attr:{transform:"translate(${r2(-210 + i * 190 + dx)} ${row.y})"}},0);\n`;
    }
  });
  [0, 1, 2, 3].forEach((i) => {
    anim += `tl.fromTo("#${p}for-fog${i}",{attr:{transform:"translate(0 0)"}},{attr:{transform:"translate(${r2(420)} 0)"},duration:${r2(d)},ease:"none"},0);\n`;
  });
  if (chain)
    Array.from({ length: 7 }, (_, i) => {
      const t0 = 0.3 + i * 0.22;
      anim += `tl.fromTo("#${p}for-c${i}",{opacity:0,scale:0.3},{opacity:1,scale:1,duration:0.5,ease:"back.out(2.5)",transformOrigin:"50% 50%"},${r2(t0)});\n`;
    });
  return { markup, anim, char: { pos: v3 === 0 ? [620, 1760] : v3 === 1 ? [460, 1760] : [540, 1740], scale: 2.0, facing: v3 === 1 ? -1 : 1 } };
}

// --------------------------------------------------------------- cosmic-orbit
function CosmicOrbit(scene, spec, p, ctx) {
  const th = spec.theme;
  const R = mulberry32(hashStr(scene.id + ":cosmos" + (scene.variant || 0)));
  const v3 = (scene.variant || 0) % 3;
  const planetX = v3 === 0 ? 540 : v3 === 1 ? 300 : 780;
  const planetY = 1560;
  const ringRot = v3 === 2 ? 14 : -14;
  const stars = Array.from({ length: 150 }, () => ({ x: R() * W, y: R() * H * 0.9, r: 0.6 + R() * 1.8 }));
  const starGroups = [0, 1, 2].map((g) =>
    stars.filter((_, i) => i % 3 === g).map((s) => `<circle cx="${r2(s.x)}" cy="${r2(s.y)}" r="${r2(s.r)}" fill="${hexA(th.ink, 0.55)}"/>`).join("")
  );
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <defs><radialGradient id="${p}cos-pl">
    <stop offset="0" stop-color="${hexA(th.accent, 0.9)}"/><stop offset="0.7" stop-color="${hexA(th.accentDeep, 0.8)}"/><stop offset="1" stop-color="${hexA(th.accentDeep, 0.1)}"/>
  </radialGradient></defs>
  <g id="${p}cos-sg0">${starGroups[0]}</g>
  <g id="${p}cos-sg1">${starGroups[1]}</g>
  <g id="${p}cos-sg2">${starGroups[2]}</g>
  <ellipse cx="260" cy="420" rx="300" ry="170" fill="${hexA(th.accentDeep, 0.1)}"/>
  <ellipse cx="820" cy="640" rx="260" ry="140" fill="${hexA(th.accent, 0.08)}"/>
  <ellipse id="${p}cos-or0" cx="${planetX}" cy="${planetY - 40}" rx="430" ry="90" fill="none" stroke="${hexA(th.inkSoft, 0.4)}" stroke-width="2" stroke-dasharray="14 18"/>
  <ellipse id="${p}cos-or1" cx="${planetX}" cy="${planetY - 40}" rx="310" ry="68" fill="none" stroke="${hexA(th.inkSoft, 0.4)}" stroke-width="2" stroke-dasharray="14 18"/>
  <circle cx="${planetX}" cy="${planetY}" r="230" fill="url(#${p}cos-pl)"/>
  <ellipse cx="${planetX}" cy="${planetY}" rx="380" ry="74" fill="none" stroke="${hexA(th.accent, 0.55)}" stroke-width="10" transform="rotate(${ringRot} ${planetX} ${planetY})"/>
  <line id="${p}cos-shoot" x1="180" y1="240" x2="230" y2="200" stroke="${th.ink}" stroke-width="4" stroke-linecap="round" opacity="0"/>`;
  const d = ctx.dur;
  let anim = `tl.fromTo("#${p}cos-or0",{attr:{transform:"rotate(0 ${planetX} ${planetY - 40})"}},{attr:{transform:"rotate(${r2(6 * d)} ${planetX} ${planetY - 40})"}},0);
  tl.fromTo("#${p}cos-or1",{attr:{transform:"rotate(0 ${planetX} ${planetY - 40})"}},{attr:{transform:"rotate(${-r2(10 * d)} ${planetX} ${planetY - 40})"}},0);\n`;
  starGroups.forEach((_, g) => {
    const cyc = [2.2, 3.1, 2.7][g];
    anim += `tl.fromTo("#${p}cos-sg${g}",{opacity:0.35},{opacity:1,duration:${r2(cyc / 2)},ease:"sine.inOut",yoyo:true,repeat:${Math.max(1, Math.ceil(d / (cyc / 2))) - 1}},0);\n`;
  });
  ctx.onsets.forEach((t0) => {
    if (t0 <= 0.05 || t0 >= d - 0.6) return;
    anim += `tl.fromTo("#${p}cos-shoot",{opacity:0},{opacity:1,duration:0.06},${r2(t0)});\n`;
    anim += `tl.fromTo("#${p}cos-shoot",{attr:{transform:"translate(0 0)"}},{attr:{transform:"translate(440 320)"},duration:0.5,ease:"power2.in"},${r2(t0)});\n`;
    anim += `tl.fromTo("#${p}cos-shoot",{opacity:1},{opacity:0,duration:0.5,ease:"power2.out"},${r2(t0)});\n`;
  });
  return { markup, anim, char: { pos: v3 === 0 ? [540, 820] : v3 === 1 ? [780, 820] : [300, 820], scale: 2.0, facing: v3 === 1 ? -1 : 1 } };
}

// -------------------------------------------------------------- blueprint-tech
function BlueprintTech(scene, spec, p, ctx) {
  const th = spec.theme;
  const v3 = (scene.variant || 0) % 3;
  const flip = v3 === 1;
  const gx = v3 === 0 ? 0 : v3 === 1 ? -90 : 90; // gear cluster x-shift
  let grid = "";
  for (let x = 0; x <= W; x += 60) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${hexA(th.inkSoft, x % 180 === 0 ? 0.22 : 0.1)}" stroke-width="1.5"/>`;
  for (let y = 0; y <= H; y += 60) grid += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${hexA(th.inkSoft, y % 180 === 0 ? 0.22 : 0.1)}" stroke-width="1.5"/>`;
  const gear = (cx, cy, r, teeth) => {
    let teethM = "";
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      teethM += `<line x1="${r2(cx + Math.cos(a) * r)}" y1="${r2(cy + Math.sin(a) * r)}" x2="${r2(cx + Math.cos(a) * (r + 18))}" y2="${r2(cy + Math.sin(a) * (r + 18))}" stroke="${th.ink}" stroke-width="6"/>`;
    }
    return `<g id="${p}bp-g${cx}-${cy}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${th.ink}" stroke-width="3"/>${teethM}<circle cx="${cx}" cy="${cy}" r="${r2(r * 0.32)}" fill="none" stroke="${th.accent}" stroke-width="4"/><circle cx="${cx}" cy="${cy}" r="${r2(r * 0.06)}" fill="${th.accent}"/></g>`;
  };
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  ${grid}
  <circle id="${p}bp-p0" cx="540" cy="880" r="320" fill="none" stroke="${hexA(th.inkSoft, 0.5)}" stroke-width="2" stroke-dasharray="8 12"/>
  <circle id="${p}bp-p1" cx="540" cy="880" r="460" fill="none" stroke="${hexA(th.inkSoft, 0.5)}" stroke-width="2" stroke-dasharray="8 12"/>
  ${gear(540 + gx, 880, 150, 12)}
  ${gear(320 + gx, 1240, 90, 10)}
  ${gear(780 + gx, 1260, 110, 12)}
  ${[0, 1, 2, 3, 4].map((i) => `<rect id="${p}bp-st${i}" x="420" y="${1560 + i * 26}" width="240" height="22" rx="6" fill="${hexA(th.panel, 0.95)}" stroke="${hexA(th.ink, 0.5)}" stroke-width="2"/>`).join("\n  ")}
  <g stroke="${hexA(th.accent, 0.6)}" stroke-width="2.5" fill="none">
    <path d="M 700 880 L 940 880 L 970 850"/><path d="M 860 1260 L 990 1260 L 1020 1230"/>
    <circle cx="970" cy="850" r="4" fill="${th.accent}" stroke="none"/><circle cx="1020" cy="1230" r="4" fill="${th.accent}" stroke="none"/>
  </g>`;
  const d = ctx.dur;
  let anim = `tl.fromTo("#${p}bp-g${540 + gx}-880",{attr:{transform:"rotate(0 ${540 + gx} 880)"}},{attr:{transform:"rotate(${r2(360 * 1.8 * d / 12)} ${540 + gx} 880)"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}bp-g${320 + gx}-1240",{attr:{transform:"rotate(0 ${320 + gx} 1240)"}},{attr:{transform:"rotate(${-r2(360 * 1.8 * d / 10)} ${320 + gx} 1240)"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}bp-g${780 + gx}-1260",{attr:{transform:"rotate(0 ${780 + gx} 1260)"}},{attr:{transform:"rotate(${-r2(360 * 1.8 * d / 12)} ${780 + gx} 1260)"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}bp-p0",{attr:{transform:"rotate(0 540 880)"}},{attr:{transform:"rotate(${r2(2 * d)} 540 880)"},duration:${r2(d)},ease:"none"},0);
  tl.fromTo("#${p}bp-p1",{attr:{transform:"rotate(0 540 880)"}},{attr:{transform:"rotate(${-r2(3 * d)} 540 880)"},duration:${r2(d)},ease:"none"},0);\n`;
  const sgn = flip ? -1 : 1;
  [0, 1, 2, 3, 4].forEach((i) => {
    const t0 = 0.15 * i;
    const dx = (i - 2) * 150 * sgn;
    anim += `tl.fromTo("#${p}bp-st${i}",{attr:{transform:"translate(0 0)"}},{attr:{transform:"translate(${r2(dx)} ${-180})"},duration:0.5,ease:"back.out(1.6)"},${r2(t0)});\n`;
  });
  return { markup, anim, char: { pos: v3 === 0 ? [540, 1640] : v3 === 1 ? [640, 1640] : [440, 1640], scale: 1.9, facing: 1 } };
}

// -------------------------------------------------------------- halftone-comic
function HalftoneComic(scene, spec, p, ctx) {
  const th = spec.theme;
  const v3 = (scene.variant || 0) % 3;
  const rot = v3 === 0 ? -2 : v3 === 1 ? 2 : 0;
  const motifX = v3 === 2 ? 380 : 540;
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <defs><pattern id="${p}hal-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="4.2" fill="${hexA(th.ink, 0.16)}"/></pattern></defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${p}hal-dots)"/>
  <g id="${p}hal-burst" opacity="0">${Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `<line x1="${r2(540 + Math.cos(a) * 500)}" y1="${r2(760 + Math.sin(a) * 500)}" x2="${r2(540 + Math.cos(a) * 840)}" y2="${r2(760 + Math.sin(a) * 840)}" stroke="${hexA(th.ink, 0.5)}" stroke-width="10" stroke-linecap="round"/>`;
  }).join("")}</g>
  <g id="${p}hal-panel" transform="rotate(${rot} 540 1150)">
    <rect x="150" y="880" width="780" height="520" rx="26" fill="${th.panel}" stroke="${th.ink}" stroke-width="10"/>
    <rect x="178" y="908" width="724" height="464" rx="14" fill="url(#${p}hal-dots)"/>
    <g id="${p}hal-motif" transform="translate(${motifX} 1140)">
      ${scene.motif === "bolt"
        ? `<path d="M -30 -160 L 60 -160 L 20 -40 L 90 -40 L -50 160 L -10 10 L -70 10 Z" fill="${hexA(th.accent, 0.6)}" transform="translate(5 5)"/><path d="M -30 -160 L 60 -160 L 20 -40 L 90 -40 L -50 160 L -10 10 L -70 10 Z" fill="${th.accent}"/>`
        : `<circle r="110" fill="${hexA(th.accent, 0.9)}" transform="translate(6 6)"/><circle r="110" fill="${th.accent}"/><path d="M 0 -60 L 18 -18 L 60 0 L 18 18 L 0 60 L -18 18 L -60 0 L -18 -18 Z" fill="${th.ink}"/>`}
    </g>
  </g>
  ${[0, 1].map((k) => Array.from({ length: 6 }, (_, i) => `<line x1="${k ? W - 40 : 40}" y1="${200 + i * 60}" x2="${k ? W - 200 : 200}" y2="${180 + i * 60}" stroke="${hexA(th.ink, 0.3)}" stroke-width="6" stroke-linecap="round"/>`).join("")).join("\n  ")}`;
  const d = ctx.dur;
  let anim = `tl.fromTo("#${p}hal-panel",{attr:{transform:"rotate(${r2(rot * 2)} 540 1150) scale(0.92)"}},{attr:{transform:"rotate(${rot} 540 1150) scale(1)"},duration:0.6,ease:"back.out(1.7)"},0.02);
  tl.fromTo("#${p}hal-motif",{attr:{transform:"translate(${motifX} 1140) scale(0.5)"}},{attr:{transform:"translate(${motifX} 1140) scale(1)"},duration:0.5,ease:"back.out(2.4)"},0.15);\n`;
  ctx.onsets.forEach((t0) => {
    if (t0 <= 0.05 || t0 >= d - 0.5) return;
    anim += `tl.fromTo("#${p}hal-burst",{opacity:0.9},{opacity:0,duration:0.45,ease:"power2.out"},${r2(t0)});\n`;
    anim += `tl.fromTo("#${p}hal-burst",{attr:{transform:"rotate(0 540 760) scale(1.25)"}},{attr:{transform:"rotate(${r2(24)} 540 760) scale(0.85)"},duration:0.45,ease:"power2.out"},${r2(t0)});\n`;
    anim += `tl.fromTo("#${p}hal-motif",{attr:{transform:"translate(${motifX} 1140) scale(1.12)"}},{attr:{transform:"translate(${motifX} 1140) scale(1)"},duration:0.3,ease:"back.out(3)"},${r2(t0)});\n`;
  });
  return { markup, anim, char: { pos: v3 === 0 ? [540, 1790] : v3 === 1 ? [540, 1770] : [700, 1790], scale: 2.0, facing: v3 === 2 ? -1 : 1 } };
}

// ----------------------------------------------------------------- liquid-grad
function LiquidGrad(scene, spec, p, ctx) {
  const th = spec.theme;
  const v3 = (scene.variant || 0) % 3;
  const bx = v3 === 0 ? 0 : v3 === 1 ? 180 : -180;
  const blobs = [
    { cx: 340 + bx, cy: 520, r: 360, col: th.accent, f: 0.11, ph: 0 },
    { cx: 760 - bx, cy: 880, r: 420, col: th.accentDeep, f: 0.09, ph: 2.1 },
    { cx: 420 + bx, cy: 1360, r: 380, col: th.panel, f: 0.13, ph: 4.2 },
    { cx: 880 - bx, cy: 1600, r: 300, col: th.accent, f: 0.12, ph: 1.2 },
  ];
  let blobM = "", defs = "";
  blobs.forEach((b, i) => {
    defs += `<radialGradient id="${p}lg-${i}"><stop offset="0" stop-color="${hexA(b.col, 0.5)}"/><stop offset="0.6" stop-color="${hexA(b.col, 0.22)}"/><stop offset="1" stop-color="${hexA(b.col, 0)}"/></radialGradient>`;
    blobM += `<circle id="${p}liq-b${i}" cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="url(#${p}lg-${i})" style="opacity:calc(1 + var(--pulse,0)*0.25)"/>`;
  });
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <defs>${defs}<pattern id="${p}lgd" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.2" fill="${hexA(th.ink, 0.08)}"/></pattern></defs>
  ${blobM}
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${p}lgd)"/>
  <line x1="120" y1="1660" x2="960" y2="1660" stroke="${hexA(th.ink, 0.25)}" stroke-width="3"/>
  ${[300, 540, 780].map((x) => `<circle cx="${x}" cy="1660" r="6" fill="${hexA(th.ink, 0.4)}"/>`).join("")}`;
  const d = ctx.dur;
  let anim = "";
  blobs.forEach((b, i) => {
    const dx = Math.sin(b.f * d * Math.PI * 2 + b.ph) * 46;
    const dy = Math.cos(b.f * 1.3 * d * Math.PI * 2 + b.ph) * 38;
    anim += `tl.fromTo("#${p}liq-b${i}",{attr:{transform:"translate(0 0) scale(1)"}},{attr:{transform:"translate(${r2(dx)} ${r2(dy)}) scale(${r2(1 + 0.06 * Math.sin(b.f * 2 * d * Math.PI * 2 + b.ph))})"}},0);\n`;
  });
  return { markup, anim, char: { pos: v3 === 0 ? [540, 1650] : v3 === 1 ? [660, 1650] : [420, 1650], scale: 1.9, facing: 1 } };
}

// ------------------------------------------------------------------- cel-stage
function CelStage(scene, spec, p, ctx) {
  const th = spec.theme;
  const v3 = (scene.variant || 0) % 3;
  const coneX = v3 === 0 ? 0 : v3 === 1 ? -140 : 140;
  const motes = Array.from({ length: 22 }, (_, i) => {
    const R = mulberry32(hashStr(scene.id + ":mote" + i));
    return { x: 540 + (R() - 0.5) * 640, y0: 1500 - R() * 1500, sp: 10 + R() * 18 };
  });
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.panel}" opacity="0.35"/>
  <defs><linearGradient id="${p}cel-cone" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${hexA(th.accent, 0.5)}"/><stop offset="1" stop-color="${hexA(th.accent, 0.02)}"/>
  </linearGradient></defs>
  ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${120 + i * 110}" x2="${W}" y2="${120 + i * 110}" stroke="${hexA(th.inkSoft, 0.06)}" stroke-width="2"/>`).join("\n  ")}
  <polygon points="${440 + coneX},0 ${640 + coneX},0 ${940 + coneX},1560 ${140 + coneX},1560" fill="url(#${p}cel-cone)" opacity="0.55" style="opacity:calc(0.55 + var(--pulse,0)*0.2)"/>
  <ellipse cx="${540 + coneX * 0.4}" cy="1560" rx="400" ry="74" fill="${hexA(th.accent, 0.3)}" style="opacity:calc(0.8 + var(--pulse,0)*0.4)"/>
  <ellipse cx="${540 + coneX * 0.4}" cy="1560" rx="240" ry="44" fill="${hexA(th.accent, 0.35)}"/>
  ${Array.from({ length: 7 }, (_, i) => `<line x1="${540 + (i - 3) * 90}" y1="1560" x2="${540 + (i - 3) * 320}" y2="${H}" stroke="${hexA(th.ink, 0.1)}" stroke-width="2"/>`).join("\n  ")}
  ${motes.map((m, i) => `<circle id="${p}cel-m${i}" cx="${r2(m.x)}" cy="${r2(m.y0)}" r="3.5" fill="${hexA(th.ink, 0.3)}"/>`).join("")}
  ${[0, 1, 2].map((i) => `<circle id="${p}cel-puff${i}" cx="${540 + (i - 1) * 130}" cy="1548" r="20" fill="${hexA(th.ink, 0.2)}" opacity="0"/>`).join("")}`;
  const d = ctx.dur;
  let anim = "";
  motes.forEach((m, i) => {
    const dy = -m.sp * d;
    anim += `tl.fromTo("#${p}cel-m${i}",{attr:{transform:"translate(0 0)"},opacity:0.2},{attr:{transform:"translate(0 ${r2(dy)})"},opacity:0.7,duration:${r2(d)},ease:"none"},0);\n`;
  });
  ctx.onsets.forEach((t0) => {
    if (t0 <= 0.05 || t0 >= d - 0.6) return;
    [0, 1, 2].forEach((i) => {
      anim += `tl.fromTo("#${p}cel-puff${i}",{attr:{r:20},opacity:0.22},{attr:{r:110},opacity:0,duration:0.55,ease:"power2.out"},${r2(t0)});\n`;
    });
  });
  return { markup, anim, char: { pos: [540 + Math.round(coneX * 0.4), 1552], scale: 2.4, facing: 1 } };
}

// ---------------------------------------------------------------- cta (book)
function CtaStage(scene, spec, p, ctx) {
  const th = spec.theme;
  const R = mulberry32(hashStr(scene.id + ":cta"));
  const confetti = Array.from({ length: 44 }, (_, i) => {
    const x = R() * W;
    const speed = 130 + R() * 200;
    const y0 = R() * 2200 - 200;
    const cols = [th.accent, th.accentDeep, th.ink, th.inkSoft];
    return { x, y0, speed, col: cols[i % 4], w: 12 + R() * 14, h: 18 + R() * 16, rot0: R() * 360 };
  });
  const markup = `
  <rect x="0" y="0" width="${W}" height="${H}" fill="${th.bg}"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#${p}cta-bg)" style="opacity:calc(1 + var(--pulse,0)*0.4)"/>
  <defs><radialGradient id="${p}cta-bg">
    <stop offset="0" stop-color="${hexA(th.accent, 0.22)}"/><stop offset="0.38" stop-color="${hexA(th.accent, 0.05)}"/><stop offset="0.68" stop-color="${hexA(th.bg, 0)}"/>
  </radialGradient></defs>
  ${confetti.map((c, i) => `<rect id="${p}cta-cf${i}" x="0" y="0" width="${r2(c.w)}" height="${r2(c.h)}" fill="${c.col}" opacity="0.7"/>`).join("")}
  <g id="${p}cta-book">
    <rect x="-14" y="-150" width="28" height="300" rx="6" fill="${mixHex(th.panel, "#000", 0.3)}" stroke="${hexA(th.ink, 0.6)}" stroke-width="3"/>
    <rect x="10" y="-150" width="220" height="300" rx="10" fill="${th.panel}" stroke="${hexA(th.ink, 0.8)}" stroke-width="4"/>
    <rect x="34" y="-126" width="172" height="252" rx="6" fill="${hexA(th.bg, 0.5)}"/>
    <rect x="10" y="-150" width="220" height="300" rx="10" fill="none" stroke="${th.accent}" stroke-width="2.5" opacity="0.6"/>
    <text x="120" y="-40" text-anchor="middle" font-family="Anton" font-size="34" fill="${th.ink}">THE 1%</text>
    <text x="120" y="0" text-anchor="middle" font-family="Anton" font-size="46" fill="${th.accent}">METHOD</text>
    <line x1="50" y1="26" x2="190" y2="26" stroke="${hexA(th.inkSoft, 0.6)}" stroke-width="2"/>
    <text x="120" y="58" text-anchor="middle" font-family="Source Sans 3" font-weight="600" font-size="17" fill="${th.inkSoft}">COMPOUND GROWTH</text>
    ${[0, 1, 2].map((i) => `<path d="M 230 ${-100 + i * 30} q 16 ${i % 2 ? -8 : 8} 30 0" stroke="${hexA(th.ink, 0.4)}" stroke-width="3" fill="none"/>`).join("")}
  </g>`;
  const d = ctx.dur;
  let anim = `tl.fromTo("#${p}cta-book",{attr:{transform:"translate(540 700) rotate(-6) scale(0.4)"},opacity:0},{attr:{transform:"translate(540 700) rotate(3) scale(1)"},opacity:1,duration:0.7,ease:"back.out(1.6)"},0.05);
  tl.fromTo("#${p}cta-book",{attr:{transform:"translate(540 700) rotate(3) scale(1)"}},{attr:{transform:"translate(540 ${700 - 16}) rotate(3) scale(1.02)"},duration:1.1,ease:"sine.inOut",yoyo:true,repeat:${Math.max(1, Math.ceil(d / 1.1)) - 1}},0.75);\n`;
  confetti.forEach((c, i) => {
    const dy = c.speed * d;
    anim += `tl.fromTo("#${p}cta-cf${i}",{attr:{transform:"translate(${r2(c.x)} ${r2(c.y0)}) rotate(${r2(c.rot0)})"},opacity:0},{attr:{transform:"translate(${r2(c.x)} ${r2(c.y0 + dy)}) rotate(${r2(c.rot0 + 220)})"},opacity:0.8,duration:${r2(d)},ease:"none"},0);\n`;
  });
  return { markup, anim, char: null };
}

export const WORLDS = {
  "iso-grid": IsoGrid,
  "riso-poster": RisoPoster,
  "ink-dawn": InkDawn,
  "neon-city": NeonCity,
  "paper-forest": PaperForest,
  "cosmic-orbit": CosmicOrbit,
  "blueprint-tech": BlueprintTech,
  "halftone-comic": HalftoneComic,
  "liquid-grad": LiquidGrad,
  "cel-stage": CelStage,
  cta: CtaStage,
};

export const WORLD_KEYS = Object.keys(WORLDS);
