import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface Theme {
  bg: string; panel: string; accent: string; accentDeep: string; ink: string; inkSoft: string;
}

const W = 1080;
const H = 1920;
const loop = (frame: number, period: number) => ((frame % period) + period) % period;

/* ── 1. BARS — rising growth chart ─────────────────────────────── */
const Bars: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const heights = [160, 250, 360, 480, 610, 730, 850];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {heights.map((h0, i) => {
        const s = spring({ frame: frame - 4 - i * 6, fps, config: { damping: 16, stiffness: 110 } });
        const h = h0 * Math.min(1, s) * (1 + 0.025 * Math.sin((frame - i * 6) / 11));
        const x = 110 + i * 136;
        return (
          <rect key={i} x={x} y={H - 200 - h} width={88} height={Math.max(4, h)} rx={44}
            fill={th.accent} opacity={i === heights.length - 1 ? 0.75 : 0.13 + i * 0.055} />
        );
      })}
    </svg>
  );
};

/* ── 2. BOLT — flashing lightning ───────────────────────────────── */
const Bolt: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const flash = (off: number) => Math.pow(Math.abs(Math.sin((frame + off) / 9)), 5);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g opacity={0.08 + 0.34 * flash(0)}>
        <polygon points="660,120 810,620 700,620 850,1080 540,700 660,700 520,420"
          fill={th.accent} />
      </g>
      <g opacity={0.08 + 0.4 * flash(14)} transform="translate(180,560) scale(0.45) rotate(-14)">
        <polygon points="660,120 810,620 700,620 850,1080 540,700 660,700 520,420" fill={th.accent} />
      </g>
      <g opacity={0.06 + 0.35 * flash(7)} transform="translate(640,900) scale(0.32) rotate(12)">
        <polygon points="660,120 810,620 700,620 850,1080 540,700 660,700 520,420" fill={th.accent} />
      </g>
    </svg>
  );
};

/* ── 3. WAVES — flowing sine lines ──────────────────────────────── */
const Waves: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const rows = [1120, 1290, 1460, 1630];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {rows.map((y, r) => {
        const dx = -loop(frame * (3 + r), 480);
        let d = `M ${-480 + dx} ${y}`;
        for (let x = 0; x < 4; x++)
          d += ` q 120 -70 240 0 q 120 70 240 0`;
        return (
          <path key={r} d={d} fill="none" stroke={th.accent} strokeWidth={14}
            opacity={0.34 - r * 0.06} strokeLinecap="round" />
        );
      })}
    </svg>
  );
};

/* ── 4. RINGS — concentric rotating dashed circles ──────────────── */
const Rings: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const radii = [180, 280, 385, 495, 610];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {radii.map((r, i) => (
        <circle key={i} cx={540} cy={780} r={r} fill="none" stroke={th.accent}
          strokeWidth={i === radii.length - 1 ? 10 : 5}
          strokeDasharray={i % 2 ? `${r * 0.7} ${r * 0.45}` : `${r * 0.25} ${r * 0.18}`}
          opacity={0.4 - i * 0.055}
          transform={`rotate(${frame * (0.5 - i * 0.15)} 540 780)`} />
      ))}
      <circle cx={540} cy={780} r={90 + 10 * Math.sin(frame / 10)} fill={th.accent} opacity={0.16} />
    </svg>
  );
};

/* ── 5. DOTS — radial pulse grid ────────────────────────────────── */
const Dots: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const cols = 9, rows = 14, gap = 118, cx = 540, cy = 800;
  const dots = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = 60 + c * gap, y = 130 + r * gap;
      const dist = Math.hypot(x - cx, y - cy);
      const pulse = Math.pow(Math.max(0, Math.sin(frame / 7 - dist / 150)), 2);
      dots.push({ x, y, o: 0.1 + 0.55 * pulse, s: 7 + 7 * pulse });
    }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.s} fill={th.accent} opacity={d.o} />
      ))}
    </svg>
  );
};

/* ── 6. STREAKS — diagonal speed lines ──────────────────────────── */
const Streaks: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const lines = Array.from({ length: 14 }, (_, i) => ({
    y: 120 + i * 132,
    len: 260 + (i * 97) % 460,
    speed: 9 + (i % 4) * 4,
    o: 0.07 + ((i * 53) % 10) / 90,
  }));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {lines.map((l, i) => {
        const x = loop(i * 211 - frame * l.speed, 1900) - 420;
        return (
          <rect key={i} x={x} y={l.y} width={l.len} height={16} rx={8}
            fill={th.accent} opacity={l.o} transform={`rotate(-16 ${x} ${l.y})`} />
        );
      })}
    </svg>
  );
};

/* ── 7. CLOCK — ticking dial with sweeping hand ─────────────────── */
const Clock: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const angle = frame * 1.4;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <circle cx={540} cy={760} r={400} fill="none" stroke={th.accent} strokeWidth={6} opacity={0.22} />
      <circle cx={540} cy={760} r={400} fill="none" stroke={th.accent} strokeWidth={12}
        strokeDasharray={`${2 * Math.PI * 400 * 0.75} ${2 * Math.PI * 400}`}
        strokeDashoffset={2 * Math.PI * 400 * 0.25}
        transform={`rotate(-90 540 760)`} opacity={0.5} strokeLinecap="round" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return (
          <line key={i} x1={540 + Math.sin(a) * 360} y1={760 - Math.cos(a) * 360}
            x2={540 + Math.sin(a) * 400} y2={760 - Math.cos(a) * 400}
            stroke={th.accent} strokeWidth={10} opacity={0.3} strokeLinecap="round" />
        );
      })}
      <g transform={`rotate(${angle} 540 760)`}>
        <line x1={540} y1={760} x2={540} y2={430} stroke={th.accent} strokeWidth={14} opacity={0.8} strokeLinecap="round" />
        <circle cx={540} cy={430} r={20} fill={th.accent} opacity={0.9} />
      </g>
      <circle cx={540} cy={760} r={26} fill={th.accent} opacity={0.9} />
    </svg>
  );
};

