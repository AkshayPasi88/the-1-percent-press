import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FACES, ReelProps, useBrandFonts, Progress, Chip } from "../theme";

const HOOK_END = 90;
const PUNCH_END = 150;
const CARD_LEN = 80;
const CARDS_START = 150;
const BOOK_START = CARDS_START + 3 * CARD_LEN; // 390
const CTA_START = BOOK_START + 90; // 480

const rise = (frame: number, delay: number, fps: number) => {
  const s = spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 160 } });
  return { opacity: Math.min(1, s), transform: `translateY(${interpolate(s, [0, 1], [46, 0])}px)` };
};

export const TeaserReel: React.FC<ReelProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props.palette;
  useBrandFonts();

  const hookVisible = frame < HOOK_END;
  const hookFade = interpolate(frame, [HOOK_END - 12, HOOK_END], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const punchS = spring({ frame: frame - HOOK_END, fps, config: { damping: 10, stiffness: 120 } });
  const punchVisible = frame >= HOOK_END && frame < PUNCH_END;
  const punchFade = interpolate(frame, [PUNCH_END - 10, PUNCH_END], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cardIndex = Math.floor((frame - CARDS_START) / CARD_LEN);

  const bookS = spring({ frame: frame - BOOK_START, fps, config: { damping: 14, stiffness: 110 } });
  const ctaS = spring({ frame: frame - CTA_START, fps, config: { damping: 14, stiffness: 130 } });

  return (
    <>
      <style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: p.bg, fontFamily: '"Source Sans 3", sans-serif', color: p.ink }}>
        <Progress color={p.gold} />

        {/* HOOK */}
        {hookVisible && (
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: hookFade }}>
            {props.teaser.hookLines.map((line, li) => (
              <div
                key={li}
                style={{
                  fontSize: 88,
                  fontWeight: 700,
                  letterSpacing: -1,
                  lineHeight: 1.18,
                  margin: "6px 0",
                  ...rise(frame, 6 + li * 14, fps),
                }}
              >
                {line}
              </div>
            ))}
            <div style={{ marginTop: 44, height: 3, width: interpolate(frame, [10, 40], [0, 180], { extrapolateRight: "clamp" }), background: p.gold }} />
          </AbsoluteFill>
        )}

        {/* PUNCH */}
        {punchVisible && (
          <AbsoluteFill
            style={{
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "column",
              opacity: punchFade,
              transform: `scale(${interpolate(punchS, [0, 1], [0.97, 1])})`,
            }}
          >
            <div style={{ fontSize: 84, fontWeight: 700, color: p.inkSoft, ...rise(frame, HOOK_END, fps) }}>
              {props.teaser.punchLead}
            </div>
            <div
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 900,
                fontSize: 430,
                lineHeight: 1,
                color: p.goldDeep,
                marginTop: 10,
                transform: `scale(${interpolate(punchS, [0, 1], [0.72, 1])})`,
              }}
            >
              {props.teaser.punch}
            </div>
          </AbsoluteFill>
        )}

        {/* VALUE CARDS */}
        {frame >= CARDS_START && frame < BOOK_START && cardIndex >= 0 && cardIndex < props.teaser.cards.length && (
          <AbsoluteFill
            style={{
              background: cardIndex === 2 ? p.ink : p.bg,
              color: cardIndex === 2 ? p.bg : p.ink,
              justifyContent: "center",
              alignItems: "center",
              flexDirection: "column",
              padding: "0 110px",
            }}
          >
            {(() => {
              const card = props.teaser.cards[cardIndex];
              const local = frame - (CARDS_START + cardIndex * CARD_LEN);
              const enter = spring({ frame: local, fps, config: { damping: 13 } });
              const exit = interpolate(local, [CARD_LEN - 10, CARD_LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div style={{ opacity: Math.min(enter, exit), transform: `translateX(${interpolate(enter, [0, 1], [70, 0])}px)` }}>
                  <div style={{ fontFamily: '"Playfair Display", serif', fontWeight: 700, fontSize: 150, color: p.gold, lineHeight: 1, marginBottom: 30 }}>
                    {card.num}
                  </div>
                  <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1, marginBottom: 26 }}>{card.title}</div>
                  <div style={{ fontSize: 44, fontWeight: 400, color: cardIndex === 2 ? "#D8D2C4" : p.inkSoft, lineHeight: 1.35, maxWidth: 760 }}>
                    {card.sub}
                  </div>
                  <div style={{ marginTop: 54, height: 3, width: 160, background: p.gold }} />
                </div>
              );
            })()}
          </AbsoluteFill>
        )}

        {/* BOOK COVER MOCK */}
        {frame >= BOOK_START && frame < CTA_START && (
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: `scale(${interpolate(bookS, [0, 1], [0.93, 1])})`, opacity: Math.min(1, bookS * 1.4) }}>
            <div
              style={{
                width: 640,
                height: 800,
                border: `3px solid ${p.goldDeep}`,
                outline: `1.5px solid ${p.gold}`,
                outlineOffset: 14,
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "0 70px",
                textAlign: "center",
              }}
            >
              <div style={{ fontFamily: '"Source Sans 3", sans-serif', fontSize: 26, letterSpacing: 7, color: p.goldDeep, marginBottom: 36 }}>
                {props.teaser.book.kicker}
              </div>
              <div style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 108, lineHeight: 1.04, color: p.ink }}>
                {props.teaser.book.title}
              </div>
              <div style={{ height: 3, width: 130, background: p.gold, margin: "40px 0" }} />
              <div style={{ fontSize: 34, color: p.inkSoft, lineHeight: 1.45, maxWidth: 440 }}>{props.teaser.book.subtitle}</div>
              <div style={{ marginTop: 60, background: "rgba(201,162,39,0.14)", border: `1.5px solid ${p.gold}`, borderRadius: 999, padding: "16px 44px", fontSize: 26, fontWeight: 700, letterSpacing: 4, color: p.goldDeep }}>
                {props.teaser.book.chip}
              </div>
            </div>
          </AbsoluteFill>
        )}

        {/* CTA */}
        {frame >= CTA_START && (
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", opacity: Math.min(1, ctaS * 1.3) }}>
            <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: "italic", fontWeight: 700, fontSize: 100, textAlign: "center", ...rise(frame, CTA_START, fps) }}>
              {props.teaser.cta.split(".")[0]}.
            </div>
            <div style={{ fontSize: 46, color: p.inkSoft, marginTop: 24, ...rise(frame, CTA_START + 10, fps) }}>
              {props.teaser.cta.split(".")[1]?.trim()}
            </div>
            <div style={{ marginTop: 70, ...rise(frame, CTA_START + 20, fps) }}>
              <Chip label={props.brand.handle} bg="rgba(201,162,39,0.14)" ink={p.goldDeep} border={p.gold} />
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </>
  );
};
