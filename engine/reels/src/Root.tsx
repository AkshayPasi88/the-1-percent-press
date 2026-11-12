// Engine v6 root — every reel is a fully-animated cinematic film.
// One spec per reel (see v6/director.mjs). No stock footage anywhere.
import React from "react";
import { Composition } from "remotion";
import { AnimatedWorld } from "./v6/AnimatedWorld";
import type { ReelSpec, ReelV6Props } from "./theme";

import gold_math from "../v6/specs/gold_math.json";
import mono_weather from "../v6/specs/mono_weather.json";
import lime_2min from "../v6/specs/lime_2min.json";
import crimson_twice from "../v6/specs/crimson_twice.json";
import ocean_votes from "../v6/specs/ocean_votes.json";
import steel_env from "../v6/specs/steel_env.json";
import forest_chain from "../v6/specs/forest_chain.json";
import coral_decade from "../v6/specs/coral_decade.json";
import violet_monday from "../v6/specs/violet_monday.json";
import sunset_onepct from "../v6/specs/sunset_onepct.json";
import gold_plateau from "../v6/specs/gold_plateau.json";
import ocean_identity from "../v6/specs/ocean_identity.json";
import onyx_rescue from "../v6/specs/onyx_rescue.json";
import iron_pain from "../v6/specs/iron_pain.json";

const SPECS: ReelSpec[] = [
  gold_math,
  mono_weather,
  lime_2min,
  crimson_twice,
  ocean_votes,
  steel_env,
  forest_chain,
  coral_decade,
  violet_monday,
  sunset_onepct,
  gold_plateau,
  ocean_identity,
  onyx_rescue,
  iron_pain,
] as unknown as ReelSpec[];

export const ReelsRoot: React.FC = () => (
  <>
    {SPECS.map((spec, i) => (
      <Composition
        key={spec.id}
        id={`Hype${String(i + 1).padStart(2, "0")}`}
        component={AnimatedWorld}
        durationInFrames={Math.ceil(spec.durationSec * spec.fps)}
        fps={spec.fps}
        width={1080}
        height={1920}
        defaultProps={{ spec } as ReelV6Props}
      />
    ))}
  </>
);
