// v6 worlds — ten fully programmatic animated environments.
// NO stock footage, NO photos, NO static backgrounds. Every mountain, window,
// star, gear and blob is drawn as SVG every frame, seeded and deterministic.
//
// Style grammar credits: adapted from the creative vocabulary of
// yihui-dev/awesome-opus5-5-videos (MIT) and lemo-opuscar (MIT core code /
// architecture) — see ATTRIBUTION in the repo README.
import React from "react";
import type { ReelSpec, SceneSpec } from "../theme";
import { rngFor, lerp, clamp01, mix } from "./rand";
import { easeOutCubic, easeInOutQuint, springPunch } from "./easing";
import { TheOne, type Action } from "./TheOne";

export interface WorldProps {
  scene: SceneSpec;
  spec: ReelSpec;
  t: number; // scene-local seconds
  p: number; // scene progress 0..1
  pulse: number; // smoothed audio envelope 0..1
  onset: number; // decaying onset strength 0..1
}

const W = 1080;
const H = 1920;
const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const mixHex = (a: string, b: string, k: number) => {
  const pa = a.replace("#", "");
  const pb = b.replace("#", "");
  const ch = (s: string, i: number) => parseInt(s.slice(i * 2, i * 2 + 2), 16);
  const to = (v: number) =>
    Math.round(v).toString(16).padStart(2, "0");
  const c = [0, 1, 2].map((i) => lerp(ch(pa, i), ch(pb, i), k));
  return `#${to(c[0])}${to(c[1])}${to(c[2])}`;
};

const Char: React.FC<{
  scene: SceneSpec;
  spec: ReelSpec;
  t: number;
  pulse: number;
  pos: [number, number];
  scale: number;
  facing?: number;
}> = ({ scene, spec, t, pulse, pos, scale, facing }) => (
  <g transform={`translate(${pos[0]} ${pos[1]}) scale(${scale})`}>
    <TheOne
      action={scene.action as Action}
      t={t}
      accent={spec.theme.accent}
      pulse={pulse}
      facing={facing ?? 1}
    />
  </g>
);

// ---------------------------------------------------------------- iso-grid
const IsoGrid: React.FC<WorldProps> = ({ scene, spec, t, p, pulse, onset }) => {
  const th = spec.theme;
  const cols = 9;
  const rows = 14;
  const tile = (i: number, j: number) => {
    const x = W / 2 + (i - j) * 74;
    const y = 640 + (i + j) * 37;
    return { x, y };
  };
  const blocks = [0, 1, 2, 3, 4, 5].map((k) => {
    const j = k;
    const i = 3 + k;
    const { x, y } = tile(i, j);
    const h = 60 + k * 34;
    const trig = k === 0 ? -0.6 : k === 1 ? -0.3 : 0.15 + (k - 2) * 0.32;
    const grow = clamp01((t - trig) / 0.5);
    return { x, y, h, grow: springPunch(10, 0.5)(grow), k };
  });
  // rising data squares along the staircase — the compounding metaphor
  const dataSquares = Array.from({ length: 8 }).map((_, i) => {
    const r = rngFor(`${scene.id}:data${i}`);
    const y = 1500 - ((t * (40 + r() * 50) + r() * 1400) % 1400);
    const x = 240 + r() * 640 + Math.sin(t * 0.8 + i) * 20;
    return { x, y, s: 8 + r() * 10, o: 0.25 + 0.55 * Math.abs(Math.sin(t + i)) };
  });
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      {/* horizon glow */}
      <rect x={0} y={560} width={W} height={240} fill={hexA(th.accent, 0.07 + pulse * 0.05)} />
      {/* floor tiles */}
      {Array.from({ length: rows }).map((_, j) =>
        Array.from({ length: cols }).map((_, i) => {
          const { x, y } = tile(i, j);
          if (y > H + 60 || x < -80 || x > W + 80) return null;
          const key = (i * 7 + j * 13) % 9 === 0;
          return (
            <polygon
              key={`t${i}-${j}`}
              points={`${x},${y} ${x + 74},${y + 37} ${x},${y + 74} ${x - 74},${y + 37}`}
              fill={mixHex(th.panel, th.ink, 0.1)}
              stroke={key ? hexA(th.accent, 0.35) : hexA(th.inkSoft, 0.3)}
              strokeWidth={key ? 3 : 2}
            />
          );
        })
      )}
      {/* ascending staircase blocks */}
      {blocks.map((b) => {
        const s = b.grow;
        if (s <= 0.02) return null;
        const topY = b.y - b.h * s;
        return (
          <g key={`b${b.k}`}>
            {/* right face */}
            <polygon
              points={`${b.x},${topY} ${b.x + 74},${topY + 37} ${b.x + 74},${b.y + 37} ${b.x},${b.y}`}
              fill={mixHex(th.panel, th.bg, 0.55)}
            />
            {/* left face */}
            <polygon
              points={`${b.x},${topY} ${b.x - 74},${topY + 37} ${b.x - 74},${b.y + 37} ${b.x},${b.y}`}
              fill={mixHex(th.panel, th.bg, 0.35)}
            />
            {/* top face */}
            <polygon
              points={`${b.x},${topY} ${b.x + 74},${topY + 37} ${b.x},${topY + 74} ${b.x - 74},${topY + 37}`}
              fill={th.panel}
              stroke={th.accent}
              strokeWidth={3}
            />
            {/* edge light */}
            <line
              x1={b.x - 74}
              y1={topY + 37}
              x2={b.x}
              y2={topY}
              stroke={th.accent}
              strokeWidth={2}
              opacity={0.5 + onset * 0.5}
            />
          </g>
        );
      })}
      {/* dashed diamond guides rotating slowly */}
      {[240, 340].map((r, i) => (
        <polygon
          key={`d${r}`}
          points={`540,${700 - r * 0.5} ${540 + r},700 540,${700 + r * 0.5} ${540 - r},700`}
          fill="none"
          stroke={hexA(th.inkSoft, 0.3)}
          strokeWidth={2}
          strokeDasharray="12 16"
          transform={`rotate(${t * (2 + i * 2)} 540 700)`}
        />
      ))}
      {/* rising data squares */}
      {dataSquares.map((d, i) => (
        <rect key={`sq${i}`} x={d.x} y={d.y} width={d.s} height={d.s} rx={3} fill={hexA(th.accent, d.o * 0.6)} transform={`rotate(${t * 20 + i * 45} ${d.x} ${d.y})`} />
      ))}
      <Char
        scene={scene}
        spec={spec}
        t={t}
        pulse={pulse}
        pos={[660, 1130]}
        scale={1.9}
        facing={-1}
      />
    </g>
  );
};

