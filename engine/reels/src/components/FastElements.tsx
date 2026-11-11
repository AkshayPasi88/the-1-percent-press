import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/* FastElements — BOLD, frame-animated SVG backdrops for the fast-cut reel
   style. One element per scene, rotating. All motion is continuous so no
   frame is ever static/empty. Uses sequence-local frame time. */

export interface ElementProps {
  bg: string;
  ink: string;
  accent: string;
  seed: number;
}

const W = 1080;
const H = 1920;
const loop = (v: number, m: number) => ((v % m) + m) % m;

/* 1. WARN — moving hazard stripes top+bottom, giant triangle behind */
const Warn: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const off = loop(f * 7, 92);
  const stripes = (y: number) =>
    Array.from({ length: 17 }, (_, i) => {
      const x = i * 92 + off - 92;
      return (
        <polygon key={`${y}-${i}`} points={`${x},${y} ${x + 46},${y} ${x + 6},${y + 128} ${x - 40},${y + 128}`} fill={ink} opacity={0.85} />
      );
    });
  const tri = 0.14 + 0.08 * Math.sin(f / 5);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {stripes(0)}
      {stripes(1792)}
      <polygon points="540,270 830,780 250,780" fill="none" stroke={accent} strokeWidth={30} opacity={tri} strokeLinejoin="round" />
      <polygon points="540,1140 830,1650 250,1650" fill="none" stroke={accent} strokeWidth={30} opacity={tri} strokeLinejoin="round" />
    </svg>
  );
};

/* 2. CROSS — two giant X strokes + pulsing accent crosses */
const Cross: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const wig = 3 * Math.sin(f / 6);
  const pulse = 0.18 + 0.14 * Math.abs(Math.sin(f / 7));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g transform={`rotate(${wig} 540 960)`} stroke={ink} strokeWidth={62} opacity={0.16} strokeLinecap="round">
        <line x1={130} y1={330} x2={950} y2={1230} />
        <line x1={950} y1={330} x2={130} y2={1230} />
      </g>
      <g stroke={accent} strokeWidth={30} opacity={pulse} strokeLinecap="round">
        <line x1={140} y1={170} x2={300} y2={330} />
        <line x1={300} y1={170} x2={140} y2={330} />
        <line x1={780} y1={1590} x2={940} y2={1750} />
        <line x1={940} y1={1590} x2={780} y2={1750} />
      </g>
    </svg>
  );
};

/* 3. CHEVRONS — three giant chevrons flying across the frame */
const Chevrons: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {[0, 1, 2].map((i) => {
        const x = loop(f * 30 + i * 300, 1900) - 420;
        const op = [0.4, 0.26, 0.16][i];
        const fill = i === 0 ? ink : accent;
        return (
          <polygon key={i} points={`${x},420 ${x + 300},960 ${x},1500 ${x + 160},960`} fill={fill} opacity={op} />
        );
      })}
    </svg>
  );
};

/* 4. BURST — rotating sunburst rays + expanding rings */
const Burst: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const rays = Array.from({ length: 14 }, (_, i) => {
    const a = ((i * 360) / 14 + f * 1.6) * (Math.PI / 180);
    return (
      <line key={i} x1={540 + Math.sin(a) * 250} y1={860 - Math.cos(a) * 250}
        x2={540 + Math.sin(a) * 620} y2={860 - Math.cos(a) * 620}
        stroke={ink} strokeWidth={30} opacity={0.3} strokeLinecap="round" />
    );
  });
  const ring = (phase: number) => {
    const p = loop(f / 26 + phase, 1);
    const r = 180 + p * 460;
    return <circle key={phase} cx={540} cy={860} r={r} fill="none" stroke={accent} strokeWidth={16 * (1 - p) + 4} opacity={0.5 * (1 - p)} />;
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {rays}
      {ring(0)}
      {ring(0.5)}
    </svg>
  );
};

/* 5. STACK — blocks stacking upward, floating */
const Stack: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const blocks = Array.from({ length: 6 }, (_, i) => i);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {blocks.map((i) => {
        const s = spring({ frame: f - i * 2, fps, config: { damping: 11, stiffness: 200 } });
        const w = 250 - i * 22;
        const y = 1660 - i * 150;
        const bob = 10 * Math.sin(f / 8 + i);
        return (
          <rect key={i} x={540 - w / 2} y={y + bob + (1 - s) * 220} width={w} height={110} rx={18}
            fill={i % 2 ? accent : ink} opacity={0.28 + i * 0.06} />
        );
      })}
    </svg>
  );
};

/* 6. ROCKET — big up-arrow bobbing + falling speed dashes */
const Rocket: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const bob = 26 * Math.sin(f / 7);
  const dashes = Array.from({ length: 10 }, (_, i) => {
    const y = loop(f * 46 + i * 190, 900);
    const x = i % 2 ? 190 : 830;
    return <rect key={i} x={x} y={y + 350} width={14} height={120} rx={7} fill={accent} opacity={0.4} />;
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {dashes}
      <g transform={`translate(0 ${bob})`}>
        <polygon points="540,300 730,600 630,600 630,760 450,760 450,600 350,600" fill={ink} opacity={0.5} />
        <polygon points="540,380 660,590 420,590" fill={bgSafe} opacity={0.9} />
        <rect x={450} y={760} width={180} height={40} fill={accent} opacity={0.7} />
      </g>
    </svg>
  );
};

