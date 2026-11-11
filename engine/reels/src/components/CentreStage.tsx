import React from "react";
import {
  Easing, Img, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { Background, Theme } from "./HypeBackgrounds";
import {
  scalePunch, blurDissolve, numberRoll, isKeyWord,
  ParallaxLayer, useAmbientDrift, EASE,
} from "./motion";

/* ── Visual Director data types (written by scripts/visual_director.py) ── */
export interface VWord { text: string; start: number; end: number; }
export interface VStat {
  prefix?: string; to: number; decimals?: number; suffix?: string; label?: string;
}
export interface VScene {
  start: number; end: number; text?: string; words?: VWord[];
  image?: string; palette?: { bg: string; glow: string }; stat?: VStat;
}
export interface Visuals { scenes: VScene[]; beats: number[]; }

/* ── tiny color utils ─────────────────────────────────────────────────── */
export const hexToRgb = (h: string): [number, number, number] => {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
export const hexLerp = (a: string, b: string, x: number): string => {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * Math.min(1, Math.max(0, x))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};
export const luminance = (h: string): number => {
  const [r, g, b] = hexToRgb(h);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

/* ── beat pulse: decaying spikes at each beat marker ──────────────────── */
export const beatPulse = (beats: number[], t: number, decay = 6): number =>
  (beats ?? []).reduce((m, b) => (t >= b ? Math.max(m, Math.exp(-(t - b) * decay)) : m), 0);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ── kinetic main text: words reveal exactly when spoken ──────────────── */
export const KineticText: React.FC<{
  text: string; words: VWord[]; th: Theme; t: number; fps: number;
  big?: boolean; pulse: number; font?: string; fontScale?: number;
}> = ({ text, words, th, t, fps, big, pulse, font, fontScale }) => {
  // map spoken word → display fragment (strip punctuation, uppercase)
  const frags = (words?.length ? words : [{ text, start: -1, end: -1 }])
    .map((w) => ({ ...w, disp: w.text.toUpperCase().replace(/[^A-Z0-9$%'\s×]/g, "") }))
    .filter((w) => w.disp);
  const joined = frags.map((f) => f.disp).join(" ");
  const fontSize = (big
    ? (joined.length > 24 ? 84 : joined.length > 12 ? 110 : 148)
    : (joined.length > 30 ? 48 : joined.length > 18 ? 62 : joined.length > 10 ? 76 : 88)) * (fontScale ?? 1);
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: big ? 960 : 880,
      fontFamily: font ?? '"Playfair Display", serif',
      fontWeight: 900, letterSpacing: big ? -1 : 0, lineHeight: 1.08,
    }}>
      {frags.map((w, i) => {
        const age = w.start < 0 ? 1 : Math.max(0, t - w.start);
        const vis = w.start < 0 || t >= w.start - 0.02;
        const active = w.start >= 0 && t >= w.start - 0.03 && t <= w.end + 0.18;
        // kinetic-typography grammar: key words get expressive scale (150%)
        // + accent color; normal words get a scale-punch arrival
        const key = isKeyWord(w.disp);
        const punch = scalePunch(age, 0.5);
        const pop = key
          ? 1 + (active ? 0.26 + 0.10 * pulse : 0)          // expressive explosion
          : 1 + (active ? 0.05 + 0.05 * pulse : 0);
        return (
          <span key={i} style={{
            fontSize, margin: "0 10px", color: key ? th.accent : active ? th.accentDeep : th.ink,
            opacity: vis ? Math.min(1, punch.opacity * 1.25) : 0,
            display: "inline-block",
            transform: `translateY(${interpolate(Math.min(1, age / 0.5), [0, 1], [14, 0])}px) scale(${pop})`,
            filter: punch.filter,
            textShadow: `0 8px 34px ${th.bg}`,
          }}>
            {w.disp}
          </span>
        );
      })}
    </div>
  );
};

/* ── animated stat counter ────────────────────────────────────────────── */
const StatCounter: React.FC<{
  stat: VStat; th: Theme; t: number; sceneStart: number;
}> = ({ stat, th, t, sceneStart }) => {
  const age = Math.max(0, t - sceneStart);
  const val = stat.to <= 5 ? stat.to : numberRoll(age, stat.to, 1.7);
  const num = stat.decimals ? val.toFixed(stat.decimals) : Math.round(val).toLocaleString("en-US");
  const s = spring({ frame: age * 30, fps: 30, config: { damping: 14, stiffness: 130 } });
  return (
    <div style={{ textAlign: "center", transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})`, opacity: Math.min(1, s * 1.3) }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center" }}>
        {stat.prefix && <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 96, color: th.accent, marginRight: 10 }}>{stat.prefix}</span>}
        <span style={{ fontFamily: '"Source Sans 3", sans-serif', fontWeight: 900, fontSize: 185, lineHeight: 1, color: th.ink, letterSpacing: -3, textShadow: `0 12px 46px ${th.bg}` }}>{num}</span>
        {stat.suffix && <span style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 120, color: th.accent, marginLeft: 8 }}>{stat.suffix}</span>}
      </div>
      {stat.label && (
        <div style={{
          fontSize: 42, fontWeight: 700, color: th.inkSoft, marginTop: 18, textTransform: "uppercase",
          letterSpacing: `${interpolate(Math.min(1, Math.max(0, age / 1.1)), [0, 1], [-0.12, 0.24], { ...EASE })}em`,
          opacity: Math.min(1, Math.max(0, age / 1.1) * 1.6),
        }}>{stat.label}</div>
      )}
    </div>
  );
};

/* ── image card with cinematic entrance + ken-burns + light sweep ─────── */
const ImageCard: React.FC<{
  scene: VScene; th: Theme; t: number; fps: number; pulse: number;
}> = ({ scene, th, t, fps, pulse }) => {
  const dur = scene.end - scene.start;
  const age = t - scene.start;
  const enter = spring({ frame: age * fps, fps, config: { damping: 17, stiffness: 120 } });
  const dissolve = blurDissolve(age, 0.45);
  const kb = 1.06 + 0.12 * clamp01(age / Math.max(0.5, dur));          // ken-burns push
  const scale = kb * (1 + 0.05 * pulse);                               // beat kick
  const sweepX = interpolate(t, [scene.start + 0.12, scene.start + 1.0], [-120, 120], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return (
    <div style={{
      width: 740, height: 540, borderRadius: 26, overflow: "hidden",
      position: "relative", background: th.panel,
      border: `3px solid ${th.accent}`,
      boxShadow: `0 0 ${46 + 46 * pulse}px ${scene.palette?.glow ?? th.accent}${pulse > 0.45 ? "66" : "33"}, 0 34px 90px rgba(0,0,0,0.5)`,
      opacity: Math.min(1, dissolve.opacity * 1.1),
      transform: `translateY(${interpolate(enter, [0, 1], [34, 0])}px) scale(${interpolate(enter, [0, 1], [0.92, 1]) * (1 + 0.03 * pulse)})`,
      filter: dissolve.filter,
    }}>
      <Img src={staticFile(scene.image as string)} style={{
        width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${scale})`,
      }} />
      {/* cinematic light sweep on entrance */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(100deg, transparent 38%, rgba(255,255,255,0.30) 50%, transparent 62%)",
        transform: `translateX(${sweepX}%)`, width: "160%", left: "-30%",
      }} />
    </div>
  );
};

/* ── THE CENTRE STAGE — never empty while the body narration plays ─────── */
const SceneLayer: React.FC<{
  sc: VScene; idx: number; th: Theme; t: number; fps: number; frame: number;
  pulse: number; fadeOutOverride?: number;
}> = ({ sc, idx, th, t, fps, frame, pulse, fadeOutOverride }) => {
  const age = t - sc.start;
  const remain = sc.end - t;
  const enter = spring({ frame: age * fps, fps, config: { damping: 16, stiffness: 130 } });
  const fadeOut = fadeOutOverride ?? clamp01(remain / 0.45);
  const hasImage = !!sc.image;
  const big = !hasImage && !sc.stat;   // kinetic-only scenes get giant type
  const drift = useAmbientDrift(frame);

  return (
    <div style={{
      position: "absolute", top: 300, left: 0, right: 0, height: 1040,
      display: "flex", flexDirection: "column", alignItems: "center",
      opacity: fadeOut * Math.min(1, enter * 1.25),
      transform: `translate3d(${drift.x}px, ${drift.y + interpolate(enter, [0, 1], [34, 0])}px, 0) rotate(${drift.rot}deg)`,
    }}>
      {/* main text / stat row */}
      <div style={{ minHeight: 150, maxHeight: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 30px" }}>
        {sc.stat
          ? <StatCounter stat={sc.stat} th={th} t={t} sceneStart={sc.start} />
          : <KineticText text={sc.text ?? ""} words={sc.words ?? []} th={th} t={t} fps={fps} big={big} pulse={pulse} />}
      </div>

      {/* visual row: image card, or decorative animated motif behind giant text */}
      <div style={{ marginTop: 62, position: "relative", width: 1080, height: 620, display: "flex", justifyContent: "center" }}>
        <ParallaxLayer factor={1.14} style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {hasImage ? (
            <ImageCard scene={sc} th={th} t={t} fps={fps} pulse={pulse} />
          ) : !sc.stat ? (
            <div style={{
              position: "absolute", inset: 0, overflow: "hidden", borderRadius: 30, opacity: 0.3,
              transform: "scale(0.78)",
            }}>
              <Background th={th} variant={idx % 2 === 0 ? "rings" : "dots"} />
            </div>
          ) : (
            <div style={{
              position: "absolute", inset: 0, overflow: "hidden", borderRadius: 30, opacity: 0.26,
              transform: "scale(0.9)",
            }}>
              <Background th={th} variant="arc" />
            </div>
          )}
        </ParallaxLayer>
      </div>
    </div>
  );
};

export const CentreStage: React.FC<{ th: Theme; visuals: Visuals }> = ({ th, visuals }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const scenes = visuals?.scenes ?? [];

  // current scene: latest whose window covers t (with a small pre-roll)
  let idx = -1;
  for (let i = 0; i < scenes.length; i++)
    if (t >= scenes[i].start - 0.06 && t < scenes[i].end + 0.6) idx = i;
  if (idx < 0) return null;

  const pulse = beatPulse(visuals?.beats ?? [], t);

  // outgoing scene crossfade: while the PREVIOUS scene is still within its
  // 0.6 s tail, keep it on screen under the incoming one — the centre never
  // flashes empty at a scene switch (the dissolve-in masks under it).
  const prev = idx > 0 ? scenes[idx - 1] : null;
  const prevTail = prev ? clamp01((prev.end + 0.45 - t) / 0.45) : 0;

  return (
    <>
      {prev && prevTail > 0.02 && (
        <SceneLayer sc={prev} idx={idx - 1} th={th} t={t} fps={fps} frame={frame}
          pulse={pulse} fadeOutOverride={prevTail} />
      )}
      <SceneLayer sc={scenes[idx]} idx={idx} th={th} t={t} fps={fps} frame={frame}
        pulse={pulse} />
    </>
  );
};
