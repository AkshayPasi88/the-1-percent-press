import React from "react";
import { Composition } from "remotion";
import props from "../props.json";
import hype from "../hype_props.json";
import hypeVisualsRaw from "../hype_visuals.json";
import { TeaserReel } from "./components/TeaserReel";
import { QuoteReel } from "./components/QuoteReel";
import { ChecklistReel } from "./components/ChecklistReel";
import { HypeReel, HypeReelData, HypeBrand } from "./components/HypeReel";
import { CinematicReel } from "./components/CinematicReel";
import type { ReelProps } from "./theme";
import type { Visuals } from "./components/CentreStage";

const reelProps = props as unknown as ReelProps;
const hypeData = hype as { brand: HypeBrand; reels: HypeReelData[] };
const hypeVisuals = hypeVisualsRaw as Record<string, Visuals>;

export const ReelsRoot: React.FC = () => (
  <>
    <Composition
      id="TeaserReel"
      component={TeaserReel}
      durationInFrames={540}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={reelProps}
    />
    <Composition
      id="QuoteReel"
      component={QuoteReel}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={reelProps}
    />
    <Composition
      id="ChecklistReel"
      component={ChecklistReel}
      durationInFrames={540}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={reelProps}
    />
    {hypeData.reels.map((reel, i) => {
      // cinematic reels hold the pointing-at-ebook ending ~4 s past the voice
      const tail = reel.style === "cinematic" ? 4.2 : 0.9;
      const dur = Math.max(
        60,
        Math.ceil(((reel.audioDurationSec ?? 10) + tail) * 30)
      );
      return (
        <Composition
          key={reel.id}
          id={`Hype${String(i + 1).padStart(2, "0")}`}
          component={reel.style === "cinematic" ? CinematicReel : HypeReel}
          durationInFrames={dur}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ reel, brand: hypeData.brand, visuals: hypeVisuals[reel.id] ?? { scenes: [], beats: [] } }}
        />
      );
    })}
  </>
);