/* 7. SLASH — two thick diagonal bars sweeping across */
const Slash: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const bar = (speed: number, y: number, color: string, op: number, phase: number) => {
    const x = loop(f * speed + phase, 2100) - 500;
    return (
      <polygon key={`${y}-${phase}`} points={`${x},${y} ${x + 470},${y} ${x + 410},${y + 90} ${x - 60},${y + 90}`} fill={color} opacity={op} />
    );
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {bar(34, 520, ink, 0.4, 0)}
      {bar(26, 1060, accent, 0.3, 700)}
      {bar(40, 1420, ink, 0.22, 350)}
    </svg>
  );
};

/* 8. METER — gauge arc filling + sweeping needle */
const Meter: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 16, stiffness: 90 } });
  const p = Math.min(1, s);
  const arc = Math.PI * 380;
  const angle = -90 + p * 180;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <path d="M 160 1060 A 380 380 0 0 1 920 1060" fill="none" stroke={ink} strokeWidth={40} opacity={0.18} strokeLinecap="round" />
      <path d="M 160 1060 A 380 380 0 0 1 920 1060" fill="none" stroke={accent} strokeWidth={40} opacity={0.55}
        strokeDasharray={`${arc * p} ${arc}`} strokeLinecap="round" />
      <g transform={`rotate(${angle} 540 1060)`}>
        <line x1={540} y1={1060} x2={540} y2={720} stroke={ink} strokeWidth={20} opacity={0.8} strokeLinecap="round" />
        <circle cx={540} cy={720} r={26} fill={ink} opacity={0.9} />
      </g>
      <circle cx={540} cy={1060} r={34} fill={accent} opacity={0.9} />
    </svg>
  );
};

/* 9. BOLT — giant flashing lightning */
const Bolt: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const flash = (off: number) => Math.pow(Math.abs(Math.sin((f + off) / 7)), 4);
  const poly = "600,140 840,660 700,660 890,1180 460,740 620,740 470,420";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <polygon points={poly} fill={ink} opacity={0.2 + 0.4 * flash(0)} />
      <g transform="translate(60,620) scale(0.42) rotate(-14)">
        <polygon points={poly} fill={accent} opacity={0.15 + 0.35 * flash(9)} />
      </g>
      <g transform="translate(560,300) scale(0.3) rotate(12)">
        <polygon points={poly} fill={accent} opacity={0.12 + 0.3 * flash(4)} />
      </g>
    </svg>
  );
};

/* 10. TARGET — crosshair + rotating dashed rings */
const Target: React.FC<ElementProps> = ({ ink, accent }) => {
  const f = useCurrentFrame();
  const wob = 6 * Math.sin(f / 9);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(${wob} ${wob / 2})`}>
        <circle cx={540} cy={860} r={310} fill="none" stroke={ink} strokeWidth={26} opacity={0.35} />
        <circle cx={540} cy={860} r={200} fill="none" stroke={accent} strokeWidth={18}
          strokeDasharray="40 26" opacity={0.55} transform={`rotate(${f * 2} 540 860)`} />
        <circle cx={540} cy={860} r={90 + 12 * Math.sin(f / 5)} fill={accent} opacity={0.28} />
        <line x1={540} y1={440} x2={540} y2={560} stroke={ink} strokeWidth={16} opacity={0.5} strokeLinecap="round" />
        <line x1={540} y1={1160} x2={540} y2={1280} stroke={ink} strokeWidth={16} opacity={0.5} strokeLinecap="round" />
        <line x1={120} y1={860} x2={240} y2={860} stroke={ink} strokeWidth={16} opacity={0.5} strokeLinecap="round" />
        <line x1={840} y1={860} x2={960} y2={860} stroke={ink} strokeWidth={16} opacity={0.5} strokeLinecap="round" />
      </g>
    </svg>
  );
};

const VARIANTS: Record<string, React.FC<ElementProps>> = {
  warn: Warn, cross: Cross, chevrons: Chevrons, burst: Burst, stack: Stack,
  rocket: Rocket, slash: Slash, meter: Meter, bolt: Bolt, target: Target,
};

export const FastElement: React.FC<ElementProps & { name: string }> = ({ name, ...rest }) => {
  const V = VARIANTS[name] ?? Warn;
  return <V {...rest} />;
};

/* bgSafe is injected per-instance via element context for the Rocket cutout */
let bgSafe = "#FFFFFF";
export const setElementBg = (bg: string) => { bgSafe = bg; };

export const hookPulse = (f: number) => 0.7 + 0.3 * Math.sin(f / 3);
