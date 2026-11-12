// Engine v6 — theme types. Fully-animated cinematic reels: no stock footage,
// no random web images, no static backgrounds. Every frame is drawn by code.

export interface Theme {
  bg: string;
  panel: string;
  accent: string;
  accentDeep: string;
  ink: string;
  inkSoft: string;
}

export interface Brand {
  handle: string;
  ebookTitle: string;
  ebookSub: string;
  cta: string;
}

export interface CounterSpec {
  label: string;
  from: number;
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export interface NarrationWord {
  w: string;
  start: number; // sec, reel-absolute
  end: number;
}

export interface NarrationSentence {
  text: string;
  start: number; // sec, reel-absolute
  end: number;
  words: NarrationWord[];
}

export interface CameraKey {
  // [t, x, y, zoom, rot] — scene-local seconds
  t: number;
  x: number;
  y: number;
  zoom: number;
  rot: number;
}

export interface SceneSpec {
  id: string;
  world: string;
  startSec: number;
  endSec: number;
  camera: CameraKey[];
  action: string;
  character: boolean;
  charPos: [number, number]; // world coords (viewBox 1080x1920)
  charScale: number;
  lighting: { tint: string; intensity: number };
  fx: string[];
  counter?: CounterSpec;
  motif?: string;
  narration?: NarrationSentence;
  type: "hook" | "caption" | "cta";
}

export interface ReelSpec {
  id: string;
  name: string;
  style: "hype" | "cinematic";
  audio: string; // staticFile path
  audioDurationSec: number;
  durationSec: number; // composition duration
  fps: number;
  theme: Theme;
  hookLines: string[];
  scenes: SceneSpec[];
  cta: { startSec: number; lines: string[] };
  envelope: number[]; // per-frame loudness 0..1 (audio-reactive)
  onsets: number[]; // frame indices carrying a rhythmic onset (speech punch)
  brand: Brand;
}

export interface ReelV6Props {
  spec: ReelSpec;
}
