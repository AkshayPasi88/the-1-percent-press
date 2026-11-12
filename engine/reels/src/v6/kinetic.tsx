// v6 kinetic typography — hook slam, karaoke captions, animated counters,
// brand tag. All spring/closed-form: pure functions of frame.
import React from "react";
import type { ReelSpec, SceneSpec, CounterSpec, NarrationSentence } from "../theme";
import { springPunch, easeOutCubic } from "./easing";
import { clamp01 } from "./rand";

const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// ------------------------------------------------------------------ hook
export const HookType: React.FC<{
  spec: ReelSpec;
  t: number; // scene-local seconds
  onset: number;
}> = ({ spec, t, onset }) => {
  const th = spec.theme;
  return (
    <div
      style={{
        position: "absolute",
        top: 190,
        left: 60,
        right: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        transform: `scale(${1 + onset * 0.02})`,
      }}
    >
      {spec.hookLines.map((line, li) => (
        <div
          key={li}
          style={{
            fontFamily: "Anton",
            fontSize: line.length > 14 ? 96 : 128,
            lineHeight: 1.04,
            color: th.ink,
            textTransform: "uppercase",
            textAlign: "center",
            letterSpacing: 2,
            textShadow: `5px 4px 0 ${hexA(th.accent, 0.85)}`,
          }}
        >
          {line.split("").map((ch, ci) => {
            const at = t - li * 0.14 - ci * 0.035;
            const s = springPunch(13, 0.5)(clamp01(at / 0.5));
            if (s <= 0.001) return <span key={ci} style={{ opacity: 0 }}>{ch}</span>;
            return (
              <span
                key={ci}
                style={{
                  display: "inline-block",
                  opacity: clamp01(s * 1.4),
                  transform: `scale(${0.6 + s * 0.4}) translateY(${(1 - s) * 26}px)`,
                }}
              >
                {ch === " " ? "\u00A0" : ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------ captions
export const Captions: React.FC<{
  sentence: NarrationSentence;
  spec: ReelSpec;
  time: number; // reel-absolute seconds
  t: number; // scene-local seconds
}> = ({ sentence, spec, time, t }) => {
  const th = spec.theme;
  const appear = springPunch(11, 0.55)(clamp01(t / 0.35));
  return (
    <div
      style={{
        position: "absolute",
        bottom: 172,
        left: 80,
        right: 80,
        display: "flex",
        justifyContent: "center",
        opacity: appear,
        transform: `translateY(${(1 - appear) * 30}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 860,
          background: "rgba(8,8,10,0.62)",
          border: `2px solid ${hexA(th.accent, 0.35)}`,
          borderRadius: 26,
          padding: "22px 34px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0 14px",
        }}
      >
        {sentence.words.map((wd, i) => {
          const spoken = time >= wd.start - 0.02;
          const active = time >= wd.start - 0.02 && time < wd.end + 0.06;
          return (
            <span
              key={i}
              style={{
                fontFamily: '"Source Sans 3"',
                fontWeight: 700,
                fontSize: 47,
                lineHeight: 1.25,
                color: active ? "#FFFFFF" : spoken ? th.accent : hexA(th.ink, 0.62),
                display: "inline-block",
                transform: `scale(${active ? 1.1 : 1})`,
                transition: "none",
              }}
            >
              {wd.w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ counter
export const Counter: React.FC<{
  counter: CounterSpec;
  spec: ReelSpec;
  t: number;
  p: number;
  onset: number;
}> = ({ counter, spec, t, p, onset }) => {
  const th = spec.theme;
  const appear = springPunch(10, 0.55)(clamp01(t / 0.5));
  const dec = counter.decimals ?? 0;
  const grow = easeOutCubic(clamp01((p - 0.08) / 0.62));
  const val = counter.from + (counter.to - counter.from) * grow;
  const shown = `${counter.prefix ?? ""}${val.toFixed(dec)}${counter.suffix ?? ""}`;
  return (
    <div
      style={{
        position: "absolute",
        top: 240,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: appear,
        transform: `scale(${appear * (1 + onset * 0.03)})`,
      }}
    >
      <div
        style={{
          fontFamily: '"Source Sans 3"',
          fontWeight: 600,
          fontSize: 44,
          letterSpacing: 10,
          color: th.inkSoft,
          textTransform: "uppercase",
          background: "rgba(8,8,10,0.45)",
          borderRadius: 999,
          padding: "8px 30px",
        }}
      >
        {counter.label}
      </div>
      <div
        style={{
          fontFamily: "Anton",
          fontSize: 200,
          letterSpacing: 4,
          color: th.ink,
          marginTop: 10,
        }}
      >
        {shown}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ brand
export const BrandTag: React.FC<{ spec: ReelSpec }> = ({ spec }) => (
  <div
    style={{
      position: "absolute",
      top: 92,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
    }}
  >
    <div
      style={{
        fontFamily: '"Source Sans 3"',
        fontWeight: 600,
        fontSize: 34,
        letterSpacing: 4,
        color: spec.theme.inkSoft,
        background: "rgba(8,8,10,0.4)",
        borderRadius: 999,
        padding: "10px 28px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ width: 12, height: 12, borderRadius: 6, background: spec.theme.accent, display: "inline-block" }} />
      {spec.brand.handle.toUpperCase()}
    </div>
  </div>
);
