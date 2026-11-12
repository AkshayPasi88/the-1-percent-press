// v6 fx — audio-reactive overlay effects drawn as SVG on top of the world:
// shockwave rings, speed lines, rising embers, drifting dust. All seeded.
import React from "react";
import type { ReelSpec } from "../theme";
import { rngFor } from "./rand";

const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

export const Shockwave: React.FC<{ spec: ReelSpec; onset: number }> = ({ spec, onset }) => {
  if (onset <= 0.04) return null;
  const r = (1 - onset) * 640 + 60;
  return (
    <circle cx={540} cy={820} r={r} fill="none" stroke={hexA(spec.theme.accent, onset * 0.5)} strokeWidth={14 * onset + 2} />
  );
};

export const SpeedLines: React.FC<{ spec: ReelSpec; onset: number }> = ({ spec, onset }) => {
  if (onset <= 0.04) return null;
  const n = 12;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const r = rngFor(`sl:${spec.id}:${i}`);
        const a = (i / n) * Math.PI * 2 + r() * 0.4;
        const r1 = 300 + (1 - onset) * 220;
        const r2 = r1 + 260 + r() * 240;
        return (
          <line
            key={i}
            x1={540 + Math.cos(a) * r1}
            y1={820 + Math.sin(a) * r1}
            x2={540 + Math.cos(a) * r2}
            y2={820 + Math.sin(a) * r2}
            stroke={hexA(spec.theme.ink, onset * 0.4)}
            strokeWidth={7}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};

export const Embers: React.FC<{ spec: ReelSpec; sceneId: string; t: number; pulse: number }> = ({
  spec,
  sceneId,
  t,
  pulse,
}) => {
  const n = 26;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const r = rngFor(`emb:${sceneId}:${i}`);
        const x = r() * 1080;
        const speed = 46 + r() * 84;
        const y = 1920 - ((t * speed + r() * 1920) % 2100);
        const wob = Math.sin(t * (0.6 + r()) + i) * 26;
        const o = (0.3 + 0.7 * Math.abs(Math.sin(t * 1.4 + i * 1.7))) * (0.5 + pulse * 0.5);
        return <circle key={i} cx={x + wob} cy={y} r={2.5 + r() * 3} fill={hexA(spec.theme.accent, o * 0.8)} />;
      })}
    </g>
  );
};

export const Dust: React.FC<{ spec: ReelSpec; sceneId: string; t: number; pulse: number }> = ({
  spec,
  sceneId,
  t,
  pulse,
}) => {
  const n = 30;
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => {
        const r = rngFor(`dust:${sceneId}:${i}`);
        const x = (r() * 1200 + Math.sin(t * (0.2 + r() * 0.3) + i) * 60) % 1200 - 60;
        const y = (r() * 2000 + t * (12 + r() * 20)) % 2100 - 80;
        const o = (0.2 + 0.5 * Math.abs(Math.sin(t * 0.8 + i))) * (0.4 + pulse * 0.6);
        return <circle key={i} cx={x} cy={y} r={1.5 + r() * 2.5} fill={hexA(spec.theme.ink, o * 0.5)} />;
      })}
    </g>
  );
};

// Onset pulse applied to the whole world (a light "bass" breathe).
export const WorldPulse: React.FC<{ spec: ReelSpec; pulse: number }> = ({ spec, pulse }) => {
  if (pulse <= 0.01) return null;
  return (
    <rect
      x={0}
      y={0}
      width={1080}
      height={1920}
      fill={hexA(spec.theme.accent, pulse * 0.06)}
    />
  );
};
