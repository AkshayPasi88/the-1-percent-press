import React from "react";
import {
  AbsoluteFill, Audio, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { FONT_FACES, useBrandFonts } from "../theme";
import { Background, Grain, Vignette, Theme } from "./HypeBackgrounds";
import { CentreStage, Visuals, hexLerp, luminance, beatPulse } from "./CentreStage";
import { ParallaxLayer as BgParallax, trackingReveal as hookTracking } from "./motion";

export interface HypeWord { text: string; start: number; end: number; display: string; }
export interface HypeGroup { start: number; end: number; words: HypeWord[]; }
export interface HypeReelData {
  id: string; file: string; audio: string; name: string;
  theme: Theme; svg: string; hookLines: string[];
  hookEndSec: number; ctaStartSec: number; audioDurationSec: number; speechEndSec: number;
  captions: HypeGroup[];
  bgSeq?: string[]; // background variant rotation: [hook, ...body slots, cta]
}
export interface HypeBrand { handle: string; ebookTitle: string; ebookSub: string; cta: string; }
export interface HypeProps { reel: HypeReelData; brand: HypeBrand; visuals?: Visuals | null; }

/** All available animated background variants. */
const ALL_VARIANTS = ["bars", "chain", "streaks", "bolt", "waves", "checks", "rings", "clock", "dots", "arc"];

/** Crossfade duration between consecutive background variants (seconds). */
const BG_CROSSFADE = 0.6;

/** Find the caption group that should be on screen at time t (seconds). */
const groupAt = (groups: HypeGroup[], t: number): number => {
  let idx = 0;
  for (let i = 0; i < groups.length; i++) if (t + 0.04 >= groups[i].start) idx = i;
  return idx;
};

export const HypeReel: React.FC<HypeProps> = ({ reel, brand, visuals }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const th = reel.theme;
  useBrandFonts();

  /* ── audio ── */
  const audio = <Audio src={staticFile(reel.audio)} volume={1} />;

  /* ── hook overlay (first sentence) ── */
  const hookFade = interpolate(t, [reel.hookEndSec - 0.28, reel.hookEndSec], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  /* ── captions ── */
  const captionsVisible = t < reel.speechEndSec + 0.35;
  const gi = groupAt(reel.captions, t);
  const group = reel.captions[gi];
  const groupAge = t - (reel.captions[gi - 1]?.end ?? 0);
  const groupPop = spring({ frame: groupAge * fps, fps, config: { damping: 18, stiffness: 260 } });

  /* ── rotating background sequence (hook → body slots → CTA) ──
     The reel never sits on one static backdrop: the hook, each body stretch
     and the CTA each get their own animated variant, crossfaded + slow push. */
  const bgSeq: string[] = (() => {
    if (reel.bgSeq?.length) return reel.bgSeq;
    // deterministic fallback rotation (for reels generated without bgSeq)
    const h = [...(reel.id ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0);
    const others = ALL_VARIANTS.filter((v) => v !== reel.svg);
    const bodyN = (reel.audioDurationSec ?? 10) > 20 ? 3 : 1;
    const body = Array.from({ length: bodyN }, (_, i) => others[(h + i * 3) % others.length]);
    return [reel.svg, ...body, others[(h + 7) % others.length]].filter((v, i, a) => a.indexOf(v) === i);
  })();

  const hookB = Math.min(Math.max(0.01, reel.hookEndSec), Math.max(0.02, reel.ctaStartSec - 0.5));
  const bodySpan = Math.max(0, reel.ctaStartSec - hookB);
  const nBody = Math.max(0, bgSeq.length - 2);
  const bounds = [0, hookB];
  for (let i = 1; i <= nBody; i++) bounds.push(hookB + (bodySpan * i) / nBody);

  let segIdx = 0;
  for (let i = 0; i < bounds.length; i++) if (t + 0.001 >= bounds[i]) segIdx = i;
  const segStart = bounds[segIdx];
  const segEnd = bounds[segIdx + 1] ?? Infinity;
  const segLen = Number.isFinite(segEnd) ? segEnd - segStart : Math.max(1, durationInFrames / fps - segStart);
  const curVariant = bgSeq[Math.min(segIdx, bgSeq.length - 1)];
  const nextVariant = bgSeq[segIdx + 1];

  // incoming layer fades in just before the switch
  const inOp = nextVariant && Number.isFinite(segEnd)
    ? interpolate(t, [segEnd - BG_CROSSFADE, segEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  // slow ken-burns push inside each segment (resets are masked by the crossfade)
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const drift = 1 + 0.045 * clamp01((t - segStart) / Math.max(0.5, segLen));
  const inDrift = 1 + 0.045 * clamp01((t - (segEnd - BG_CROSSFADE)) / Math.max(0.5, segLen));

  // CTA dimming so the ebook card pops over whatever variant is showing
  const bgDim = t >= reel.ctaStartSec
    ? interpolate(t, [reel.ctaStartSec, reel.ctaStartSec + 0.45], [1, 0.22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  /* ── context-aware background colour morph + ambient glow ──
     The backdrop tint follows the narration: each scene carries a palette
     for its subject; transitions are smoothed over 0.7 s. */
  const LIGHT = luminance(th.bg) > 0.5;
  const sceneTint = (pal?: { bg: string }) =>
    pal ? hexLerp(th.bg, pal.bg, LIGHT ? 0.45 : 0.8) : th.bg;
  const vscenes = visuals?.scenes ?? [];
  let sceneIdx = -1;
  for (let i = 0; i < vscenes.length; i++) if (t >= vscenes[i].start) sceneIdx = i;
  const morphBg = (() => {
    if (sceneIdx < 0) return th.bg;
    const cur = sceneTint(vscenes[sceneIdx].palette);
    const prev = sceneIdx > 0 ? sceneTint(vscenes[sceneIdx - 1].palette) : th.bg;
    const x = clamp01((t - vscenes[sceneIdx].start) / 0.7);
    const sx = x * x * (3 - 2 * x); // smoothstep
    return hexLerp(prev, cur, sx);
  })();
  const pulse = beatPulse(visuals?.beats ?? [], t);
  const glowCol = sceneIdx >= 0 ? (vscenes[sceneIdx].palette?.glow ?? th.accent) : th.accent;
  const glowOp = (sceneIdx >= 0 ? 0.16 : 0.08) + 0.14 * pulse;

  /* ── CTA book card ── */
  const ctaT = Math.max(0, t - reel.ctaStartSec);
  const ctaS = spring({ frame: ctaT * fps, fps, config: { damping: 15, stiffness: 120 } });
  const ctaGlow = 0.5 + 0.5 * Math.sin(t * 3.2);

  /* ── progress bar ── */
  const progress = (frame / Math.max(1, durationInFrames - 1)) * 100;

  return (
    <>
      <style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: morphBg, fontFamily: '"Source Sans 3", sans-serif', color: th.ink }}>
        {audio}
        <div style={{ position: "absolute", inset: 0, opacity: bgDim * 0.5, overflow: "hidden" }}>
          <BgParallax factor={0.85} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, transform: `scale(${drift})` }}>
              <Background th={th} variant={curVariant} />
            </div>
            {inOp > 0.001 && nextVariant && (
              <div style={{ position: "absolute", inset: 0, opacity: inOp, transform: `scale(${inDrift})` }}>
                <Background th={th} variant={nextVariant} />
              </div>
            )}
          </BgParallax>
        </div>
        {/* ambient environment glow — colour follows the current scene */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 62% 38% at 50% 34%, ${glowCol} 0%, transparent 70%)`,
          opacity: glowOp, filter: "blur(2px)",
        }} />
        <Vignette th={th} />

        {/* centre stage — images / kinetic main text / counters (never empty) */}
        <CentreStage th={th} visuals={visuals ?? { scenes: [], beats: [] }} />

        {/* handle chip */}
        <div style={{ position: "absolute", top: 148, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{
            background: `${th.panel}CC`, border: `1.5px solid ${th.accent}55`, borderRadius: 999,
            padding: "14px 38px", fontSize: 27, fontWeight: 700, letterSpacing: 4, color: th.inkSoft,
          }}>{brand.handle}</div>
        </div>

        {/* HOOK overlay */}
        {t < reel.hookEndSec && (
          <div style={{
            position: "absolute", top: 460, left: 90, right: 90, opacity: hookFade,
            display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          }}>
            {/* scrim so the headline always pops over the animated SVG */}
            <div style={{
              position: "absolute", top: -70, left: -60, right: -60, bottom: -90,
              background: `radial-gradient(ellipse at 50% 50%, ${th.bg}F0 38%, ${th.bg}B3 62%, transparent 78%)`,
            }} />
            {reel.hookLines.map((line, li) => {
              const s = spring({ frame: frame - 4 - li * 9, fps, config: { damping: 14, stiffness: 150 } });
              // tagline-style tracking reveal: letters start tight, open up
              const lineAge = Math.max(0, (frame - 4 - li * 9) / fps);
              const tr = hookTracking(lineAge, -0.012, 0.8);
              return (
                <div key={li} style={{
                  fontFamily: '"Playfair Display", serif', fontWeight: 900,
                  fontSize: line.length > 16 ? 96 : 122, lineHeight: 1.06, color: th.ink,
                  letterSpacing: `${tr.letterSpacing}em`, margin: "4px 0",
                  opacity: Math.min(1, s * 1.3) * (tr.opacity ?? 1),
                  filter: tr.filter,
                  transform: `translateY(${interpolate(s, [0, 1], [52, 0])}px)`,
                  textShadow: `0 10px 44px ${th.bg}`,
                }}>
                  {/\d/.test(line) ? line.split(/(\s+)/).map((part, pi) =>
                    /^[0-9×=%]/.test(part) ? <span key={pi} style={{ color: th.accent }}>{part}</span> : part
                  ) : line}
                </div>
              );
            })}
            <div style={{
              marginTop: 40, height: 6, borderRadius: 3, background: th.accent,
              width: interpolate(frame, [8, 46], [0, 210], { extrapolateRight: "clamp" }),
            }} />
          </div>
        )}

        {/* CTA — ebook cover card */}
        {t >= reel.ctaStartSec && (
          <div style={{
            position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center",
            opacity: Math.min(1, ctaS * 1.35),
            transform: `scale(${interpolate(ctaS, [0, 1], [0.9, 1])})`,
          }}>
            <div style={{
              width: 600, padding: "74px 56px", borderRadius: 18, textAlign: "center",
              background: `${th.panel}F2`, border: `3px solid ${th.accent}`,
              boxShadow: `0 0 ${40 + 50 * ctaGlow}px ${th.accent}${ctaGlow > 0.5 ? "66" : "33"}, 0 40px 90px rgba(0,0,0,0.45)`,
            }}>
              <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: 9, color: th.accentDeep, marginBottom: 34 }}>
                FREE EBOOK
              </div>
              <div style={{
                fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 92,
                lineHeight: 1.05, color: th.ink, letterSpacing: -1,
              }}>
                {brand.ebookTitle.split(" ").map((w, i) => (
                  <div key={i} style={/\d/.test(w) ? { color: th.accent } : undefined}>{w}</div>
                ))}
              </div>
              <div style={{ height: 3, width: 130, background: th.accent, margin: "34px auto" }} />
              <div style={{ fontSize: 30, color: th.inkSoft, lineHeight: 1.4 }}>{brand.ebookSub}</div>
              <div style={{
                marginTop: 44, background: `${th.accent}22`, border: `1.5px solid ${th.accent}`,
                borderRadius: 999, padding: "16px 40px", fontSize: 26, fontWeight: 700,
                letterSpacing: 4, color: th.accentDeep, display: "inline-block",
              }}>
                GET IT FREE ↓
              </div>
            </div>
          </div>
        )}

        {/* transcript strip — slim; the kinetic main text above is the star */}
        {captionsVisible && group && (
          <div style={{
            position: "absolute", top: 1470, left: 0, right: 0, display: "flex", justifyContent: "center",
            opacity: 0.92 * interpolate(t, [0, 0.12], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            <div key={gi} style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 980,
              background: `${th.panel}D9`, border: `1.5px solid ${th.accent}33`, borderRadius: 20,
              padding: "16px 34px",
              transform: `translateY(${interpolate(groupPop, [0, 1], [14, 0])}px)`,
            }}>
              {group.words.map((w, wi) => {
                const active = t >= w.start - 0.03 && t <= w.end + 0.1;
                const said = t > w.end + 0.1;
                const age = Math.max(0, t - w.start);
                const pop = active ? interpolate(age, [0, 0.1], [1.13, 1], { extrapolateRight: "clamp" }) : 1;
                return (
                  <span key={wi} style={{
                    fontSize: 42, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.22,
                    margin: "0 7px", display: "inline-block",
                    color: active ? th.accent : th.inkSoft,
                    opacity: said || active ? 1 : 0.66,
                    transform: `scale(${pop})`,
                    transition: "none",
                  }}>
                    {(w.display ?? w.text).toUpperCase()}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* progress bar */}
        <div style={{
          position: "absolute", bottom: 64, left: 90, right: 90, height: 8, borderRadius: 4,
          background: `${th.ink}1A`,
        }}>
          <div style={{
            height: "100%", borderRadius: 4, background: th.accent, width: `${progress}%`,
            boxShadow: `0 0 18px ${th.accent}88`,
          }} />
        </div>

        <Grain />
      </AbsoluteFill>
    </>
  );
};
