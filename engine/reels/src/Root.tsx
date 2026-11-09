import React from "react";
import { Composition } from "remotion";
import props from "../props.json";
import { TeaserReel } from "./components/TeaserReel";
import { QuoteReel } from "./components/QuoteReel";
import { ChecklistReel } from "./components/ChecklistReel";
import type { ReelProps } from "./theme";

const reelProps = props as unknown as ReelProps;

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
  </>
);
