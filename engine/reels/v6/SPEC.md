# Engine v6 — Fully Animated Cinematic Video Generation Engine

**Philosophy: the AI no longer searches for stock footage to tell the story —
it creates the entire animated world where the story happens.**

Stock video, random web images and static backgrounds are permanently banned.
Every frame of every reel is drawn by code: worlds, characters, light, type.

## Pipeline (default render architecture)

```
hype_props.json ──┐
                  ├─> probe.mjs ──> v6/probe/<id>.json      (audio envelope + onsets)
                  │
                  └─> director.mjs ──> v6/specs/<id>.json    (scene specs = the film)
                              │
                              v
                 Remotion bundle (src/index.ts)
                              │
                              v
                 render.mjs (deterministic frames, 1080×1920@30)
                              │  + ffmpeg master: film grain + loudnorm + faststart
                              v
                 download/reels/hype_NN.mp4 ──> qc.mjs (gates + contact sheets)
```

One command: `npm run build` (probe → director → render → QC).

## Scene spec schema (`v6/specs/<reelId>.json`)

The Creative Director (`director.mjs`) turns each narration script into a
structured film. Sentences become scenes; worlds, cameras, actions, fx and
counters come from the per-reel creative direction tables.

```jsonc
{
  "id": "gold_math", "style": "hype",            // hype | cinematic
  "audio": "audio/hype_01.mp3",                  // Fish Audio TTS narration
  "audioDurationSec": 11.86, "durationSec": 15.31, "fps": 30,
  "theme": { "bg", "panel", "accent", "accentDeep", "ink", "inkSoft" },
  "hookLines": ["1% EVERY DAY", "= ×37.78"],
  "scenes": [
    {
      "id": "gold_math-s0",
      "world": "iso-grid",                       // one of the 10 animated worlds
      "startSec": 0, "endSec": 2.9,
      "camera": [{ "t": 0, "x": 0, "y": 0, "zoom": 1.02, "rot": 0 }, ...],
      "action": "idle",                          // TheOne character action
      "character": true, "charPos": [540, 1500], "charScale": 1.2,
      "lighting": { "tint": "warm", "intensity": 0.5 },
      "fx": ["shockwave", "speedlines"],         // audio-reactive overlays
      "counter": { "label": "ONE YEAR", "from": 1, "to": 37.78, "prefix": "×" },
      "motif": "chain",                          // world-specific prop variant
      "narration": { "text": "...", "words": [{ "w", "start", "end" }] },
      "type": "hook"                             // hook | caption | cta
    }
  ],
  "cta": { "startSec": 13.0, "lines": [...] },
  "envelope": [0.0, 0.12, ...],                  // per-frame loudness 0..1
  "onsets": [34, 71, 103, ...],                  // frames carrying a speech punch
  "brand": { "handle", "ebookTitle", "ebookSub", "cta" }
}
```

## The ten animated worlds (`src/v6/worlds.tsx`)

| world | look | used for |
|---|---|---|
| `iso-grid` | isometric tile floor + ascending blocks + data squares | compounding, systems |
| `riso-poster` | risograph grain, misregistration, growing bar chart | math, plateau |
| `ink-dawn` | parallax ink mountains, rising sun, birds, mist | calm, decade |
| `neon-city` | rainy neon skyline, lit windows, rooftop, far parallax row | nobody-is-coming |
| `paper-forest` | layered paper-cut trees, fog strata, fireflies, chain links | streaks |
| `cosmic-orbit` | starfield, planet, orbit rings, shooting stars | identity, votes |
| `blueprint-tech` | blueprint grid, stepping gears, pitch circles, exploded stack | mechanisms, rules |
| `halftone-comic` | halftone dots, comic panel, burst wedges, speed lines | punchy rules |
| `liquid-grad` | morphing gradient fields, dot grid, horizon | calm, identity |
| `cel-stage` | spotlight cone, light pool, dust motes, chalk puffs | discipline, gym |

## Character consistency — TheOne (`src/v6/TheOne.tsx`)

One protagonist across every reel and scene: charcoal hoodie, gold trim, cap,
faceless shadow, gold soles. Parametric rig with actions: idle / walk / run /
climb / lift / meditate / levitate / victory / point. Cel outlines + accent
rim light + separation halo keep it readable on every world; the rim takes
each reel's accent so the identity stays constant while sitting inside the
film's palette.

## Audio-reactive animation

`probe.mjs` decodes each narration track (ffmpeg → f32 PCM) and computes a
per-frame RMS envelope (attack fast / decay slow, p95-normalised) plus speech
onsets. Both are baked into the spec — components are pure functions of
frame, so rendering stays deterministic. The envelope drives world glow,
character micro-squash and particle energy; onsets trigger shockwave rings,
speed lines, hook scale-punches, camera flash.

## Determinism contract

- No `Date.now()`, no unseeded `Math.random()`, no CSS transitions.
- All randomness via seeded `mulberry32` (`src/v6/rand.ts``).
- All motion is closed-form easing / springs of `(frame, spec)`.
- Re-rendering the same spec yields identical frames.

## QC (`v6/qc.mjs`)

Per reel: duration vs spec (±0.35s), h264+aac streams, black-frame scan
(blackdetect), silence scan (mean volume), contact sheet for human review.
Writes `v6/qc_report.json`; exits non-zero on any failure. Scene-level
regeneration: re-run `director.mjs`, edit the spec (or direction tables),
`render.mjs --only N`.

## Mastering

Rendered frames → x264 crf 19; ffmpeg master pass adds film grain
(`noise=alls=3:allf=t`), EBU R128 loudness (−14 LUFS, TP −1.5), AAC 160k,
faststart. Output lands in `/home/z/my-project/download/reels/`.

## Credits & attribution

Architecture and technique adapted from (both studied before implementation):
- **lemomo-ai/lemo-opuscar** (MIT, © 2026 Lemomo): the deterministic
  `render(t)` page-contract idea, keyed-camera grammar, model-sheet/rig
  discipline, mastering chain (grain in ffmpeg, loudnorm), fail-loud QC.
- **yihui-dev/awesome-opus5-5-videos** (MIT, © 2026 yihui-dev): creative
  vocabulary — misregistration, halftone, isometric stepping, pacing rules,
  "banned list" discipline. Individual prompt authors credited in that repo.

Narration: Fish Audio TTS (existing `hype_props.json` scripts + audio).
