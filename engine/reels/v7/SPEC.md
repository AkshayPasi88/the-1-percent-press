# Engine v7 — HyperFrames HTML Video Engine

**Philosophy: every reel is an animated world built from plain web tech —
HTML, CSS, SVG and GSAP — rendered to video frame by frame by HyperFrames.**

Remotion is gone. There is no React render tree, no bundler, no React
reconciliation during rendering. A scene is a standalone HTML document; the
HyperFrames runtime seeks a paused GSAP timeline to each frame, so every
render is identical and every scene is independently previewable, testable
and re-renderable.

## Pipeline (default and only render architecture)

```
hype_props.json ──┐
                  ├─> v7/probe.mjs    ──> v7/probe/<id>.json   (envelope + onsets)
                  └─> v7/director.mjs ──> v7/specs/<id>.json    (scene specs + uniqueness)
                              │
                              v
                 v7/build.mjs ──> build/<id>/   (HyperFrames project per reel)
                              │     index.html          scene hosts + narration <audio>
                              │     compositions/*.html one file per scene
                              │     assets/fonts|audio|characters
                              v
                 v7/render.mjs
                              │     npx hyperframes check (contract gate, fail-loud)
                              │     npx hyperframes render (1080×1920 @ 30fps, deterministic)
                              │     ffmpeg master: grain + EBU R128 + faststart
                              v
                 download/reels/hype_NN.mp4 ──> v7/qc.mjs
                                                (gates + per-scene perceptual
                                                 uniqueness + contact sheets)
```

One command: `npm run make` (probe → director → build → render → QC).

## Why HyperFrames

- Deterministic by contract: paused timeline seeked per frame — re-renders
  are pixel-identical (the v6 determinism rules are now enforced by the
  renderer itself).
- HTML-first: scenes are plain documents, editable in any editor, previewable
  in the HyperFrames studio, no build step beyond generation.
- Per-scene files: a scene is a unit of render, QC and retry.
- The CLI (`check`, `validate`, `snapshot`, `timeline`) gives browser-error
  detection, missing-asset detection and automatic scene previews.

## Scene spec schema (`v7/specs/<reelId>.json`)

Same proven v6 schema, plus `variant` and `camSig` for uniqueness:

```jsonc
{
  "id": "gold_math", "style": "hype", "engine": "v7-hyperframes",
  "audio": "audio/hype_01.mp3", "audioDurationSec": 11.86,
  "durationSec": 15.31, "fps": 30,
  "theme": { "bg", "panel", "accent", "accentDeep", "ink", "inkSoft" },
  "hookLines": ["1% EVERY DAY", "= ×37.78"],
  "scenes": [
    {
      "id": "gold_math-s0", "world": "iso-grid",
      "variant": 0,                    // same-world scenes differ by variant
      "startSec": 0, "endSec": 2.9,
      "camera": [{ "t", "x", "y", "zoom", "rot" }],
      "action": "idle",                // TheOne joint-driven action
      "character": true, "charPos": [540, 1500], "charScale": 1.2,
      "lighting": { "tint": "warm", "intensity": 0.5 },
      "fx": ["shockwave", "speedlines"],
      "counter": { "label": "ONE YEAR", "from": 1, "to": 37.78, "prefix": "×" },
      "narration": { "text": "...", "words": [{ "w", "start", "end" }] },
      "type": "hook"                   // hook | caption | cta
    }
  ],
  "envelope": [0.0, 0.12],  "onsets": [34, 71],  "brand": { ... }
}
```

## Scene uniqueness (the "same screen replaying" fix)

Two independent gates:

1. **Director validation** — every scene gets a signature
   `(world, variant, action, camera-template, charPos, fx, counter)`.
   Duplicate signatures fail the build; repeated worlds automatically take
   incrementing variants (different layout seed, camera template, character
   position and action).
2. **QC perceptual check** — after rendering, each scene's midpoint frame is
   dHashed (8×8 grayscale, via ffmpeg). Any pair of scenes with hamming
   distance < 10 fails QC loudly with the offending pair named.

## Character consistency (the "deformed character" fix)

`v7/assets/characters/theone.svg` is the **single canonical asset**: one file
defines proportions, palette and rig joints. `build.mjs` inlines this exact
markup into every scene (ids prefixed per scene) — scenes can only animate
the named joint groups (`#to-bob`, `#to-lean`, `#to-armL/R`,
`#to-forearmL/R`, `#to-legL/R`, `#to-head`, `#to-barbell`) via rotations at
anatomical pivots. Nobody ever redraws the character, so identity and
proportions cannot drift between scenes — this was impossible to guarantee
with v6's per-frame procedural React rig.

The rig: feet at local (0,0), ~3.7-head stylized figure, charcoal hoodie,
gold trim, cap, faceless hood, gold soles. Joint rotations are GSAP
`attr:{transform:"rotate(θ)"}` tweens on groups whose parent carries the
pivot translate — rotation is always about the anatomical joint. The accent
rim/halo takes the reel accent via `var(--acc)`.

## The ten animated worlds (`v7/lib/worlds.mjs`)

iso-grid · riso-poster · ink-dawn · neon-city · paper-forest ·
cosmic-orbit · blueprint-tech · halftone-comic · liquid-grad · cel-stage
(+ `cta` end-card stage). Each generator runs at build time: seeded layout
(mulberry32) baked into SVG markup + emitted GSAP tween source. Variants
flip compositions (staircase direction, rooftop side, riso bar direction…).

## Audio-reactive animation

`probe.mjs` (unchanged v6 algorithm) bakes a per-frame RMS envelope + speech
onsets into the spec. In each scene one proxy tween drives a `--pulse` CSS
variable consumed by glow/halo/squash/flicker styles; onsets place discrete
shockwave/speedline/flash/shooting-star tweens. All pure functions of
timeline time.

## Rendering reliability

- `render.mjs` runs `hyperframes check` (contract + runtime + layout lint)
  before every render — contract violations abort that reel, not the batch.
- Scene-level preview: `node v7/build.mjs --reel-id <id> --scene 3` +
  `render.mjs --reel-id <id> --scene 3` renders one scene for fast review.
- Failed-scene recovery: QC names the broken scene; rebuild that scene's
  file and re-render only that reel.
- Black-frame, silence, duration and dead-scene luma gates in `qc.mjs`.

## Mastering

HyperFrames render (x264, quality "looks") → ffmpeg master: film grain
(`noise=alls=3:allf=t`), EBU R128 loudness (−14 LUFS, TP −1.5), AAC 160k,
faststart. Output: `/home/z/my-project/download/reels/hype_NN.mp4`.

## Credits & attribution

- **HyperFrames** (heygen-com/hyperframes) — the rendering framework and its
  composition contract (`skills/hyperframes/SKILL.md`, MIT-style public docs).
- **lemomo-ai/lemo-opuscar** (MIT) — deterministic `render(t)` page contract,
  keyed camera grammar, mastering chain, fail-loud QC (via v6 lineage).
- **yihui-dev/awesome-opus5-5-videos** (MIT) — creative vocabulary:
  misregistration, halftone, isometric stepping, pacing discipline.
- Narration: Fish Audio TTS (existing `hype_props.json` scripts + audio).
