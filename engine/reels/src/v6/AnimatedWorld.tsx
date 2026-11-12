// AnimatedWorld — the v6 main composition. One reel = one animated film:
// scene-spec driven worlds + character + camera + audio-reactive fx +
// kinetic type + flood-wipe scene transitions + CTA book. Deterministic:
// everything is a pure function of (spec, frame).
import React from "react";
import { useCurrentFrame, useVideoConfig, Audio, staticFile } from "remotion";
import type { ReelV6Props, SceneSpec } from "../theme";
import { clamp01 } from "./rand";
import { cameraAt, cameraTransform } from "./camera";
import { WORLDS } from "./worlds";
import { FontStyles, Grade } from "./lighting";
import { HookType, Captions, Counter, BrandTag } from "./kinetic";
import { FloodWipe, TRANSITION_SEC } from "./transitions";
import { Shockwave, SpeedLines, Embers, Dust, WorldPulse } from "./fx";
import { CTAScene } from "./book";

export const AnimatedWorld: React.FC<ReelV6Props> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;

  // ---------- scene lookup ----------
  const scenes = spec.scenes;
  let idx = scenes.findIndex((s) => time >= s.startSec && time < s.endSec);
  if (idx < 0) idx = scenes.length - 1;
  const scene = scenes[idx];
  const t = time - scene.startSec;
  const p = clamp01(t / Math.max(0.1, scene.endSec - scene.startSec));

  // ---------- audio reactivity ----------
  const pulse = spec.envelope[Math.min(frame, spec.envelope.length - 1)] ?? 0;
  let onset = 0;
  for (const o of spec.onsets) {
    if (frame >= o && frame < o + 9) {
      onset = Math.max(onset, 1 - (frame - o) / 9);
    }
    if (o > frame + 9) break;
  }

  // ---------- transition into this scene (flood wipe at boundary) ----------
  const boundary = scene.startSec;
  const tStart = boundary - TRANSITION_SEC / 2;
  const transProg = idx > 0 ? clamp01((time - tStart) / TRANSITION_SEC) : 1;
  const transitioning = idx > 0 && transProg < 1;
  // world to show: previous scene until the panel fully covers (prog 0.5)
  const showPrev = transitioning && transProg < 0.5;
  const activeScene: SceneSpec = showPrev ? scenes[idx - 1] : scene;
  const at = showPrev ? time - scenes[idx - 1].startSec : t;
  const ap = clamp01(at / Math.max(0.1, activeScene.endSec - activeScene.startSec));

  // ---------- camera ----------
  const cam = cameraAt(activeScene.camera, at);
  const cta = scene.type === "cta";
  const cam2 = cta ? { x: 0, y: 0, zoom: 1, rot: 0 } : cam;

  const World = WORLDS[activeScene.world];
  const fxKeys = activeScene.fx ?? [];

  return (
    <div style={{ position: "absolute", inset: 0, background: spec.theme.bg, overflow: "hidden" }}>
      <FontStyles />
      <Audio src={staticFile(spec.audio)} volume={1} />

      {!cta && (
        <>
          {/* camera layer: world + character */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: cameraTransform(cam2),
              transformOrigin: "50% 50%",
            }}
          >
            <svg viewBox="0 0 1080 1920" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
              {World && <World scene={activeScene} spec={spec} t={at} p={ap} pulse={pulse} onset={onset} />}
              {/* fx overlay */}
              <WorldPulse spec={spec} pulse={pulse} />
              {fxKeys.includes("shockwave") && <Shockwave spec={spec} onset={onset} />}
              {fxKeys.includes("speedlines") && <SpeedLines spec={spec} onset={onset} />}
              {fxKeys.includes("embers") && <Embers spec={spec} sceneId={activeScene.id} t={at} pulse={pulse} />}
              {fxKeys.includes("dust") && <Dust spec={spec} sceneId={activeScene.id} t={at} pulse={pulse} />}
            </svg>
          </div>

          {/* grade overlays (not camera-affected) */}
          <Grade scene={activeScene} spec={spec} />

          {/* kinetic type layer */}
          {activeScene.type === "hook" && <HookType spec={spec} t={at} onset={onset} />}
          {activeScene.type === "caption" && activeScene.narration && (
            <Captions sentence={activeScene.narration} spec={spec} time={time} t={t} />
          )}
          {activeScene.counter && (
            <Counter counter={activeScene.counter} spec={spec} t={at} p={ap} onset={onset} />
          )}
          {!cta && <BrandTag spec={spec} />}
        </>
      )}

      {cta && (
        <>
          <CTAScene spec={spec} t={t} pulse={pulse} />
          <Grade scene={activeScene} spec={spec} />
        </>
      )}

      {/* scene transition wipe — always on top */}
      {transitioning && (
        <FloodWipe accent={spec.theme.accent} accentDeep={spec.theme.accentDeep} prog={transProg} />
      )}
    </div>
  );
};