// ---------------------------------------------------------------- riso-poster
const RisoPoster: React.FC<WorldProps> = ({ scene, spec, t, p, pulse, onset }) => {
  const th = spec.theme;
  const pid = `riso-${scene.id}`;
  const bars = [0.5, 0.75, 1, 0.62, 0.88, 0.4, 0.68];
  const misreg = 4;
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      <defs>
        <pattern id={`${pid}-dots`} width={22} height={22} patternUnits="userSpaceOnUse">
          <circle cx={4} cy={4} r={1.6} fill={hexA(th.ink, 0.10)} />
        </pattern>
        <pattern id={`${pid}-hatch`} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1={0} y1={0} x2={0} y2={14} stroke={hexA(th.ink, 0.08)} strokeWidth={5} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={`url(#${pid}-dots)`} />
      {/* big sun disc with riso misregistration */}
      <g>
        <circle cx={540} cy={720} r={230 + pulse * 8} fill={hexA(th.accentDeep, 0.5)} transform={`translate(${misreg} ${-misreg})`} />
        <circle cx={540} cy={720} r={230 + pulse * 8} fill={hexA(th.accent, 0.55)} />
        <circle cx={540} cy={720} r={230} fill="none" stroke={th.ink} strokeWidth={3} opacity={0.25} />
      </g>
      {/* concentric arcs */}
      {[310, 380, 450].map((r, i) => (
        <circle
          key={r}
          cx={540}
          cy={720}
          r={r}
          fill="none"
          stroke={hexA(th.inkSoft, 0.35)}
          strokeWidth={2}
          strokeDasharray={`${30 + i * 18} ${22}`}
          transform={`rotate(${t * (4 + i * 3)} 540 720)`}
        />
      ))}
      {/* hatched band behind type zone */}
      <rect x={0} y={980} width={W} height={330} fill={`url(#${pid}-hatch)`} opacity={0.8} />
      {/* rising bars */}
      {bars.map((hh, i) => {
        const grow = clamp01((t - 0.25 - i * 0.14) / 1.1) * hh;
        const hgt = grow * 560;
        if (hgt < 4) return null;
        const x = 140 + i * 130;
        return (
          <g key={`bar${i}`}>
            <rect x={x + misreg} y={1600 - hgt} width={74} height={hgt} fill={hexA(th.accentDeep, 0.4)} />
            <rect x={x} y={1600 - hgt} width={74} height={hgt} fill={hexA(th.accent, 0.9 - i * 0.07)} />
            <rect x={x} y={1600 - hgt} width={74} height={6} fill={th.ink} opacity={0.6} />
          </g>
        );
      })}
      <rect x={0} y={1600} width={W} height={320} fill={th.panel} />
      <line x1={0} y1={1600} x2={W} y2={1600} stroke={th.ink} strokeWidth={3} opacity={0.4} />
      {/* accent flash ring on onset */}
      {onset > 0.05 && (
        <circle cx={540} cy={720} r={230 + (1 - onset) * 320} fill="none" stroke={hexA(th.ink, onset * 0.35)} strokeWidth={14} />
      )}
      <Char scene={scene} spec={spec} t={t} pulse={pulse} pos={[820, 1600]} scale={2.1} facing={-1} />
    </g>
  );
};

