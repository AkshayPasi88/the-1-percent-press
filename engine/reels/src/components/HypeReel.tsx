import React from "react";
import {
  AbsoluteFill, Audio, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { FONT_FACES, useBrandFonts } from "../theme";
import { Background, Grain, Vignette, Theme } from "./HypeBackgrounds";

export interface HypeWord { text: string; start: number; end: number; display: string; }
export interface HypeGroup { start: number; end: number; words: HypeWord[]; }
export interface HypeReelData {
  id: string; file: string; audio: string; name: string;
  theme: Theme; svg: string; hookLines: string[];
  hookEndSec: number; ctaStartSec: number; audioDurationSec: number; speechEndSec: number;
  captions: HypeGroup[];
}
export interface HypeBrand { handle: string; ebookTitle: string; ebookSub: string; cta: string; }
export interface HypeProps { reel: HypeReelData; brand: HypeBrand; }

/** Find the caption group that should be on screen at time t (seconds). */
const groupAt = (groups: HypeGroup[], t: number): number => {
  let idx = 0;
  for (let i = 0; i < groups.length; i++) if (t + 0.04 >= groups[i].start) idx = i;
  return idx;
};

export const HypeReel: React.FC<HypeProps> = ({ reel, brand }) => {
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

  /* ── CTA book card ── */
  const ctaT = Math.max(0, t - reel.ctaStartSec);
  const ctaS = spring({ frame: ctaT * fps, fps, config: { damping: 15, stiffness: 120 } });
  const ctaGlow = 0.5 + 0.5 * Math.sin(t * 3.2);

  /* ── progress bar ── */
  const progress = (frame / Math.max(1, durationInFrames - 1)) * 100;

  return (
    <>
      <style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: th.bg, fontFamily: '"Source Sans 3", sans-serif', color: th.ink }}>
        {audio}
        <div style={{
          position: "absolute", inset: 0,
          opacity: t >= reel.ctaStartSec
            ? interpolate(t, [reel.ctaStartSec, reel.ctaStartSec + 0.45], [1, 0.22], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
            : 1,
        }}>
          <Background th={th} variant={reel.svg} />
        </div>
        <Vignette th={th} />

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
              return (
                <div key={li} style={{
                  fontFamily: '"Playfair Display", serif', fontWeight: 900,
                  fontSize: line.length > 16 ? 96 : 122, lineHeight: 1.06, color: th.ink,
                  letterSpacing: -1, margin: "4px 0",
                  opacity: Math.min(1, s * 1.3),
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

        {/* mid-reel title — keeps the frame alive between hook and CTA */}
        {reel.ctaStartSec - reel.hookEndSec > 1.0 && t >= reel.hookEndSec - 0.15 && t < reel.ctaStartSec && (
          <div style={{
            position: "absolute", top: 700, left: 90, right: 90, textAlign: "center",
            opacity: interpolate(
              t,
              [reel.hookEndSec - 0.15, reel.hookEndSec + 0.25, reel.ctaStartSec - 0.3, reel.ctaStartSec - 0.02],
              [0, 1, 1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
          }}>
            <div style={{
              fontSize: 56, fontWeight: 700, letterSpacing: 9, lineHeight: 1.3,
              color: th.inkSoft, textTransform: "uppercase", textShadow: `0 8px 30px ${th.bg}`,
            }}>
              {reel.hookLines.join(" · ")}
            </div>
            <div style={{ height: 3, width: 120, background: `${th.accent}99`, margin: "26px auto 0", borderRadius: 2 }} />
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

        {/* karaoke captions */}
        {captionsVisible && group && (
          <div style={{
            position: "absolute", top: 1430, left: 0, right: 0, display: "flex", justifyContent: "center",
            opacity: interpolate(t, [0, 0.12], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            <div key={gi} style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 920,
              background: `${th.panel}F2`, border: `2px solid ${th.accent}40`, borderRadius: 26,
              padding: "26px 44px",
              transform: `translateY(${interpolate(groupPop, [0, 1], [16, 0])}px)`,
            }}>
              {group.words.map((w, wi) => {
                const active = t >= w.start - 0.03 && t <= w.end + 0.1;
                const said = t > w.end + 0.1;
                const age = Math.max(0, t - w.start);
                const pop = active ? interpolate(age, [0, 0.1], [1.16, 1], { extrapolateRight: "clamp" }) : 1;
                return (
                  <span key={wi} style={{
                    fontSize: 64, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.25,
                    margin: "0 9px", display: "inline-block",
                    color: active ? th.accent : th.ink,
                    opacity: said || active ? 1 : 0.82,
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
