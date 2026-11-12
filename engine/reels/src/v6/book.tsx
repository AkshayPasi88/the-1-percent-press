// v6 CTA scene — the animated ebook object. A floating 3D-ish book with
// cover, spine, fanned pages; confetti; "LINK IN BIO" pulse. Fully programmatic.
import React from "react";
import type { ReelSpec } from "../theme";
import { springPunch, easeOutCubic } from "./easing";
import { clamp01 } from "./rand";
import { rngFor } from "./rand";

const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const CONFETTI_N = 44;

export const CTAScene: React.FC<{
  spec: ReelSpec;
  t: number; // CTA-scene-local seconds
  pulse: number;
}> = ({ spec, t, pulse }) => {
  const th = spec.theme;
  const enter = springPunch(9, 0.55)(clamp01(t / 0.7));
  const confetti = Array.from({ length: CONFETTI_N }).map((_, i) => {
    const r = rngFor(`cta:${spec.id}:${i}`);
    const x = r() * 1080;
    const speed = 130 + r() * 200;
    const y = (r() * 2200 + t * speed) % 2200 - 150;
    const rot = (t * (60 + r() * 160) + r() * 360) % 360;
    const cols = [th.accent, th.accentDeep, th.ink, th.inkSoft];
    return {
      x,
      y,
      rot,
      col: cols[i % 4],
      w: 12 + r() * 14,
      h: 18 + r() * 16,
      o: 0.5 + r() * 0.5,
    };
  });
  const bob = Math.sin(t * 0.9 * Math.PI * 2);
  return (
    <>
      {/* backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% 44%, ${hexA(th.accent, 0.22 + pulse * 0.1)} 0%, ${hexA(th.accent, 0.05)} 38%, ${th.bg} 68%)`,
        }}
      />
      {/* confetti */}
      {confetti.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: c.x,
            top: c.y,
            width: c.w,
            height: c.h,
            background: c.col,
            opacity: c.o * clamp01(t / 0.5),
            transform: `rotate(${c.rot}deg)`,
          }}
        />
      ))}
      {/* the book */}
      <div
        style={{
          position: "absolute",
          top: 500,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            transform: `perspective(1500px) rotateY(${12 * Math.sin(t * 0.7 * Math.PI * 2) * 0.6}) rotateX(6deg) translateY(${bob * 14}px) scale(${0.7 + enter * 0.3})`,
            opacity: clamp01(enter * 1.3),
          }}
        >
          {/* glow */}
          <div
            style={{
              position: "absolute",
              left: -120,
              top: -80,
              width: 700,
              height: 800,
              background: `radial-gradient(circle, ${hexA(th.accent, 0.35 + pulse * 0.15)} 0%, ${hexA(th.accent, 0)} 60%)`,
            }}
          />
          {/* page edges (right) */}
          <div
            style={{
              position: "absolute",
              left: 440,
              top: 10,
              width: 54,
              height: 636,
              borderRadius: "0 10px 10px 0",
              background:
                "repeating-linear-gradient(to left, #F7F4EC 0 5px, #D9D3C5 5px 8px)",
            }}
          />
          {/* spine */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 2,
              width: 44,
              height: 640,
              background: `linear-gradient(90deg, ${hexA("#000000", 0.35)}, ${hexA("#000000", 0.12)})`,
              borderRadius: "6px 0 0 6px",
            }}
          />
          {/* cover */}
          <div
            style={{
              width: 460,
              height: 640,
              borderRadius: "4px 16px 16px 4px",
              background: `linear-gradient(140deg, ${th.panel} 0%, ${th.bg} 130%)`,
              border: `3px solid ${th.accent}`,
              boxShadow: `0 40px 90px ${hexA("#000000", 0.5)}, inset 0 0 0 10px ${hexA(th.accent, 0.12)}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 74,
              boxSizing: "border-box",
              position: "relative",
            }}
          >
            <div style={{ width: 90, height: 6, background: th.accent, marginBottom: 34 }} />
            <div
              style={{
                fontFamily: '"Playfair Display"',
                fontWeight: 900,
                fontSize: 74,
                lineHeight: 1.05,
                color: th.ink,
                textAlign: "center",
              }}
            >
              THE
              <br />
              1% METHOD
            </div>
            <div
              style={{
                marginTop: 26,
                width: 60,
                height: 2,
                background: hexA(th.accentDeep, 0.8),
              }}
            />
            <div
              style={{
                marginTop: 24,
                fontFamily: '"Source Sans 3"',
                fontWeight: 400,
                fontStyle: "italic",
                fontSize: 26,
                color: th.inkSoft,
                textAlign: "center",
                maxWidth: 300,
                lineHeight: 1.3,
              }}
            >
              {spec.brand.ebookSub}
            </div>
            <div
              style={{
                marginTop: 46,
                fontFamily: '"Archivo Black"',
                fontSize: 30,
                letterSpacing: 3,
                color: th.bg,
                background: th.accent,
                borderRadius: 8,
                padding: "10px 26px",
              }}
            >
              FREE
            </div>
            {/* corner ornaments */}
            <div style={{ position: "absolute", left: 22, top: 22, width: 30, height: 30, borderLeft: `3px solid ${th.accent}`, borderTop: `3px solid ${th.accent}` }} />
            <div style={{ position: "absolute", right: 22, bottom: 22, width: 30, height: 30, borderRight: `3px solid ${th.accent}`, borderBottom: `3px solid ${th.accent}` }} />
          </div>
        </div>
      </div>
      {/* CTA text block */}
      <div
        style={{
          position: "absolute",
          bottom: 250,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
          opacity: clamp01(easeOutCubic(clamp01((t - 0.35) / 0.5))),
          transform: `translateY(${clamp01((t - 0.35) / 0.5) * -1 * 0 + (1 - clamp01((t - 0.35) / 0.5)) * 40}px)`,
        }}
      >
        <div
          style={{
            fontFamily: '"Archivo Black"',
            fontSize: 58,
            color: th.ink,
            letterSpacing: 2,
            textShadow: `4px 3px 0 ${hexA(th.accent, 0.8)}`,
            textAlign: "center",
          }}
        >
          {spec.brand.cta}
        </div>
        <div
          style={{
            fontFamily: '"Archivo Black"',
            fontSize: 42,
            color: th.bg,
            background: th.accent,
            padding: "12px 34px",
            borderRadius: 14,
            letterSpacing: 4,
            transform: `scale(${1 + 0.05 * Math.sin(t * 2.4 * Math.PI * 2)})`,
          }}
        >
          LINK IN BIO ↓
        </div>
        <div
          style={{
            fontFamily: '"Source Sans 3"',
            fontWeight: 600,
            fontSize: 38,
            color: th.inkSoft,
            letterSpacing: 3,
          }}
        >
          {spec.brand.handle.toUpperCase()}
        </div>
      </div>
    </>
  );
};
