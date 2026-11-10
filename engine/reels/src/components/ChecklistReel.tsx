import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FACES, ReelProps, useBrandFonts, Progress, AutoGold, Chip } from "../theme";

const ITEM_START = 80;
const ITEM_GAP = 85;
const CTA_AT = 440;

export const ChecklistReel: React.FC<ReelProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = props.palette;
  useBrandFonts();

  const titleS = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  const ctaS = spring({ frame: frame - CTA_AT, fps, config: { damping: 14 } });

  return (
    <>
      <style>{FONT_FACES}</style>
      <AbsoluteFill style={{ background: p.bg, fontFamily: '"Source Sans 3", sans-serif', color: p.ink }}>
        <Progress color={p.gold} />

        {/* title */}
        <div style={{ position: "absolute", top: 360, left: 0, width: "100%", textAlign: "center", opacity: Math.min(1, titleS * 1.2), transform: `translateY(${interpolate(titleS, [0, 1], [40, 0])}px)` }}>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 12, color: p.goldDeep, marginBottom: 26 }}>
            {props.checklist.kicker}
          </div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontWeight: 900, fontSize: 132, lineHeight: 1.02, letterSpacing: -1 }}>
            <AutoGold text={props.checklist.title} gold={p.goldDeep} serif />
          </div>
          <div style={{ height: 3, width: 150, background: p.gold, margin: "44px auto 0" }} />
        </div>

        {/* items */}
        <div style={{ position: "absolute", top: 820, left: 120, width: 840 }}>
          {props.checklist.items.map((item, i) => {
            const at = ITEM_START + i * ITEM_GAP;
            const rowS = spring({ frame: frame - at, fps, config: { damping: 13 } });
            const checkS = spring({ frame: frame - at - 14, fps, config: { damping: 9, stiffness: 200 } });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 34,
                  margin: "44px 0",
                  opacity: Math.min(1, rowS * 1.2),
                  transform: `translateX(${interpolate(rowS, [0, 1], [-60, 0])}px)`,
                }}
              >
                <div
                  style={{
                    width: 66,
                    height: 66,
                    flex: "none",
                    border: `3px solid ${p.goldDeep}`,
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(201,162,39,0.10)",
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 16,
                      borderBottom: `5px solid ${p.goldDeep}`,
                      borderLeft: `5px solid ${p.goldDeep}`,
                      transform: `rotate(-45deg) scale(${interpolate(checkS, [0, 1], [0, 1])}) translateY(-3px)`,
                    }}
                  />
                </div>
                <div style={{ fontSize: 62, fontWeight: 600, lineHeight: 1.15, letterSpacing: -0.5 }}>{item}</div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {frame >= CTA_AT && (
          <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 320 }}>
            <div style={{ opacity: Math.min(1, ctaS), textAlign: "center" }}>
              <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: "italic", fontWeight: 700, fontSize: 84, marginBottom: 40 }}>
                {props.checklist.cta}
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <Chip label={props.brand.handle} bg="rgba(201,162,39,0.14)" ink={p.goldDeep} border={p.gold} />
              </div>
            </div>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </>
  );
};
