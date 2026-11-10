import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FACES, ReelProps, useBrandFonts, Progress, Chip } from "../theme";

const WORD_START = 30;
const WORD_GAP = 26;
const SOURCE_AT = 320;
const CTA_AT = 390;

export const QuoteReel: React.FC<ReelProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props.palette;
  useBrandFonts();

  const words = props.quote.text.split(" ");
  const norm = (w: string) => w.replace(/[^a-zA-Z']/g, "").toLowerCase();

  const sourceS = spring({ frame: frame - SOURCE_AT, fps, config: { damping: 15 } });
  const ctaS = spring({ frame: frame - CTA_AT, fps, config: { damping: 14 } });

  return (
    <>
      <style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: p.bg, fontFamily: '"Source Sans 3", sans-serif', color: p.ink }}>
        <Progress color={p.gold} />

        {/* giant ghost quote mark */}
        <div
          style={{
            position: "absolute",
            top: 330,
            left: 70,
            fontFamily: '"Playfair Display", serif',
            fontWeight: 900,
            fontSize: 560,
            lineHeight: 0.8,
            color: p.gold,
            opacity: 0.14,
          }}
        >
          &ldquo;
        </div>

        {/* the quote */}
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 110px" }}>
          <div style={{ maxWidth: 860, textAlign: "left" }}>
            {words.map((word, i) => {
              const delay = WORD_START + i * WORD_GAP;
              const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 150 } });
              const isEmph = norm(word) === props.quote.emphasis.toLowerCase();
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: Math.min(1, s * 1.15),
                    transform: `translateY(${interpolate(s, [0, 1], [54, 0])}px)`,
                    fontFamily: '"Playfair Display", serif',
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: 96,
                    lineHeight: 1.28,
                    marginRight: 30,
                    color: isEmph ? p.goldDeep : p.ink,
                    position: "relative",
                  }}
                >
                  {word}
                  {isEmph && (
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        bottom: -6,
                        height: 6,
                        width: `${interpolate(frame, [delay + 12, delay + 34], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
                        background: p.gold,
                        borderRadius: 3,
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </AbsoluteFill>

        {/* source attribution */}
        {frame >= SOURCE_AT && (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 560 }}>
            <div style={{ opacity: Math.min(1, sourceS), textAlign: "center" }}>
              <div style={{ height: 2, width: 120, background: p.gold, margin: "0 auto 30px" }} />
              <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 9, color: p.inkSoft }}>{props.quote.source}</div>
            </div>
          </AbsoluteFill>
        )}

        {/* CTA chip */}
        {frame >= CTA_AT && (
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 330 }}>
            <div style={{ opacity: Math.min(1, ctaS), transform: `translateY(${interpolate(ctaS, [0, 1], [40, 0])}px)`, display: "flex", gap: 24 }}>
              <Chip label={props.quote.cta} bg={p.ink} ink={p.bg} size={32} />
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </>
  );
};
