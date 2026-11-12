// v6 lighting & grade overlays — DOM layers above the world, below type.
import React from "react";
import { staticFile } from "remotion";
import type { ReelSpec, SceneSpec } from "../theme";

export const FontStyles: React.FC = () => (
  <style>{`
    @font-face { font-family: "Anton"; src: url("${staticFile("fonts/Anton-Regular.ttf")}") format("truetype"); font-display: block; }
    @font-face { font-family: "Archivo Black"; src: url("${staticFile("fonts/ArchivoBlack-Regular.ttf")}") format("truetype"); font-display: block; }
    @font-face { font-family: "Playfair Display"; src: url("${staticFile("fonts/PlayfairDisplay-700.ttf")}") format("truetype"); font-weight: 700; font-display: block; }
    @font-face { font-family: "Playfair Display"; src: url("${staticFile("fonts/PlayfairDisplay-900.ttf")}") format("truetype"); font-weight: 900; font-display: block; }
    @font-face { font-family: "Source Sans 3"; src: url("${staticFile("fonts/SourceSans3-400.ttf")}") format("truetype"); font-weight: 400; font-display: block; }
    @font-face { font-family: "Source Sans 3"; src: url("${staticFile("fonts/SourceSans3-600.ttf")}") format("truetype"); font-weight: 600; font-display: block; }
    @font-face { font-family: "Source Sans 3"; src: url("${staticFile("fonts/SourceSans3-700.ttf")}") format("truetype"); font-weight: 700; font-display: block; }
  `}</style>
);

const hexA = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

const TINTS: Record<string, string | null> = {
  warm: "#E8B84B",
  cool: "#54C8FF",
  neutral: null,
};

export const Grade: React.FC<{ scene: SceneSpec; spec: ReelSpec }> = ({ scene, spec }) => {
  const tintCol = TINTS[scene.lighting?.tint ?? "neutral"] ?? null;
  const k = scene.lighting?.intensity ?? 0.5;
  return (
    <>
      {tintCol && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hexA(tintCol, 0.12 * k),
            mixBlendMode: "soft-light",
          }}
        />
      )}
      {/* vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 130% 100% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.38) 100%)",
        }}
      />
      {/* top scrim for hook readability */}
      {scene.type === "hook" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 760,
            background:
              "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.18) 55%, rgba(0,0,0,0))",
          }}
        />
      )}
      {/* bottom scrim for captions */}
      {scene.type === "caption" && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 480,
            background:
              "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.22) 40%, rgba(0,0,0,0.52))",
          }}
        />
      )}
      {/* brand-safe subtle frame line */}
      <div
        style={{
          position: "absolute",
          left: 70,
          right: 70,
          top: 64,
          height: 2,
          background: hexA(spec.theme.accent, 0.35),
        }}
      />
    </>
  );
};
