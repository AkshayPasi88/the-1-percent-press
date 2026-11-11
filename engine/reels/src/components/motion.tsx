import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

/* ══════════════════════════════════════════════════════════════════
   Motion primitives — ported from dxny-aep/remotion-skills primitives,
   the hermes kinetic-typography grammar and the 12-principles adaptation
   (karanmrn). These make every layer feel hand-operated, not slideshow.
   ══════════════════════════════════════════════════════════════════ */

/* ── Easing curves (broadcast-quality defaults) ────────────────────── */
export const CUBIC = Easing.bezier(0.57, 0.01, 0, 0.99);        // long tail
export const OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);        // snappy out
export const IN_OUT_CUBIC = Easing.bezier(0.65, 0, 0.35, 1);   // camera moves
export const OUT_QUINT = Easing.bezier(0.22, 1, 0.36, 1);       // drifts
export const EASE = {
  easing: CUBIC,
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/* ── Ambient drift — Lissajous micro-movement ────────────────────────
   Non-harmonic sine frequencies: the motion never exactly repeats, so it
   reads as "alive" and kills the AI-slideshow feel. ±2-4 px, ±0.1°.   */
export const useAmbientDrift = (frame: number) => {
  const x = Math.sin(frame * 0.023) * 2.1 + Math.cos(frame * 0.041) * 1.3 + Math.sin(frame * 0.013) * 0.7;
  const y = Math.cos(frame * 0.029) * 2.4 + Math.sin(frame * 0.047) * 1.1 + Math.cos(frame * 0.011) * 0.6;
  const rot = Math.sin(frame * 0.017) * 0.09 + Math.cos(frame * 0.033) * 0.05;
  return { x, y, rot };
};

/* ── ParallaxLayer — depth without 3D math ───────────────────────────
   factor < 1 recedes (background), > 1 advances (foreground).
   Layout-agnostic: it only translates, whatever the caller's display is. */
export const ParallaxLayer: React.FC<{
  factor?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ factor = 1, children, style }) => {
  const frame = useCurrentFrame();
  const d = useAmbientDrift(frame);
  const f = factor - 1;
  return (
    <div style={{
      transform: `translate3d(${d.x * f}px, ${d.y * f}px, 0)`,
      willChange: "transform", ...style,
    }}>
      {children}
    </div>
  );
};

/* ── Entrance helpers ──────────────────────────────────────────────── */

/** ScalePunch: quick scale+blur arrival for headline words. */
export const scalePunch = (age: number, dur = 0.6) => {
  const t = Math.min(1, Math.max(0, age / dur));
  const scale = interpolate(t, [0, 1], [1.08, 1], { easing: OUT_EXPO, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const blur = interpolate(t, [0, 0.5], [3.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(t, [0, 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity, transform: `scale(${scale})`, filter: blur > 0.15 ? `blur(${blur}px)` : undefined };
};

/** BlurDissolve: soft blur → focus + rise. For feature words & cards. */
export const blurDissolve = (age: number, dur = 0.6) => {
  const t = Math.min(1, Math.max(0, age / dur));
  const blur = interpolate(t, [0, 1], [14, 0], { ...EASE });
  const y = interpolate(t, [0, 1], [12, 0], { ...EASE });
  const opacity = interpolate(t, [0, 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity, transform: `translateY(${y}px)`, filter: blur > 0.15 ? `blur(${blur}px)` : undefined };
};

/** TrackingReveal: letter-spacing opens tight → natural + blur. Taglines. */
export const trackingReveal = (age: number, naturalEm = -0.01, dur = 0.9) => {
  const t = Math.min(1, Math.max(0, age / dur));
  const tracking = interpolate(t, [0, 1], [-0.14, naturalEm], { ...EASE });
  const blur = interpolate(t, [0, 0.6], [6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(t, [0, 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return {
    opacity,
    letterSpacing: `${tracking}em`,
    filter: blur > 0.15 ? `blur(${blur}px)` : undefined,
  };
};

/** NumberRoll: count-up with CUBIC long-tail easing (credibility). */
export const numberRoll = (age: number, to: number, dur = 1.7) => {
  const t = Math.min(1, Math.max(0, age / dur));
  return interpolate(t, [0, 1], [0, to], {
    easing: Easing.out(Easing.exp),
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
};

/** Is this word an "explosive" key word? (numbers, power words) */
export const isKeyWord = (w: string): boolean =>
  /\d/.test(w) || /^(day|never|every|stop|free|luck|math|one|twice|chain|bend|und)$|^%.+$/i.test(w);
