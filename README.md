# The 1% Press — Self-Improvement Content Engine

An automated content engine for **free lead-magnet ebooks + social content**,
published to **Instagram (@self_efficient_daily)** and **Pinterest
(self_efficient)** through the **Zernio API**.

## What the engine makes

| Asset | Spec | How |
| --- | --- | --- |
| Voiced reels | 9:16 · 1080×1920 · 30fps · H.264 + AAC, 8–13s | Fish Audio TTS (male voice "Adrian", s2.1-pro-free, emotion tags) + Remotion (karaoke captions word-synced via TTS timestamps, hooks, ebook CTA, 10 color themes + animated SVG elements) |
| Quote slides | 4:5 · 1080×1350 PNG, single-image | HTML + headless Chrome (motivational/dopamine content, 6+ color themes) |
| Ebooks | 18 pages · 4:5 portrait (8×10 in) · PPTX + PDF | pptx skill workflow (batch `build_pptx_4x5.js` + `slides_to_pdf.js`) |

**Niche: self-improvement only.**

## Repository layout

```
the-1-percent-press/
├── PIPELINE.md          ← the runbook (weekly posting + on-demand ebooks)
├── engine/
│   ├── fish_tts.mjs          ← voice-over generator (Fish Audio, word timestamps)
│   ├── visual_director.py    ← AI visual director: image search + scene/beat timeline
│   ├── gen_credits.py        ← image attribution table generator
│   ├── generate_slides.py    ← 4:5 quote slide generator (headless Chrome)
│   ├── zernio_post.mjs       ← verified publisher (presign → upload → post)
│   ├── build_pptx_4x5.js     ← HTML → 4:5 portrait PPTX
│   ├── slides_to_pdf.js      ← HTML → PDF
│   ├── fetch_fonts.py, fix_font_names.py, make_contact_sheets.py
│   └── reels/                ← Remotion project
│       ├── src/components/HypeReel.tsx        ← voiced reel component
│       ├── src/components/CentreStage.tsx     ← centre visual layer (images/stats/kinetic text)
│       ├── src/components/HypeBackgrounds.tsx ← 10 animated SVG themes
│       ├── src/components/motion.tsx          ← kinetic-typography motion grammar
│       ├── hype_scripts.json                  ← reel content definitions
│       ├── hype_visuals.json                  ← per-reel scene + beat timeline
│       ├── render_hype.mjs                    ← renders voiced reels
│       └── render_all.mjs, props.json         ← classic silent reels (v1)
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

- Reel themes: gold bars · mono chain · lime streaks · crimson bolt · ocean waves ·
  steel checks · forest rings · coral clock · violet dots · sunset arc
- Type: Playfair Display (display) + Source Sans 3 (body)
- Voice: Fish Audio "Adrian" (male, deep, dramatic) with [emotion] tags