// ---------------------------------------------------------------- ink-dawn
const InkDawn: React.FC<WorldProps> = ({ scene, spec, t, p, pulse }) => {
  const th = spec.theme;
  const strata = [0.1, 0.28, 0.5, 0.72, 0.95].map((k, i) => {
    const r = rngFor(`${scene.id}:mtn${i}`);
    const pts: string[] = [];
    const n = 8;
    const base = 950 + i * 180;
    const amp = 130 + i * 60;
    for (let x = -120; x <= W + 120; x += (W + 240) / n) {
      const y = base - r() * amp;
      pts.push(`${x},${y.toFixed(0)}`);
    }
    const drift = (t * (2 + i * 3)) % 240;
    return {
      d: `M -240 ${H + 10} L -240 ${base} ${pts.join(" L ")} L ${W + 240} ${base} L ${W + 240} ${H + 10} Z`,
      fill: mixHex(th.bg, th.ink, 0.12 + k * 0.8),
      drift,
      i,
    };
  });
  const sunY = lerp(1290, 640, easeInOutQuint(clamp01(p)));
  const birds = Array.from({ length: 5 }).map((_, i) => {
    const r = rngFor(`${scene.id}:bird${i}`);
    const y0 = 380 + r() * 220;
    const x = ((t * (26 + i * 8) + r() * 1400) % 1500) - 210;
    const flap = Math.abs(Math.sin(t * 3 + i));
    return { x, y0, flap };
  });
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      {/* sun + rings */}
      <circle cx={740} cy={sunY} r={110} fill={hexA(th.accent, 0.95)} />
      <circle cx={740} cy={sunY} r={110 + 16} fill="none" stroke={hexA(th.accent, 0.5)} strokeWidth={2} />
      {[190, 260].map((r) => (
        <circle key={r} cx={740} cy={sunY} r={r} fill="none" stroke={hexA(th.accent, 0.28)} strokeWidth={2} strokeDasharray="10 14" />
      ))}
      {/* mist bands */}
      {[1060, 1180, 1300].map((y, i) => (
        <rect
          key={y}
          x={-140 + ((t * (12 + i * 9) + i * 220) % 380)}
          y={y}
          width={1400}
          height={54}
          rx={27}
          fill={hexA(th.bg === "#F5F1E8" ? "#FFFFFF" : th.panel, 0.5)}
        />
      ))}
      {/* parallax mountains */}
      {strata.map((s) => (
        <path key={s.i} d={s.d} fill={s.fill} transform={`translate(${(s.drift - 120) * 0.2} 0)`} />
      ))}
      {/* birds */}
      {birds.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y0})`}>
          <path d={`M -14 ${-6 * b.flap} Q 0 ${8} 14 ${-6 * b.flap}`} stroke={th.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      ))}
      <Char scene={scene} spec={spec} t={t} pulse={pulse} pos={[380, 1785]} scale={2.0} facing={1} />
    </g>
  );
};

// ---------------------------------------------------------------- neon-city
const NeonCity: React.FC<WorldProps> = ({ scene, spec, t, pulse, onset }) => {
  const th = spec.theme;
  const R = rngFor(scene.id + "city");
  const far = Array.from({ length: 12 }).map((_, i) => {
    const w = 70 + R() * 110;
    const h = 140 + R() * 320;
    const x = -40 + i * 95 + R() * 30;
    const y = 1430 - h;
    return { x, y, w, h, i };
  });
  const blds = Array.from({ length: 9 }).map((_, i) => {
    const w = 90 + R() * 130;
    const h = 260 + R() * 620;
    const x = -60 + i * 130 + R() * 40;
    const y = 1430 - h;
    const win: { x: number; y: number; lit: boolean; warm: boolean }[] = [];
    const cols = Math.max(2, Math.floor(w / 34));
    const rowsN = Math.max(3, Math.floor(h / 52));
    for (let c = 0; c < cols; c++)
      for (let r2 = 0; r2 < rowsN; r2++) {
        const rr = R();
        if (rr < 0.45)
          win.push({ x: 12 + c * 34, y: 18 + r2 * 52, lit: true, warm: R() < 0.6 });
      }
    return { x, y, w, h, win, i };
  });
  const drops = Array.from({ length: 46 }).map((_, i) => {
    const r = rngFor(`${scene.id}:drop${i}`);
    return { x: r() * W, y: (r() * H + t * (700 + r() * 300)) % (H + 40), len: 26 + r() * 34, sp: 0.2 + r() * 0.4 };
  });
  const signFlick = 0.75 + 0.25 * (Math.sin(t * 13) > 0.94 ? 0.2 : 1);
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      <defs>
        <filter id={`neon-${scene.id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={7} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={`nglow-${scene.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hexA(th.accent, 0.16 + pulse * 0.1)} />
          <stop offset="1" stopColor={hexA(th.accent, 0)} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={540} fill={`url(#nglow-${scene.id})`} />
      {/* far parallax skyline */}
      <g opacity={0.55} transform={`translate(${Math.sin(t * 0.3) * 18} 0)`}>
        {far.map((b) => (
          <rect key={`f${b.i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={hexA(th.panel, 0.9)} />
        ))}
      </g>
      {/* skyline */}
      {blds.map((b) => (
        <g key={b.i}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#0E0F16" />
          <rect x={b.x} y={b.y} width={b.w} height={4} fill={hexA(th.ink, 0.1)} />
          {b.win.map((wd, j) => (
            <rect
              key={j}
              x={b.x + wd.x}
              y={b.y + wd.y}
              width={14}
              height={20}
              fill={wd.warm ? hexA("#E8B84B", 0.75) : hexA(th.accent, 0.6)}
              opacity={0.5 + 0.5 * Math.sin(t * 0.7 + j)}
            />
          ))}
        </g>
      ))}
      {/* reflection strip */}
      <g transform={`translate(0 ${1430}) scale(1 -0.28)`} opacity={0.22}>
        {blds.slice(0, 6).map((b) => (
          <rect key={b.i} x={b.x} y={0} width={b.w} height={b.h} fill={th.panel} />
        ))}
      </g>
      <rect x={0} y={1430} width={W} height={490} fill="#0B0C12" />
      {/* rooftop platform */}
      <rect x={140} y={1408} width={800} height={16} rx={8} fill="#14151D" />
      <line x1={140} y1={1416} x2={940} y2={1416} stroke={hexA(th.accent, 0.7)} strokeWidth={3} />
      {/* neon sign — mounted on poles */}
      <g stroke={hexA(th.ink, 0.4)} strokeWidth={6}>
        <line x1={109} y1={880} x2={109} y2={1408} />
        <line x1={843} y1={960} x2={843} y2={1408} />
      </g>
      <g filter={`url(#neon-${scene.id})`} opacity={signFlick}>
        <rect x={96} y={560} width={26} height={300} rx={12} fill="none" stroke={th.accent} strokeWidth={6} />
        <rect x={830} y={700} width={26} height={240} rx={12} fill="none" stroke={th.accent} strokeWidth={6} />
        {[640, 700, 760].map((y) => (
          <rect key={y} x={70} y={y} width={80} height={7} rx={3} fill={th.accent} opacity={0.8} />
        ))}
      </g>
      {/* rain */}
      {drops.map((d, i) => (
        <line key={i} x1={d.x} y1={d.y} x2={d.x - 7} y2={d.y + d.len} stroke={hexA(th.ink, 0.22 * d.sp + 0.08)} strokeWidth={2} />
      ))}
      {/* lightning flash on onset */}
      {onset > 0.04 && <rect x={0} y={0} width={W} height={H} fill={hexA(th.accent, onset * 0.1)} />}
      <Char scene={scene} spec={spec} t={t} pulse={pulse} pos={[540, 1408]} scale={2.4} />
    </g>
  );
};

// ---------------------------------------------------------------- paper-forest
const PaperForest: React.FC<WorldProps> = ({ scene, spec, t, pulse }) => {
  const th = spec.theme;
  const rows = [
    { y: 1180, scale: 0.7, col: mixHex(th.bg, "#0A2214", 0.5), sp: 6 },
    { y: 1380, scale: 1.0, col: mixHex(th.bg, "#123324", 0.7), sp: 12 },
    { y: 1600, scale: 1.35, col: mixHex(th.bg, "#1A4730", 0.85), sp: 20 },
  ];
  const fireflies = Array.from({ length: 16 }).map((_, i) => {
    const r = rngFor(`${scene.id}:ff${i}`);
    const x = 60 + r() * 960;
    const y = 700 + r() * 900;
    const ph = r() * 10;
    return { x, y: y + Math.sin(t * 0.5 + ph) * 18, o: 0.35 + 0.65 * Math.abs(Math.sin(t * 0.9 + ph)), ph };
  });
  const chain = scene.motif === "chain";
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      {/* light shafts */}
      {[220, 520, 800].map((x, i) => (
        <polygon
          key={x}
          points={`${x},-40 ${x + 130},-40 ${x + 320},${H} ${x + 60},${H}`}
          fill={hexA("#E9FFD8", 0.05 + i * 0.012)}
        />
      ))}
      {/* trees */}
      {rows.map((row, ri) =>
        Array.from({ length: 7 }).map((_, i) => {
          const r = rngFor(`${scene.id}:tree${ri}-${i}`);
          const x = ((i * 190 + r() * 120 + t * row.sp) % 1500) - 210;
          const hgt = (150 + r() * 90) * row.scale;
          return (
            <g key={`${ri}-${i}`} transform={`translate(${x} ${row.y})`}>
              <rect x={-10} y={-hgt * 0.4} width={22 * row.scale} height={hgt * 0.42} rx={8} fill={mixHex(row.col, "#000000", 0.3)} />
              <circle cx={0} cy={-hgt * 0.55} r={hgt * 0.34} fill={row.col} />
              <circle cx={-hgt * 0.2} cy={-hgt * 0.4} r={hgt * 0.24} fill={mixHex(row.col, "#FFFFFF", 0.05)} />
              <circle cx={hgt * 0.2} cy={-hgt * 0.42} r={hgt * 0.22} fill={mixHex(row.col, "#000000", 0.12)} />
            </g>
          );
        })
      )}
      {/* fog bands */}
      {[1040, 1240, 1460, 1680].map((y, i) => (
        <rect
          key={y}
          x={-160 + ((t * (9 + i * 6) + i * 240) % 420)}
          y={y}
          width={1500}
          height={70}
          rx={35}
          fill={hexA("#CFE8D8", 0.07 + i * 0.02)}
        />
      ))}
      {/* chain-link path */}
      {chain &&
        Array.from({ length: 7 }).map((_, i) => {
          const y = 1560 - i * 64;
          const x = 300 + i * 84 + Math.sin(i) * 18;
          const pop = springPunch(10, 0.5)(clamp01((t - 0.3 - i * 0.22) / 0.5));
          return (
            <g key={i} opacity={pop}>
              <ellipse cx={x} cy={y} rx={34} ry={20} fill="none" stroke={th.accent} strokeWidth={9} transform={`rotate(${i % 2 ? 18 : -14} ${x} ${y})`} />
            </g>
          );
        })}
      {/* fireflies */}
      {fireflies.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={5} fill={hexA(th.accent, f.o * (0.6 + pulse * 0.4))} />
      ))}
      <Char scene={scene} spec={spec} t={t} pulse={pulse} pos={[620, 1760]} scale={2.0} facing={1} />
    </g>
  );
};

// ---------------------------------------------------------------- cosmic-orbit
const CosmicOrbit: React.FC<WorldProps> = ({ scene, spec, t, pulse, onset }) => {
  const th = spec.theme;
  const stars = Array.from({ length: 150 }).map((_, i) => {
    const r = rngFor(`${scene.id}:star${i}`);
    return {
      x: r() * W,
      y: r() * H * 0.9,
      r: 0.6 + r() * 1.8,
      ph: r() * 10,
      f: 0.4 + r() * 1.6,
    };
  });
  const planetY = 1560;
  const shoot = onset > 0.05;
  const sh = shoot ? (1 - onset) : 0;
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      <defs>
        <radialGradient id={`pl-${scene.id}`}>
          <stop offset="0" stopColor={hexA(th.accent, 0.9)} />
          <stop offset="0.7" stopColor={hexA(th.accentDeep, 0.8)} />
          <stop offset="1" stopColor={hexA(th.accentDeep, 0.1)} />
        </radialGradient>
      </defs>
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill={hexA(th.ink, 0.25 + 0.75 * Math.abs(Math.sin(t * s.f + s.ph)) * 0.7)}
        />
      ))}
      {/* nebula */}
      <ellipse cx={260} cy={420} rx={300} ry={170} fill={hexA(th.accentDeep, 0.1)} />
      <ellipse cx={820} cy={640} rx={260} ry={140} fill={hexA(th.accent, 0.08)} />
      {/* orbit rings */}
      {[0.2, 0.35].map((k, i) => (
        <ellipse
          key={i}
          cx={540}
          cy={planetY - 40}
          rx={430 - i * 120}
          ry={90 - i * 22}
          fill="none"
          stroke={hexA(th.inkSoft, 0.4)}
          strokeWidth={2}
          strokeDasharray="14 18"
          transform={`rotate(${(t * (6 + i * 4)) % 360} 540 ${planetY - 40})`}
        />
      ))}
      {/* planet */}
      <circle cx={540} cy={planetY} r={230} fill={`url(#pl-${scene.id})`} />
      <ellipse
        cx={540}
        cy={planetY}
        rx={380}
        ry={74}
        fill="none"
        stroke={hexA(th.accent, 0.55)}
        strokeWidth={10}
        transform={`rotate(-14 540 ${planetY})`}
      />
      {/* shooting star on onset */}
      {shoot && (
        <g opacity={onset}>
          <line x1={lerp(180, 620, sh)} y1={lerp(240, 560, sh)} x2={lerp(230, 660, sh)} y2={lerp(200, 520, sh)} stroke={th.ink} strokeWidth={4} strokeLinecap="round" />
        </g>
      )}
      <Char scene={scene} spec={spec} t={t} pulse={pulse} pos={[540, 820]} scale={2.0} />
    </g>
  );
};

