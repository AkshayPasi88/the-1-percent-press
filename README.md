# The 1% Press — Self-Improvement Content Engine

An automated content engine for **free lead-magnet ebooks + social content**,
published to **Instagram (@self_efficient_daily)** and **Pinterest
(self_efficient)** through the **Zernio API**.

## What the engine makes

| Asset | Spec | How |
| --- | --- | --- |
| Voiced reels | 9:16 · 1080×1920 · 30fps · H.264 + AAC, 11–36s | **Engine v7 — HyperFrames HTML reels**: Fish Audio TTS narration + HTML/SVG/CSS + GSAP animated worlds, one canonical protagonist, audio-reactive effects, kinetic type, ebook CTA. **No stock footage — every frame is drawn by code. Rendered deterministically by HyperFrames.** |
| Quote slides | 4:5 · 1080×1350 PNG, single-image | HTML + headless Chrome (motivational/dopamine content, 6+ color themes) |
| Ebooks | 18 pages · 4:5 portrait (8×10 in) · PPTX + PDF | pptx skill workflow (batch `build_pptx_4x5.js` + `slides_to_pdf.js`) |

**Niche: self-improvement only.**

## Engine v7 — the HyperFrames HTML reel engine

**Philosophy: every reel is an animated world built from plain web tech —
HTML, CSS, SVG and GSAP — rendered frame by frame by HyperFrames.**
Stock video, random web images and static backgrounds are permanently banned.

Pipeline: `v7/probe.mjs` (audio envelope + onsets) → `v7/director.mjs`
(Creative Director: script → scene specs, scene-uniqueness validated) →
`v7/build.mjs` (generates a HyperFrames project per reel: one HTML file per
scene) → `v7/render.mjs` (`hyperframes check` gate → deterministic render →
ffmpeg master: film grain + loudnorm) → `v7/qc.mjs` (gates + per-scene
perceptual uniqueness + contact sheets).
One command: `cd engine/reels && npm run make`.

Ten animated worlds: iso-grid · riso-poster · ink-dawn · neon-city ·
paper-forest · cosmic-orbit · blueprint-tech · halftone-comic · liquid-grad ·
cel-stage. One protagonist ("TheOne": charcoal hoodie, gold trim, cap) from a
single canonical SVG asset inlined into every scene — identity and
proportions cannot drift. Full schema + credits in
[`engine/reels/v7/SPEC.md`](engine/reels/v7/SPEC.md).

## Repository layout

```
the-1-percent-press/
├── PIPELINE.md          ← the runbook (weekly posting + on-demand ebooks)
├── engine/
│   ├── fish_tts.mjs          ← voice-over generator (Fish Audio, word timestamps)
│   ├── gen_credits.py        ← image attribution table generator (ebook sources)
│   ├── generate_slides.py    ← 4:5 quote slide generator (headless Chrome)
│   ├── zernio_post.mjs       ← verified publisher (presign → upload → post)
│   ├── build_pptx_4x5.js     ← HTML → 4:5 portrait PPTX
│   ├── slides_to_pdf.js      ← HTML → PDF
│   ├── fetch_fonts.py, fix_font_names.py
│   └── reels/                ← Engine v7 (HyperFrames HTML video engine)
│       ├── v7/probe.mjs      ← audio → envelope + onsets (deterministic)
│       ├── v7/director.mjs   ← Creative Director: scripts → scene specs (+ uniqueness)
│       ├── v7/build.mjs      ← spec → HyperFrames project (scene HTML files)
│       ├── v7/render.mjs     ← check gate + hyperframes render + ffmpeg master
│       ├── v7/qc.mjs         ← QC gates + perceptual scene uniqueness + sheets
│       ├── v7/specs/         ← generated scene specs (the films)
│       ├── v7/lib/           ← worlds.mjs, scene-kit.js, character.js, prng.mjs
│       ├── v7/assets/characters/theone.svg  ← canonical protagonist asset
│       ├── v7/build/         ← generated HyperFrames projects (one reel each)
│       ├── v7/SPEC.md        ← schema + worlds + attribution
│       ├── hype_props.json   ← reel content source (scripts + themes)
│       ├── public/audio/     ← TTS narration tracks
│       └── public/fonts/     ← Anton, Archivo Black, Playfair, Source Sans 3
```

Each **ebook** gets its own repository with its reels, slides and marketing kit:
- [the-1-percent-method-ebook](https://github.com/AkshayPasi88/the-1-percent-method-ebook) — batch 001 (Tiny Habits)

## Publishing (Zernio — verified end-to-end)

```bash
node engine/zernio_post.mjs <file> "<caption>" --type video|image --platforms ig,pin
# optional: --at "2026-11-16T09:30:00+05:30"  --first-comment "..."  --board <id>  --pin-title "..."
```

- 9:16 videos → **Instagram Reels** + **Pinterest video pins** automatically
- 4:5 images → **Instagram feed** + **Pinterest pins**
- API key + account IDs live in `/home/z/my-project/.secrets/` (never committed)

## Automation

A weekly scheduled task (Monday 09:00 IST) creates **one random content piece —
a reel or a slide** — and publishes it to both platforms, then archives it to
GitHub. **New ebooks are only produced on explicit request** (say the word in
chat). Full details in `PIPELINE.md`.

## Design system

- Reel themes: gold · mono · lime · crimson · ocean · steel · forest · coral ·
  violet · sunset (each a full palette: bg/panel/accent/accentDeep/ink/inkSoft)
- Worlds: iso-grid · riso-poster · ink-dawn · neon-city · paper-forest ·
  cosmic-orbit · blueprint-tech · halftone-comic · liquid-grad · cel-stage
- Type: Anton (hooks) · Archivo Black (CTA) · Playfair Display (ebook) ·
  Source Sans 3 (captions)
- Voice: Fish Audio "Adrian" (male, deep, dramatic) with [emotion] tags

## Credits

Engine v6/v7 architecture adapted from **lemomo-ai/lemo-opuscar** (MIT) and the
creative vocabulary of **yihui-dev/awesome-opus5-5-videos** (MIT) — both
studied in depth before implementation. Rendering framework:
**HyperFrames** (heygen-com/hyperframes). See
[`engine/reels/v7/SPEC.md`](engine/reels/v7/SPEC.md).
