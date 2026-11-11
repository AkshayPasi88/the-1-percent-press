# Engine v5 — Opuscar (code-drawn animated reels)

Reels are films made entirely in code, in the spirit of
[lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) (MIT):
`window.render(t)` deterministic canvas page → headless Chrome, frame by
frame → ffmpeg. **No stock footage, no AI video generation, no static
backgrounds — every frame is drawn and different.**

## What it delivers per reel

- **Hook (0–2 s):** giant slammed words synced to the voice's word
  timestamps, one word per fast background flip (0.25–0.7 s scenes).
- **Constantly changing background:** 12 procedural animated scenes
  (rings, flow-field particles, liquid waves, perspective tunnel, sliding
  stripes, orbiting shards, mosaic waves, glow blobs, glyph rain, sweeping
  spotlight, orbit rings, glitch slices) — scene cut every 1–3 s, locked
  to the music beat grid, never a flat colour: even the base coat is an
  animated gradient with drifting blotches.
- **Kinetic typography:** word-by-word captions driven by Fish Audio
  word timings; the spoken word is highlighted, keywords are accented;
  layouts (stack / block / arc / giant spot) are seeded per sentence.
- **Emotional voices:** per-sentence Fish Audio s2.1 calls with real
  natural-language emotion tags (`[shouting]`, `[whispering]`,
  `[dead serious]`…) + prosody speed — assigned by line role (hook →
  shout pool, reflective → whisper pool, …), seeded but meaningful.
- **Sound design:** procedural SFX (impacts on word slams and camera
  punches, whooshes on scene cuts, ticks on keywords, riser + impact on
  the CTA) and a seeded dark-trap music loop (kick/snare/hats/808/pad)
  with an energy envelope that drops drums under reflective lines and
  ducks under the voice; muxed at −14 LUFS two-pass loudnorm.
- **CTA ending:** ebook card + bouncing chevron → "FREE EBOOK · LINK IN BIO".
- **Deterministic:** one seed per reel drives delivery choice, scene
  sequence, camera, transitions, typography and music. Same seed → same
  film. New seed → new film.
- **Automated QC:** rejects static frames, blank frames, wrong specs,
  silent audio; builds a contact sheet for a vision review.

## Files

| file | role |
|---|---|
| `engine/lib.js` | seeded RNG, easing, value noise |
| `engine/bg.js` | the 12 animated background scenes |
| `engine/type.js` | hook slams, kinetic word stacks, CTA card |
| `engine/camera.js` | push/pull/pan/punch/shake/tilt + global breath |
| `engine/transitions.js` | flash / bars / wipe / streak / glitch bursts |
| `engine/main.js` | composition + page contract (DUR/render/EV/TEXTS) |
| `engine/index.html` | film page template |
| `build.mjs` | planner + orchestrator (plan → voice → render → mix → mux → qc) |
| `voice.mjs` | Fish Audio per-sentence emotional TTS + word timings |
| `mix.py` | numpy mix: voice + SFX + music, ducking, soft-clip |
| `qc.py` | specs / static-frame / blank / audio gates + contact sheet |

Rendered with the tools from the `lemo-opuscar` clone
(`core/render/{events,video}.mjs`, `core/render/mux.sh`), 1080×1920 @ 30 fps,
H.264 + AAC, −14 LUFS.

Voices: Fish Audio s2.1 (Adrian, Energetic Male references).
Fonts: Anton (OFL), Archivo Black (OFL), Source Sans 3 (OFL) — see the
ebook repo's `sources/CREDITS.md`.
