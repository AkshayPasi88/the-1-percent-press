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
const ANTON = '"Anton", sans-serif';

/* ───────────────────────── footage layer ─────────────────────────
   energy-driven camera: punch (fast zoom-in), pullFast, push, panL/R,
   slowPush. Hard cuts for shout/angry/fast, 0.32 s crossfades otherwise. */
const FootageLayer: React.FC<{
  sc: VScene; idx: number; t: number; opacity: number; pulse: number;
}> = ({ sc, idx, t, opacity, pulse }) => {
  if (!sc.image) {
    // gradient-only scene: never empty — animated accent field behind text
    return (
      <AbsoluteFill style={{ opacity }}>
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at ${30 + (idx % 3) * 20}% ${40 + (idx % 2) * 18}%, #2A2531 0%, #0A0A0C 62%)`,
          transform: `scale(${1.1 + 0.1 * pulse})`,
        }} />
      </AbsoluteFill>
    );
  }
  const energy = sc.energy ?? 0.5;
  const dur = Math.max(0.8, sc.end - sc.start);
  const prog = clamp01((t - sc.start) / dur);
  const dir = idx % 2 === 0 ? 1 : -1;
  let zoom: number, panX: number;
  switch (sc.zoomStyle) {
    case "punch": zoom = 1.02 + 0.22 * prog; panX = 0; break;            // fast push-in
    case "pullFast": zoom = 1.24 - 0.16 * prog; panX = 0; break;        // snap pull-back
    case "push": zoom = 1.08 + 0.12 * prog; panX = dir * 18 * prog; break;
    case "panL": zoom = 1.14; panX = interpolate(prog, [0, 1], [44, -44]); break;
    case "panR": zoom = 1.14; panX = interpolate(prog, [0, 1], [-44, 44]); break;
    case "slowPush": zoom = 1.05 + 0.07 * prog; panX = dir * 10 * prog; break;
    default: zoom = 1.1; panX = 0;
  }
  // beat kick: discrete punch-in step (feels like a cut on the beat)
  const scale = zoom * (1 + 0.05 * pulse * (0.4 + energy));
  const shake = sc.cutType === "hard" ? Math.max(0, 1 - (t - sc.start) / 0.2) : 0;
  const sh = shake * shake * 7 * Math.sin((t - sc.start) * 70);
  return (
    <AbsoluteFill style={{ opacity, transform: `translateX(${sh}px)` }}>
      <Img src={staticFile(sc.image)} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${scale}) translateX(${panX}px)`,
        filter: `saturate(${0.88 - 0.08 * pulse}) contrast(1.05) brightness(1.04)`,
      }} />
    </AbsoluteFill>
  );
};

/* ───────────── kinetic headline: one giant line per sentence ─────────── */
const Headline: React.FC<{
  sc: VScene; th: Theme; t: number; fps: number; pulse: number;
}> = ({ sc, th, t, fps, pulse }) => {
  const words = (sc.text ?? "").toUpperCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const energy = sc.energy ?? 0.5;
  const age = Math.max(0, t - sc.start);
  const remain = sc.end - t;
  const outOp = clamp01(remain / 0.4);
  const enter = spring({ frame: age * fps, fps, config: { damping: 15, stiffness: 170 } });
  const joined = words.join(" ");
  const base = joined.length > 26 ? 92 : joined.length > 16 ? 108 : joined.length > 9 ? 126 : 144;
  const fontSize = Math.round(base * (0.86 + 0.22 * energy));  // louder sentence = bigger type
  const tr = interpolate(Math.min(1, age / 0.7), [0, 1], [0.05, 0.006], { ...EASE });
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 950,
      fontFamily: ANTON, fontWeight: 400, lineHeight: 1.08, letterSpacing: `${tr}em`,
      opacity: outOp * clamp01(enter * 1.5),
      transform: `translateY(${interpolate(enter, [0, 1], [34, 0])}px) scale(${1 + 0.016 * pulse})`,
      textShadow: `0 12px 44px ${th.bg}, 0 3px 12px ${th.bg}`,
    }}>
      {words.map((w, i) => {
        const key = isKeyWord(w);
        const wa = Math.max(0, age - i * 0.05);   // 50 ms word cascade
        const punch = scalePunch(wa, 0.38);
        return (
          <span key={i} style={{
            fontSize, margin: "0 13px", display: "inline-block",
            color: key ? th.accent : th.ink,
            opacity: clamp01(punch.opacity * 1.35),
            transform: punch.transform,
            filter: punch.filter,
          }}>{w}</span>
        );
      })}
    </div>
  );
};

/* ───────── word-level kinetic captions (bottom, platform-safe) ───────── */
const WordCaptions: React.FC<{
  groups: { start: number; end: number; words: { text: string; start: number; end: number }[] }[];
  th: Theme; t: number;
}> = ({ groups, th, t }) => {
  let gi = 0;
  for (let i = 0; i < groups.length; i++) if (t + 0.05 >= groups[i].start) gi = i;
  const g = groups[gi];
  if (!g || t < g.start - 0.4 || t > g.end + 0.6) return null;
  return (
    <div key={gi} style={{
      display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 900,
      fontFamily: ANTON, fontWeight: 400, lineHeight: 1.22,
    }}>
      {g.words.map((w, i) => {
        const active = t >= w.start - 0.03 && t <= w.end + 0.12;
        const said = t > w.end + 0.12;
        const pop = active ? 1.16 : 1;
        return (
          <span key={i} style={{
            fontSize: 46, margin: "0 12px", display: "inline-block",
            color: active ? th.accent : said ? th.inkSoft : "#FFFFFF33",
            opacity: said || active ? 1 : 0,
            transform: `scale(${pop})`,
            textShadow: `0 4px 22px ${th.bg}E6, 0 2px 8px ${th.bg}`,
            transition: "none",
          }}>{(w.text || "").toUpperCase().replace(/[^A-Z0-9$%'\s×]/g, "") || w.text.toUpperCase()}</span>
        );
      })}
    </div>
  );
};

/* ═════════════════════════ THE CINEMATIC REEL ═════════════════════════ */
export const CinematicReel: React.FC<CinematicProps> = ({ reel, brand, visuals }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const th = reel.theme;
  useBrandFonts();

  const audio = <Audio src={staticFile(reel.audio)} volume={1} />;
  const scenes = (visuals?.scenes ?? []) as (VScene & { energy?: number; zoomStyle?: string; cutType?: string })[];
  const beats = visuals?.beats ?? [];
  const sfxEvents = ((visuals as any)?.sfx ?? []) as { t: number; kind: string; vol?: number }[];
  const pulse = beatPulse(beats, t, 5);

  /* ── HOOK (0 → hookEnd): word-slam + rapid footage cuts + flash ── */
  const hookScene = scenes[0];
  const hookImages = [scenes[0]?.image, scenes[1]?.image, scenes[2]?.image]
    .filter(Boolean) as string[] | undefined[];
  const inHook = t < reel.hookEndSec;
  const hookCut = Math.min(hookImages.length ? Math.floor(t / 0.55) : 0, Math.max(0, hookImages.length - 1));
  const hookImg = hookImages[hookCut];
  const hookFlash = interpolate(t, [0, 0.09, 0.4], [0.65, 0.35, 0], {
    extrapolateRight: "clamp", extrapolateLeft: "clamp",
  });
  const hookShake = Math.max(0, 1 - t / 0.3);
  const hookSh = hookShake * hookShake * 9 * Math.sin(t * 62);
  // slam zoom: hard punch-in across the whole hook
  const hookZoom = interpolate(t, [0, reel.hookEndSec], [1.28, 1.1], {
    extrapolateRight: "clamp",
  });

  /* ── body footage stack (sentence scenes, hook excluded) ── */
  const body = scenes.filter((sc) => sc.start >= reel.hookEndSec - 0.25);
  const layers = body.map((sc, idx) => {
    const hard = sc.cutType === "hard";
    const fadeIn = hard ? (t >= sc.start - 0.04 ? 1 : 0) : interpolate(t, [sc.start - 0.16, sc.start + 0.16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const fadeOut = hard ? (t <= sc.end + 0.04 ? 1 : 0) : interpolate(t, [sc.end - 0.16, sc.end + 0.16], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return { sc, idx, op: clamp01(fadeIn * fadeOut) };
  }).filter((l) => l.op > 0.004);

  /* ── current sentence headline ── */
  let textIdx = -1;
  for (let i = 0; i < scenes.length; i++)
    if (t >= scenes[i].start - 0.05 && t < scenes[i].end + 0.3) textIdx = i;
  const textScene = textIdx >= 0 ? scenes[textIdx] : null;

  /* ── SFX-synced impact flashes (hook + CTA slams) ── */
  const impacts = sfxEvents.filter((e) => e.kind === "impact");
  const flash = impacts.reduce((m, e) => {
    const d = t - e.t;
    return d >= 0 && d < 0.22 ? Math.max(m, (1 - d / 0.22) * 0.55) : m;
  }, 0);
  const riserT = sfxEvents.find((e) => e.kind === "riser")?.t ?? reel.ctaStartSec - 1.25;
  const riserBuild = clamp01((t - riserT) / 1.25);

  /* ── CTA — POINT TO THE EBOOK ── */
  const ctaT = Math.max(0, t - reel.ctaStartSec);
  const ctaS = spring({ frame: ctaT * fps, fps, config: { damping: 15, stiffness: 110 } });
  const ctaGlow = 0.5 + 0.5 * Math.sin(t * 3.4);
  const arrowBounce = Math.abs(Math.sin(ctaT * 4.6));
  const inCta = t >= reel.ctaStartSec;

  const progress = (frame / Math.max(1, durationInFrames - 1)) * 100;
  const bgDim = inCta
    ? interpolate(t, [reel.ctaStartSec, reel.ctaStartSec + 0.5], [1, 0.25], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  return (
    <>
      <style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: th.bg, fontFamily: '"Source Sans 3", sans-serif', color: th.ink }}>
        {audio}

        {/* ── HOOK footage: rapid hard cuts + slam zoom + shake + flash ── */}
        {inHook && hookImg && (
          <AbsoluteFill style={{ transform: `translateX(${hookSh}px)` }}>
            <Img src={staticFile(hookImg)} style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
              transform: `scale(${hookZoom})`,
              filter: "saturate(1.0) contrast(1.1) brightness(1.1)",
            }} />
            <div style={{ position: "absolute", inset: 0, background: th.bg, opacity: 0.22 }} />
            <div style={{ position: "absolute", inset: 0, background: th.accent, opacity: hookFlash * 0.5 }} />
          </AbsoluteFill>
        )}

        {/* ── BODY footage: crossfaded / hard-cut sentence scenes ── */}
        {!inHook && (
          <AbsoluteFill style={{ opacity: bgDim }}>
            {layers.map(({ sc, idx, op }) => (
              <FootageLayer key={idx} sc={sc} idx={idx} t={t} opacity={op} pulse={pulse} />
            ))}
          </AbsoluteFill>
        )}

        {/* one continuous cinematic grade */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${th.bg}D9 0%, transparent 20%, transparent 48%, ${th.bg}E8 76%, ${th.bg} 100%)` }} />
        {/* moving accent gradient — ambient motion even on held footage */}
        <div style={{
          position: "absolute", inset: -60,
          background: `linear-gradient(115deg, transparent 30%, ${th.accent}14 50%, transparent 70%)`,
          backgroundSize: "260% 260%",
          backgroundPosition: `${(t * 16) % 260}% ${(t * 7) % 260}%`,
          opacity: 0.5 + 0.3 * riserBuild,
        }} />
        <Vignette th={th} />
        <Grain />
        {/* impact flash overlay */}
        {flash > 0.01 && <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: flash * 0.5 }} />}

        {/* ── HOOK word SLAM: giant words hit exactly when spoken ── */}
        {inHook && hookScene && (
          <div style={{ position: "absolute", top: 560, left: 60, right: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {(hookScene.words ?? []).map((w, i) => {
              const age = Math.max(0, t - w.start);
              const vis = age >= 0;
              const slam = spring({ frame: age * fps, fps, config: { damping: 12, stiffness: 380 } });
              const disp = (w.text || "").toUpperCase().replace(/[^A-Z0-9$%'\s×]/g, "");
              if (!disp) return null;
              const key = isKeyWord(disp);
              return (
                <div key={i} style={{
                  fontFamily: ANTON, fontWeight: 400,
                  fontSize: disp.length > 8 ? 132 : 168, lineHeight: 1.02,
                  color: key ? th.accent : th.ink,
                  margin: "2px 0", textAlign: "center",
                  opacity: vis ? clamp01(slam * 2.2) : 0,
                  transform: `scale(${interpolate(slam, [0, 1], [1.6, 1])}) translateY(${interpolate(slam, [0, 1], [18, 0])}px)`,
                  filter: age < 0.12 ? `blur(${interpolate(age, [0, 0.12], [10, 0])}px)` : undefined,
                  textShadow: `0 14px 54px ${th.bg}, 0 4px 16px ${th.bg}`,
                }}>{disp}</div>
              );
            })}
            {/* underline strike */}
            <div style={{
              marginTop: 26, height: 8, borderRadius: 4, background: th.accent,
              width: interpolate(t, [0.1, 0.7], [0, 260], { extrapolateRight: "clamp" }),
              boxShadow: `0 0 26px ${th.accent}AA`,
            }} />
          </div>
        )}

        {/* ── BODY: sentence headline + word-level captions ── */}
        {!inHook && !inCta && textScene && (
          <div style={{
            position: "absolute", top: 880, left: 60, right: 60,
            display: "flex", justifyContent: "center",
          }}>
            {/* contrast scrim — headline always pops over any footage */}
            <div style={{
              position: "absolute", top: -52, left: -90, right: -90, bottom: -70,
              background: `radial-gradient(ellipse at 50% 50%, ${th.bg}F5 26%, ${th.bg}C8 55%, transparent 78%)`,
              filter: "blur(2px)",
            }} />
            <Headline sc={textScene} th={th} t={t} fps={fps} pulse={pulse} />
          </div>
        )}
        {!inHook && !inCta && (
          <div style={{ position: "absolute", top: 1430, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <WordCaptions groups={reel.captions} th={th} t={t} />
          </div>
        )}

        {/* handle chip */}
        <div style={{ position: "absolute", top: 148, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{
            background: "#000000A8", border: `1.5px solid ${th.ink}44`, borderRadius: 999,
            padding: "13px 36px", fontSize: 26, fontWeight: 700, letterSpacing: 4, color: th.inkSoft,
          }}>{brand.handle}</div>
        </div>

        {/* ── CTA — POINT TO THE EBOOK (riser glow ramp behind it) ── */}
        {inCta && (
          <>
            <div style={{
              position: "absolute", inset: 0,
              background: `radial-gradient(ellipse 70% 46% at 50% 38%, ${th.accent}${Math.round(14 + 26 * ctaGlow).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
            }} />
            <div style={{
              position: "absolute", top: 400, left: 0, right: 0,
              display: "flex", flexDirection: "column", alignItems: "center",
              opacity: Math.min(1, ctaS * 1.35),
              transform: `scale(${interpolate(ctaS, [0, 1], [0.92, 1])})`,
            }}>
              <div style={{
                width: 620, padding: "70px 56px", borderRadius: 18, textAlign: "center",
                background: "linear-gradient(180deg, #0C0C12FA 0%, #050508F8 100%)",
                border: `3px solid ${th.accent}`,
                boxShadow: `0 0 ${58 + 66 * ctaGlow}px ${th.accent}${ctaGlow > 0.5 ? "88" : "55"}, 0 44px 100px rgba(0,0,0,0.6)`,
              }}>
                <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: 9, color: th.accent, marginBottom: 32, textShadow: `0 0 18px ${th.accent}88` }}>
                  FREE EBOOK
                </div>
                <div style={{ fontFamily: ANTON, fontWeight: 400, fontSize: 96, lineHeight: 1.05, color: th.ink }}>
                  {brand.ebookTitle.split(" ").map((w, i) => (
                    <div key={i} style={/\d/.test(w) ? { color: th.accent } : undefined}>{w}</div>
                  ))}
                </div>
                <div style={{ height: 3, width: 130, background: th.accent, margin: "32px auto" }} />
                <div style={{ fontSize: 29, color: th.inkSoft, lineHeight: 1.4 }}>{brand.ebookSub}</div>
              </div>
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
          </>
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
