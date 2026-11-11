import React, { useEffect } from "react";
import { delayRender, continueRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export interface ReelProps {
  brand: { name: string; handle: string; hashtag: string };
  palette: { bg: string; ink: string; inkSoft: string; gold: string; goldDeep: string };
  teaser: {
    hookLines: string[];
    punchLead: string;
    punch: string;
    cards: { num: string; title: string; sub: string }[];
    book: { kicker: string; title: string; subtitle: string; chip: string };
    cta: string;
  };
  quote: { text: string; emphasis: string; source: string; cta: string };
  checklist: { kicker: string; title: string; items: string[]; cta: string };
}

/** @font-face rules pointing at the TTFs in public/fonts (served at <staticBase>/fonts). */
const f = (name: string) => staticFile(`fonts/${name}`);
export const FONT_FACES = `
@font-face { font-family: 'Playfair Display'; src: url('${f("PlayfairDisplay-400.ttf")}') format('truetype'); font-weight: 400; font-style: normal; font-display: block; }
@font-face { font-family: 'Playfair Display'; src: url('${f("PlayfairDisplay-400-italic.ttf")}') format('truetype'); font-weight: 400; font-style: italic; font-display: block; }
@font-face { font-family: 'Playfair Display'; src: url('${f("PlayfairDisplay-700.ttf")}') format('truetype'); font-weight: 700; font-style: normal; font-display: block; }
@font-face { font-family: 'Playfair Display'; src: url('${f("PlayfairDisplay-900.ttf")}') format('truetype'); font-weight: 900; font-style: normal; font-display: block; }
@font-face { font-family: 'Source Sans 3'; src: url('${f("SourceSans3-400.ttf")}') format('truetype'); font-weight: 400; font-style: normal; font-display: block; }
@font-face { font-family: 'Source Sans 3'; src: url('${f("SourceSans3-600.ttf")}') format('truetype'); font-weight: 600; font-style: normal; font-display: block; }
@font-face { font-family: 'Source Sans 3'; src: url('${f("SourceSans3-700.ttf")}') format('truetype'); font-weight: 700; font-style: normal; font-display: block; }
@font-face { font-family: 'Source Sans 3'; src: url('${f("SourceSans3-400-italic.ttf")}') format('truetype'); font-weight: 400; font-style: italic; font-display: block; }
@font-face { font-family: 'Anton'; src: url('${f("Anton-Regular.ttf")}') format('truetype'); font-weight: 400; font-style: normal; font-display: block; }
`;

/** Block rendering until the brand fonts are really loaded. */
export function useBrandFonts() {
  useEffect(() => {
    const handle = delayRender("Loading brand fonts");
    const loads = [
      document.fonts.load('400 40px "Playfair Display"'),
      document.fonts.load('italic 400 40px "Playfair Display"'),
      document.fonts.load('700 40px "Playfair Display"'),
      document.fonts.load('900 40px "Playfair Display"'),
      document.fonts.load('400 40px "Source Sans 3"'),
      document.fonts.load('600 40px "Source Sans 3"'),
      document.fonts.load('700 40px "Source Sans 3"'),
      document.fonts.load('400 40px "Anton"'),
    ];
    Promise.all(loads)
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, []);
}

/** Thin gold progress bar near the top safe-zone edge. */
export const Progress: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 210,
        left: 90,
        height: 5,
        width: `${(frame / durationInFrames) * 100}%`,
        maxWidth: 900,
        background: color,
        borderRadius: 4,
      }}
    />
  );
};

/** Renders any 1%-style token (like `1%` or `×37.78`) in gold. */
export const AutoGold: React.FC<{ text: string; gold: string; serif?: boolean }> = ({
  text,
  gold,
  serif,
}) => {
  const parts = text.split(/(\d+(?:\.\d+)?%|×\d+(?:\.\d+)?)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        /^[0-9×]/.test(part) ? (
          <span key={i} style={{ color: gold, fontFamily: serif ? '"Playfair Display", serif' : undefined }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

/** Small pill chip used for handles / CTAs. */
export const Chip: React.FC<{
  label: string;
  bg: string;
  ink: string;
  border?: string;
  size?: number;
}> = ({ label, bg, ink, border, size = 34 }) => (
  <div
    style={{
      background: bg,
      color: ink,
      border: border ? `2px solid ${border}` : undefined,
      borderRadius: 999,
      padding: `${size * 0.42}px ${size * 1.5}px`,
      fontFamily: '"Source Sans 3", sans-serif',
      fontWeight: 700,
      fontSize: size,
      letterSpacing: 3,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </div>
);