// ---------------------------------------------------------------- blueprint-tech
const BlueprintTech: React.FC<WorldProps> = ({ scene, spec, t, p }) => {
  const th = spec.theme;
  const grid = [];
  for (let x = 0; x <= W; x += 60) grid.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={hexA(th.inkSoft, x % 180 === 0 ? 0.22 : 0.1)} strokeWidth={1.5} />);
  for (let y = 0; y <= H; y += 60) grid.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={hexA(th.inkSoft, y % 180 === 0 ? 0.22 : 0.1)} strokeWidth={1.5} />);
  const gear = (cx: number, cy: number, r: number, dir: number, teeth: number) => {
    const step = Math.floor(t * 1.8);
    const frac = easeOutCubic((t * 1.8) % 1);
    const rot = (step + frac) * (360 / teeth) * dir;
    return (
      <g transform={`rotate(${rot} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={th.ink} strokeWidth={3} />
        {Array.from({ length: teeth }).map((_, i) => {
          const a = (i / teeth) * Math.PI * 2;
          const x1 = cx + Math.cos(a) * r;
          const y1 = cy + Math.sin(a) * r;
          const x2 = cx + Math.cos(a) * (r + 18);
          const y2 = cy + Math.sin(a) * (r + 18);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={th.ink} strokeWidth={6} />;
        })}
        <circle cx={cx} cy={cy} r={r * 0.32} fill="none" stroke={th.accent} strokeWidth={4} />
        <circle cx={cx} cy={cy} r={r * 0.06} fill={th.accent} />
      </g>
    );
  };
  const stack = 5;
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      {grid}
      {/* dashed pitch circles */}
      {[320, 460].map((r, i) => (
        <circle key={r} cx={540} cy={880} r={r} fill="none" stroke={hexA(th.inkSoft, 0.5)} strokeWidth={2} strokeDasharray="8 12" transform={`rotate(${t * (i ? -3 : 2)} 540 880)`} />
      ))}
      {gear(540, 880, 150, 1, 12)}
      {gear(320, 1240, 90, -1, 10)}
      {gear(780, 1260, 110, -1, 12)}
      {/* exploded stack unfolding with scene progress */}
      {Array.from({ length: stack }).map((_, i) => {
        const d = easeOutCubic(clamp01((p - 0.15 * i) / 0.5));
        const y = 1560 + i * 26;
        const x = lerp(540, 540 + (i - stack / 2) * 150, d);
        return (
          <rect
            key={i}
            x={x - 120}
            y={y - d * 180}
            width={240}
            height={22}
            rx={6}
            fill={hexA(th.panel, 0.95)}
            stroke={hexA(th.ink, 0.5)}
            strokeWidth={2}
          />
        );
      })}
      {/* leader lines */}
      <g stroke={hexA(th.accent, 0.6)} strokeWidth={2.5} fill="none">
        <path d={`M 700 880 L 940 880 L 970 850`} />
        <path d={`M 860 1260 L 990 1260 L 1020 1230`} />
        <circle cx={970} cy={850} r={4} fill={th.accent} stroke="none" />
        <circle cx={1020} cy={1230} r={4} fill={th.accent} stroke="none" />
      </g>
      <Char scene={scene} spec={spec} t={t} pulse={0} pos={[540, 1640]} scale={1.9} />
    </g>
  );
};

// ---------------------------------------------------------------- halftone-comic
const HalftoneComic: React.FC<WorldProps> = ({ scene, spec, t, p, onset }) => {
  const th = spec.theme;
  const pid = `hal-${scene.id}`;
  const burst = onset > 0.05;
  const wedgeRot = t * 8;
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      <defs>
        <pattern id={`${pid}-dots`} width={20} height={20} patternUnits="userSpaceOnUse">
          <circle cx={10} cy={10} r={4.2} fill={hexA(th.ink, 0.16)} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill={`url(#${pid}-dots)`} />
      {/* radial burst on onset */}
      {burst &&
        Array.from({ length: 14 }).map((_, i) => {
          const a = (i / 14) * Math.PI * 2 + wedgeRot;
          const r1 = 320 * (1 - onset) + 180;
          return (
            <line
              key={i}
              x1={540 + Math.cos(a) * r1}
              y1={760 + Math.sin(a) * r1}
              x2={540 + Math.cos(a) * (r1 + 340)}
              y2={760 + Math.sin(a) * (r1 + 340)}
              stroke={hexA(th.ink, onset * 0.5)}
              strokeWidth={10}
              strokeLinecap="round"
            />
          );
        })}
      {/* comic panel */}
      <g transform={`rotate(-2 540 1150)`}>
        <rect x={150} y={880} width={780} height={520} rx={26} fill={th.panel} stroke={th.ink} strokeWidth={10} />
        <rect x={178} y={908} width={724} height={464} rx={14} fill={`url(#${pid}-dots)`} />
        {/* lightning bolt / star motif */}
        <g transform={`translate(540 1140) rotate(${Math.sin(t * 2) * 4})`}>
          {scene.motif === "bolt" ? (
            <>
              <path d="M -30 -160 L 60 -160 L 20 -40 L 90 -40 L -50 160 L -10 10 L -70 10 Z" fill={th.accent} transform="translate(5 5)" opacity={0.6} />
              <path d="M -30 -160 L 60 -160 L 20 -40 L 90 -40 L -50 160 L -10 10 L -70 10 Z" fill={th.accent} />
            </>
          ) : (
            <>
              <circle r={110} fill={hexA(th.accent, 0.9)} transform="translate(6 6)" />
              <circle r={110} fill={th.accent} />
              <path d="M 0 -60 L 18 -18 L 60 0 L 18 18 L 0 60 L -18 18 L -60 0 L -18 -18 Z" fill={th.ink} />
            </>
          )}
        </g>
      </g>
      {/* speed lines */}
      {[0, 1].map((k) =>
        Array.from({ length: 6 }).map((_, i) => (
          <line
            key={`${k}-${i}`}
            x1={k ? W - 40 : 40}
            y1={200 + i * 60}
            x2={k ? W - 200 : 200}
            y2={180 + i * 60}
            stroke={hexA(th.ink, 0.3)}
            strokeWidth={6}
            strokeLinecap="round"
          />
        ))
      )}
      <Char scene={scene} spec={spec} t={t} pulse={onset} pos={[540, 1790]} scale={2.0} />
    </g>
  );
};

// ---------------------------------------------------------------- liquid-grad
const LiquidGrad: React.FC<WorldProps> = ({ scene, spec, t, p, pulse }) => {
  const th = spec.theme;
  const blobs = [
    { cx: 340, cy: 520, r: 360, col: th.accent, f: 0.11, ph: 0 },
    { cx: 760, cy: 880, r: 420, col: th.accentDeep, f: 0.09, ph: 2.1 },
    { cx: 420, cy: 1360, r: 380, col: th.panel, f: 0.13, ph: 4.2 },
    { cx: 880, cy: 1600, r: 300, col: th.accent, f: 0.12, ph: 1.2 },
  ];
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      <defs>
        {blobs.map((b, i) => (
          <radialGradient id={`lg-${scene.id}-${i}`} key={i}>
            <stop offset="0" stopColor={hexA(b.col, 0.5 + pulse * 0.1)} />
            <stop offset="0.6" stopColor={hexA(b.col, 0.22)} />
            <stop offset="1" stopColor={hexA(b.col, 0)} />
          </radialGradient>
        ))}
        <pattern id={`lgd-${scene.id}`} width={26} height={26} patternUnits="userSpaceOnUse">
          <circle cx={6} cy={6} r={1.2} fill={hexA(th.ink, 0.08)} />
        </pattern>
      </defs>
      {blobs.map((b, i) => (
        <circle
          key={i}
          cx={b.cx + Math.sin(t * b.f + b.ph) * 46}
          cy={b.cy + Math.cos(t * b.f * 1.3 + b.ph) * 38}
          r={b.r + Math.sin(t * b.f * 2 + b.ph) * 42 + pulse * 14}
          fill={`url(#lg-${scene.id}-${i})`}
        />
      ))}
      <rect x={0} y={0} width={W} height={H} fill={`url(#lgd-${scene.id})`} />
      {/* horizon rule */}
      <line x1={120} y1={1660} x2={960} y2={1660} stroke={hexA(th.ink, 0.25)} strokeWidth={3} />
      {[300, 540, 780].map((x) => (
        <circle key={x} cx={x} cy={1660} r={6} fill={hexA(th.ink, 0.4)} />
      ))}
      <Char scene={scene} spec={spec} t={t} pulse={pulse} pos={[540, 1650]} scale={1.9} />
    </g>
  );
};

// ---------------------------------------------------------------- cel-stage
const CelStage: React.FC<WorldProps> = ({ scene, spec, t, p, pulse, onset }) => {
  const th = spec.theme;
  const pid = `cel-${scene.id}`;
  const motes = Array.from({ length: 22 }).map((_, i) => {
    const r = rngFor(`${scene.id}:mote${i}`);
    const y = ((r() * 1500 + t * (10 + r() * 18)) % 1500);
    const x = 540 + (r() - 0.5) * (y / 1500) * 640;
    return { x, y: 1500 - y, o: 0.2 + 0.6 * Math.abs(Math.sin(t * 0.6 + i)) };
  });
  const puffs = onset > 0.05 ? (1 - onset) : -1;
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill={th.bg} />
      <rect x={0} y={0} width={W} height={1920} fill={th.panel} opacity={0.35} />
      <defs>
        <linearGradient id={`${pid}-cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hexA(th.accent, 0.5 + pulse * 0.25)} />
          <stop offset="1" stopColor={hexA(th.accent, 0.02)} />
        </linearGradient>
      </defs>
      {/* back wall grid */}
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i} x1={0} y1={120 + i * 110} x2={W} y2={120 + i * 110} stroke={hexA(th.inkSoft, 0.06)} strokeWidth={2} />
      ))}
      {/* spotlight cone */}
      <polygon points={`440,0 640,0 940,1560 140,1560`} fill={`url(#${pid}-cone)`} opacity={0.55} />
      {/* light pool */}
      <ellipse cx={540} cy={1560} rx={400} ry={74} fill={hexA(th.accent, 0.3 + pulse * 0.18)} />
      <ellipse cx={540} cy={1560} rx={240} ry={44} fill={hexA(th.accent, 0.35 + pulse * 0.2)} />
      {/* floor perspective lines */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = 540 + (i - 3) * 320;
        return <line key={i} x1={540 + (i - 3) * 90} y1={1560} x2={x} y2={1920} stroke={hexA(th.ink, 0.1)} strokeWidth={2} />;
      })}
      {/* dust motes in cone */}
      {motes.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={3.5} fill={hexA(th.ink, m.o * 0.5)} />
      ))}
      {/* chalk dust puff on onset */}
      {puffs >= 0 &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={540 + (i - 1) * 130}
            cy={1548}
            r={20 + puffs * 90}
            fill={hexA(th.ink, (1 - puffs) * 0.22)}
          />
        ))}
      <Char scene={scene} spec={spec} t={t} pulse={pulse} pos={[540, 1552]} scale={2.4} />
    </g>
  );
};

// ---------------------------------------------------------------- registry
export const WORLDS: Record<string, React.FC<WorldProps>> = {
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
};

export const WORLD_KEYS = Object.keys(WORLDS);
