import React from "react";
import {
  AbsoluteFill, Audio, Img, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { FONT_FACES, useBrandFonts } from "../theme";
import { Grain, Vignette, Theme } from "./HypeBackgrounds";
import { Visuals, VScene, beatPulse } from "./CentreStage";
import { scalePunch, isKeyWord, EASE } from "./motion";
import { HypeReelData, HypeBrand } from "./HypeReel";

export interface CinematicProps { reel: HypeReelData; brand: HypeBrand; visuals?: Visuals | null; }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* ── section headline: the script's timed block as ONE giant Anton line.
     Enters whole (staggered word punch, ~40 ms apart), holds for the
     section, accent on key words, breathes with the beat. ── */
const Headline: React.FC<{
  sc: VScene; th: Theme; t: number; fps: number; pulse: number;
}> = ({ sc, th, t, fps, pulse }) => {
  const words = (sc.text ?? "").toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const age = Math.max(0, t - sc.start);
  const remain = sc.end - t;
  const outOp = clamp01(remain / 0.45);
  const enter = spring({ frame: age * fps, fps, config: { damping: 17, stiffness: 130 } });
  const joined = words.join(" ");
  const fontSize = joined.length > 28 ? 96 : joined.length > 18 ? 112 : joined.length > 10 ? 128 : 148;
  const tr = interpolate(Math.min(1, age / 0.9), [0, 1], [0.045, 0.008], { ...EASE });
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 940,
      fontFamily: '"Anton", sans-serif', fontWeight: 400, lineHeight: 1.1,
      letterSpacing: `${tr}em`,
      opacity: outOp * clamp01(enter * 1.4),
      transform: `translateY(${interpolate(enter, [0, 1], [30, 0])}px) scale(${1 + 0.012 * pulse})`,
      textShadow: `0 10px 40px ${th.bg}, 0 2px 10px ${th.bg}`,
    }}>
      {words.map((w, i) => {
        const key = isKeyWord(w);
        const wa = Math.max(0, age - i * 0.045);
        const punch = scalePunch(wa, 0.42);
        return (
          <span key={i} style={{
            fontSize, margin: "0 14px", display: "inline-block",
            color: key ? th.accent : th.ink,
            opacity: clamp01(punch.opacity * 1.3),
            transform: punch.transform,
            filter: punch.filter,
          }}>{w}</span>
        );
      })}
    </div>
  );
};

