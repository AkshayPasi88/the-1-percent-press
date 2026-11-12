// v6 scene transitions — the "flood wipe": a skewed accent panel sweeps the
// frame left-to-right; the world swaps under full occlusion (hard edge,
// slight overshoot). One cinematic grammar across all reels.
import React from "react";
import { easeInOutQuint } from "./easing";
import { clamp01 } from "./rand";

export const TRANSITION_SEC = 0.4; // total window length

export const FloodWipe: React.FC<{
  accent: string;
  accentDeep: string;
  prog: number; // 0..1 across the window
}> = ({ accent, accentDeep, prog }) => {
  const e = easeInOutQuint(clamp01(prog));
  const x = -1250 + e * 2600; // -1250 → +1350 px
  return (
    <>
      {/* echo panel behind */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: x - 120,
          width: 1500,
          height: 2080,
          background: accentDeep,
          opacity: 0.55,
          transform: "skewX(-7deg)",
        }}
      />
      {/* main panel */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: x,
          width: 1500,
          height: 2080,
          background: accent,
          transform: "skewX(-7deg)",
        }}
      />
      {/* leading edge highlight */}
      <div
        style={{
          position: "absolute",
          top: -80,
          left: x + 1450,
          width: 14,
          height: 2080,
          background: "rgba(255,255,255,0.85)",
          transform: "skewX(-7deg)",
        }}
      />
    </>
  );
};
