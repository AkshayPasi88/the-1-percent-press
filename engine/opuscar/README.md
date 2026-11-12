# Engine v6 — Opuscar Film Engine (fully animated cinematic reels)

Reels are **animated short films drawn entirely in code**: an original
character ("the Seeker"), custom-animated objects, staged story worlds,
cinematic camera and lighting — no stock footage, no random internet images,
no static backgrounds. Adapted from
[lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) (MIT, LemoLab) — its
code-driven film production architecture (deterministic `window.render(t)`
page → headless Chrome → ffmpeg; line-boil, character-rigs-in-code and
sound-design techniques) — with the creative ambition of
[awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos)
(MIT, yihui-dev) as a prompt/reference library. See *Attribution* below.

## The v6 pipeline (per reel)

```
SCRIPT (role-tagged sentences)
  → CREATIVE DIRECTOR (director.mjs): reads each line, casts the WORLD,
    stages the Seeker, places props, designs camera + lighting, schedules
    narration-synced fx (lightning on the word "storm", sunrise on "sun",
    flag plant at the payoff) — then VALIDATES the storyboard schema
  → emotional Fish TTS per sentence (word timings)
  → plan.json + deterministic canvas film page
  → headless Chrome, frame by frame (1080×1920 @ 30 fps)
  → procedural mix: voice + SFX (thunder/steps/sun swell) + music
  → ffmpeg mux, −14 LUFS two-pass loudnorm
  → automated QC gates + contact sheet
```

## What the film engine stages per reel

- **Hook (0–2 s):** giant slammed words synced to word timestamps over fast
  abstract backgrounds (v5 machinery — still the strongest opener).
- **Story scenes (the film):** one staged world per narration sentence —
  `dark_mountain` (night, moon, parallax ridges, the Seeker kneeling),
  `road` (perspective road, marching poles, walking cycle),
  `climb` (steep slope, alternating hand reaches, tumbling pebbles),
  `storm` (rain, lightning synced to the mix's thunder, lean-into-wind),
  `summit` (sunrise with rotating rays, cloud sea, birds, flag plant),
  plus `vault` (coins), `city` (buildings rising floor-by-floor with
  cranes), `study` (lamp pool, books, turning pages) for money/time/build
  narratives. Worlds are chosen by keyword scoring over the narration with
  a narrative escalation chain as fallback.
- **The Seeker (original character):** parametric 2.5D toon rig — hooded
  head with face-void + eye glints, torso with wind-flutter hem, backpack,
  two-segment arms/legs with capsule limbs, chunky boots, ground shadow,
  rim light per scene, squash & stretch, breathing/boil line — poses:
  kneel, rise (kneel→stand blend with anticipation), stand, walk, run,
  climb, lean-into-wind, triumph (V arms). One character card per film →
  consistent identity in every scene.
- **Custom objects:** alarm clock (ringing bells, spinning hands), giant
  clock (accelerating hands + pendulum), hourglass, stacking/spinning
  coins, city under construction, barbell with chalk-dust lift, books with
  floating pages, sun with rotating rays, moon, starfield, birds, branching
  lightning, wind-driven rain, drifting fog, summit flag on a rock cairn,
  glowing chalk starting line, peak beacon, dust motes. Every object is an
  original code-drawn asset with its own animation.
- **Cinematic staging:** camera moves per scene (push/pull/pan/punch/
  shake/tilt/crane/follow) **plus a constant cinematic creep** — the world
  camera never sits dead still; the actor rides the camera (steady subject,
  sliding world). Lighting grades per mood (dark / storm / dawn / gold)
  with vignette, rim light, lightning flash lift. Ink-bleed transitions
  between story scenes (a medium-native wipe), flash/streak/glitch for the
  hook.
- **Audio-reactive animation:** word-hit pulses (glow ring + rim-light
  flare on keywords), lightning + thunder on one shared event clock,
  sunrise swell, footsteps on the stride grid, rain ambience bed over storm
  scene windows, music energy follows the narration roles.
- **Kinetic typography:** word-by-word captions with dark outline plates
  (readable over sun/glare), keyword accents, gentle bob on settled words.
- **Emotional voices:** per-sentence Fish s2.1 with natural-language
  emotion tags + prosody speed, assigned by line role, seeded.
- **Deterministic:** one seed drives deliveries, staging, camera,
  transitions, fx and music. Same seed → same film.
- **Automated QC:** storyboard schema validation before rendering; after
  render: specs, static-frame, blank-frame, audio, story coverage (≥70% of
  speech inside story scenes), world variety (≥3), pacing (≤4.6 s scenes),
  Seeker presence — plus a contact sheet for vision review.

## Files

| file | role |
|---|---|
| `director.mjs` | **creative director agent** — script → storyboard + schema validation |
| `engine/lib.js` | seeded RNG, easing, value noise |
| `engine/characters.js` | **the Seeker rig** — poses, boil, rim light, character cards |
| `engine/objects.js` | **custom animated objects** (clocks, coins, city, books, weather…) |
| `engine/worlds.js` | **story environments** with parallax drift |
| `engine/story.js` | **scene compositor** — world + actor + props + lighting + narration sync |
| `engine/bg.js` | 12 abstract animated backgrounds (hook/CTA beds) |
| `engine/type.js` | hook slams, kinetic captions (outline plates), CTA card |
| `engine/camera.js` | push/pull/pan/punch/shake/tilt/crane/follow + breath |
| `engine/transitions.js` | flash/bars/wipe/streak/glitch/**ink bleed** |
| `engine/main.js` | composition + page contract (DUR/render/EV/TEXTS) |
| `engine/index.html` | film page template |
| `build.mjs` | orchestrator (plan → voice → render → mix → mux → qc) |
| `preview.mjs` | dry-run visual smoke test (fake timings, stills per world) |
| `voice.mjs` | Fish Audio per-sentence emotional TTS + word timings |
| `mix.py` | numpy mix: voice + SFX + music + ambience, ducking |
| `qc.py` | specs/static/blank/audio + film gates + contact sheet |

## Usage

```sh
node build.mjs <reelId>            # full pipeline (default: film engine)
node build.mjs 15 --stage plan     # director + voice + plan only
node preview.mjs 15                # quick stills per world (no TTS)
```

Rendered with tools from the lemo-opuscar clone (`core/render/{events,video}.mjs`,
`core/render/mux.sh`), 1080×1920 @ 30 fps, H.264 + AAC, −14 LUFS.
Voices: Fish Audio s2.1. Fonts: Anton / Archivo Black / Source Sans 3 (OFL) —
see the ebook repo's `sources/CREDITS.md`.

## Attribution

- **[lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar)** (MIT © 2026
  LemoLab): the rendering pipeline contract (`window.render(t)` pages,
  headless-Chrome frame capture, JPEG-screenshot speed, mux with two-pass
  loudnorm) and craft techniques we adapted: characters drawn in code (2.5D
  rigs, constant screen-space line weight, line boil cycling 3 drawings at
  12 fps, squash & stretch, anticipation), sound-is-half-the-film mixing,
  and review-loop QC. Our engine code is an original implementation of
  those techniques for our vertical-reel context; no demo code was copied.
- **[awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos)**
  (MIT © 2026 yihui-dev): studied as a creative reference library of
  code-built interactive video prompts (the "build the entire world in
  code, not clip searches" school). No content copied.
- Both repositories are cloned under `repos/` in the private sandbox for
  reference; their licenses are preserved in their clones.