/* ── one full-bleed footage layer: ken-burns push + directional drift ──── */
const FootageLayer: React.FC<{
  sc: VScene; idx: number; th: Theme; t: number; opacity: number; pulse: number;
}> = ({ sc, idx, th, t, opacity, pulse }) => {
  if (!sc.image) return null;
  const dur = Math.max(0.8, sc.end - sc.start);
  const age = t - sc.start;
  const prog = clamp01(age / dur);
  // ken-burns: slow continuous zoom + lateral pan (alternating direction)
  const zoom = 1.08 + 0.13 * prog;
  const panX = (idx % 2 === 0 ? -1 : 1) * interpolate(prog, [0, 1], [0, 34]);
  const scale = zoom * (1 + 0.022 * pulse); // beat kick
  // cinematic grade: slight desaturation + contrast so text always pops
  return (
    <AbsoluteFill style={{ opacity }}>
      <Img src={staticFile(sc.image)} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${scale}) translateX(${panX}px)`,
        filter: `saturate(${0.85 - 0.1 * pulse}) contrast(1.06) brightness(1.02)`,
      }} />
    </AbsoluteFill>
  );
};

export const CinematicReel: React.FC<CinematicProps> = ({ reel, brand, visuals }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const th = reel.theme;
  useBrandFonts();

  const audio = <Audio src={staticFile(reel.audio)} volume={1} />;
  const scenes = visuals?.scenes ?? [];
  const beats = visuals?.beats ?? [];
  const pulse = beatPulse(beats, t, 5);

  /* ── footage stack: every scene renders as a full-bleed layer with
        0.7 s crossfades — the video reads as one continuous shot list,
        never a static backdrop with cards popping in front of it. ── */
  const layers = scenes
    .map((sc, idx) => {
      const fadeIn = interpolate(t, [sc.start - 0.35, sc.start + 0.35], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });
      const fadeOut = interpolate(t, [sc.end - 0.35, sc.end + 0.35], [1, 0], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      });
      return { sc, idx, op: clamp01(fadeIn * fadeOut) };
    })
    .filter((l) => l.op > 0.004 && l.sc.image);

  /* ── narration text: the script's timed section as one giant headline —
        classic motivational cut: line lands when the section starts ── */
  let textIdx = -1;
  for (let i = 0; i < scenes.length; i++)
    if (t >= scenes[i].start - 0.06 && t < scenes[i].end + 0.35) textIdx = i;
  const textScene = textIdx >= 0 ? scenes[textIdx] : null;

  /* ── CTA — the ending points straight at the ebook ── */
  const ctaT = Math.max(0, t - reel.ctaStartSec);
  const ctaS = spring({ frame: ctaT * fps, fps, config: { damping: 15, stiffness: 110 } });
  const ctaGlow = 0.5 + 0.5 * Math.sin(t * 3.4);
  const arrowBounce = Math.abs(Math.sin(ctaT * 4.6)); // tapping arrow ↓
  const inCta = t >= reel.ctaStartSec;

  const progress = (frame / Math.max(1, durationInFrames - 1)) * 100;
  const bgDim = inCta
    ? interpolate(t, [reel.ctaStartSec, reel.ctaStartSec + 0.5], [1, 0.28], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  return (
    <>
      <style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: th.bg, fontFamily: '"Source Sans 3", sans-serif', color: th.ink }}>
        {audio}

        {/* ── full-bleed footage layers (crossfaded) ── */}
        <AbsoluteFill style={{ opacity: bgDim }}>
          {layers.map(({ sc, idx, op }) => (
            <FootageLayer key={idx} sc={sc} idx={idx} th={th} t={t} opacity={op} pulse={pulse} />
          ))}
          {/* base wash so the very first frames are never raw white/black */}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${th.bg}E6 0%, ${th.bg}40 34%, ${th.bg}26 52%, ${th.bg}CC 100%)` }} />
        </AbsoluteFill>

        {/* cinematic grade: scrims, vignette, grain — one consistent mood */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${th.bg}D9 0%, transparent 22%, transparent 46%, ${th.bg}F0 78%, ${th.bg} 100%)` }} />
        <Vignette th={th} />
        <Grain />

        {/* ── section headline — one giant line per script block ── */}
        {textScene && !inCta && (
          <div style={{
            position: "absolute", top: 1010, left: 60, right: 60,
            display: "flex", justifyContent: "center",
          }}>
            <Headline sc={textScene} th={th} t={t} fps={fps} pulse={pulse} />
          </div>
        )}

        {/* handle chip */}
        <div style={{ position: "absolute", top: 148, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{
            background: "#000000A8", border: `1.5px solid ${th.ink}44`, borderRadius: 999,
            padding: "13px 36px", fontSize: 26, fontWeight: 700, letterSpacing: 4, color: th.inkSoft,
          }}>{brand.handle}</div>
        </div>

        {/* ── CTA — POINT TO THE EBOOK ── */}
        {inCta && (
          <div style={{
            position: "absolute", top: 430, left: 0, right: 0,
            display: "flex", flexDirection: "column", alignItems: "center",
            opacity: Math.min(1, ctaS * 1.35),
            transform: `scale(${interpolate(ctaS, [0, 1], [0.92, 1])})`,
          }}>
            <div style={{
              width: 620, padding: "70px 56px", borderRadius: 18, textAlign: "center",
              background: "#050508F5", border: `3px solid ${th.accent}`,
              boxShadow: `0 0 ${44 + 52 * ctaGlow}px ${th.accent}${ctaGlow > 0.5 ? "77" : "44"}, 0 44px 100px rgba(0,0,0,0.6)`,
            }}>
              <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: 9, color: th.accent, marginBottom: 32 }}>
                FREE EBOOK
              </div>
              <div style={{
                fontFamily: '"Anton", sans-serif', fontWeight: 400, fontSize: 96,
                lineHeight: 1.05, color: th.ink, letterSpacing: 0,
              }}>
                {brand.ebookTitle.split(" ").map((w, i) => (
                  <div key={i} style={/\d/.test(w) ? { color: th.accent } : undefined}>{w}</div>
                ))}
              </div>
              <div style={{ height: 3, width: 130, background: th.accent, margin: "32px auto" }} />
              <div style={{ fontSize: 29, color: th.inkSoft, lineHeight: 1.4 }}>{brand.ebookSub}</div>
            </div>

            {/* tapping arrow pointing at the bio link */}
            <div style={{
              marginTop: 42, display: "flex", flexDirection: "column", alignItems: "center",
              transform: `translateY(${interpolate(arrowBounce, [0, 1], [0, 14])}px)`,
            }}>
              <svg width="84" height="64" viewBox="0 0 84 64" style={{ filter: `drop-shadow(0 0 16px ${th.accent}AA)` }}>
                <path d="M42 4 L42 40 M28 28 L42 44 L56 28" stroke={th.accent} strokeWidth="9"
                      strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <div style={{
                marginTop: 16, background: `${th.accent}1F`, border: `2px solid ${th.accent}`,
                borderRadius: 999, padding: "16px 44px", fontSize: 28, fontWeight: 800,
                letterSpacing: 5, color: th.ink,
                boxShadow: `0 0 ${20 + 26 * ctaGlow}px ${th.accent}55`,
              }}>
                LINK IN BIO
              </div>
            </div>
          </div>
        )}

        {/* progress bar */}
        <div style={{
          position: "absolute", bottom: 64, left: 90, right: 90, height: 8, borderRadius: 4,
          background: "#FFFFFF14",
        }}>
          <div style={{
            height: "100%", borderRadius: 4, background: th.accent, width: `${progress}%`,
            boxShadow: `0 0 18px ${th.accent}88`,
          }} />
        </div>
      </AbsoluteFill>
    </>
  );
};