/* ── 8. CHECKS — three drawing checkmarks ───────────────────────── */
const Checks: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pathLen = 240;
  const marks = [
    { x: 540, y: 480, scale: 1.0 },
    { x: 300, y: 820, scale: 0.62 },
    { x: 780, y: 980, scale: 0.5 },
  ];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {marks.map((m, i) => {
        const s = spring({ frame: frame - 8 - i * 22, fps, config: { damping: 15, stiffness: 90 } });
        const draw = interpolate(s, [0, 1], [pathLen, 0]);
        const float = 14 * Math.sin(frame / 16 + i * 2);
        return (
          <g key={i} transform={`translate(${m.x} ${m.y + float}) scale(${m.scale})`} opacity={Math.min(1, s * 1.2)}>
            <circle cx={0} cy={0} r={140} fill="none" stroke={th.accent} strokeWidth={10} opacity={0.22} />
            <path d="M -70 0 L -18 56 L 74 -66" fill="none" stroke={th.accent} strokeWidth={30}
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={pathLen} strokeDashoffset={draw} opacity={0.6} />
          </g>
        );
      })}
    </svg>
  );
};

/* ── 9. ARC — rising sun with rays ──────────────────────────────── */
const Arc: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 60], [260, 0], { extrapolateRight: "clamp" });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(0 ${rise})`}>
        <clipPath id="lowerHalf"><rect x={0} y={1180} width={W} height={H - 1180} /></clipPath>
        <g clipPath="url(#lowerHalf)">
          <circle cx={540} cy={1560} r={330 + 8 * Math.sin(frame / 12)} fill={th.accent} opacity={0.2} />
          <circle cx={540} cy={1560} r={330 + 8 * Math.sin(frame / 12)} fill="none" stroke={th.accent}
            strokeWidth={14} opacity={0.75} />
        </g>
        {Array.from({ length: 9 }, (_, i) => {
          const a = (-95 + i * 24) * (Math.PI / 180);
          const inner = 380, outer = 430 + 26 * Math.sin(frame / 9 + i);
          return (
            <line key={i} x1={540 + Math.sin(a) * inner} y1={1560 - Math.cos(a) * inner}
              x2={540 + Math.sin(a) * outer} y2={1560 - Math.cos(a) * outer}
              stroke={th.accent} strokeWidth={12} opacity={0.3 + 0.2 * Math.sin(frame / 9 + i)} strokeLinecap="round" />
          );
        })}
      </g>
    </svg>
  );
};

/* ── 10. CHAIN — linked circles forming a chain ─────────────────── */
const Chain: React.FC<{ th: Theme }> = ({ th }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const links = Array.from({ length: 7 }, (_, i) => i);
  const y = 1310;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      {links.map((i) => {
        const s = spring({ frame: frame - 3 - i * 9, fps, config: { damping: 13, stiffness: 130 } });
        const x = 90 + i * 150;
        const sway = 5 * Math.sin(frame / 18 - i * 0.7);
        return (
          <g key={i} transform={`translate(${x} ${y + sway}) scale(${Math.max(0.001, s)})`} opacity={Math.min(1, s * 1.3)}>
            <circle cx={0} cy={0} r={74} fill="none" stroke={th.accent} strokeWidth={30} opacity={0.5} />
            <circle cx={0} cy={0} r={74} fill="none" stroke={th.bg} strokeWidth={34}
              strokeDasharray={`${Math.PI * 74 * 0.6} ${Math.PI * 74}`} opacity={0.9}
              transform={`rotate(${frame * 0.6 + i * 40})`} />
          </g>
        );
      })}
    </svg>
  );
};

const VARIANTS: Record<string, React.FC<{ th: Theme }>> = {
  bars: Bars, bolt: Bolt, waves: Waves, rings: Rings, dots: Dots,
  streaks: Streaks, clock: Clock, checks: Checks, arc: Arc, chain: Chain,
};

export const Background: React.FC<{ th: Theme; variant: string }> = ({ th, variant }) => {
  const V = VARIANTS[variant] ?? Bars;
  return <V th={th} />;
};

/** Film grain overlay (static texture). */
export const Grain: React.FC = () => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
    style={{ position: "absolute", inset: 0, opacity: 0.055, pointerEvents: "none" }}>
    <filter id="hypeGrain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" /></filter>
    <rect width={W} height={H} filter="url(#hypeGrain)" />
  </svg>
);

/** Soft vignette + top/bottom edge fades for caption legibility. */
export const Vignette: React.FC<{ th: Theme }> = ({ th }) => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320,
      background: `linear-gradient(180deg, ${th.bg}DD 0%, transparent 100%)` }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 560,
      background: `linear-gradient(0deg, ${th.bg}F2 0%, ${th.bg}55 55%, transparent 100%)` }} />
    <div style={{ position: "absolute", inset: 0,
      background: `radial-gradient(ellipse at 50% 40%, transparent 52%, ${th.bg}B8 100%)` }} />
  </>
);
