# Pipeline Runbook

Weekly task runs **Monday 09:00 IST**. Niche: **self-improvement only.**

## Weekly run (posting)

1. **Pick the format** — flip a coin / random pick: **reel** or **slide**.

2. **REEL** (voiced, 9:16, fully animated — Engine v6):
   - Add a new entry to `engine/reels/hype_props.json`
     (fresh hook lines + voice script with [emotion] tags, a theme palette,
     CTA to the CURRENT ebook). Optionally extend the per-reel direction
     table in `engine/reels/v6/director.mjs` (worlds, actions, counters).
   - `node engine/fish_tts.mjs <n>` — generates the voice-over + word
     timestamps (`engine/reels/public/audio/hype_NN.mp3`, duration back into
     `hype_props.json`).
   - `cd engine/reels && npm run build` — the whole v6 pipeline:
     probe (audio analysis) → director (scene specs) → render
     (1080×1920@30 deterministic + ffmpeg master) → QC.
     Single reel: `npm run render:one -- <n>`.
   - QA: `npm run qc` (duration, streams, black frames, silence, contact
     sheets in `v6/sheets/`). Vision-check 2 frames per world type.
     Fix by editing the spec or direction table, re-render that reel only.

3. **SLIDE** (single 4:5 image):
   - Add a fresh dopamine/hard-work quote entry to `SLIDES` in
     `/home/z/my-project/scripts/generate_slides.py` (new quote + theme + deco).
   - `python3 /home/z/my-project/scripts/generate_slides.py` →
     `download/slides/slide_NN.png` (1080×1350).

4. **POST via Zernio** (accounts: IG @self_efficient_daily, Pinterest
   self_efficient):
   ```bash
   node /home/z/my-project/scripts/zernio_post.mjs <file> "<caption + hashtags>" \
        --type video|image --platforms ig,pin
   ```
   Write a fresh caption (hook line + 1–2 value lines + CTA + 5–8 hashtags).
   Optionally `--at` a better slot (Mon/Wed/Fri 12:00 or 18:00, daily 20:00 IST).

5. **Archive**: copy the asset + caption into the ebook's repo folder under
   `/home/z/my-project/repos/<ebook-repo>/` (reels/ or slides/ + marketing_kit/),
   then `git add -A && git commit -m "reel/slide: <hook>" && git push origin main`.
   Remote: https://github.com/AkshayPasi88/<repo>.git (credential helper reads
   `/home/z/my-project/.secrets/github_token`; never print it).

6. **Report**: format, hook, file path, post URLs, repo push status.

## On-demand ebook creation (ONLY when the user explicitly asks)

Same flow as batch 001:

1. Pick a topic from the rotation (tiny habits · morning routines · deep focus ·
   self-discipline · digital minimalism · journaling · gratitude · sleep reset ·
   reading habits · daily walking · energy management · saying no).
2. Author 18 HTML slide pages (4:5, 1024×1280) on the locked design system.
3. Export PPTX + PDF (`build_pptx_4x5.js`, `slides_to_pdf.js`) — 18 pages, 8×10 in.
4. Create a NEW GitHub repo `/<topic-slug>-ebook` (public), containing
   `ebook/` (PPTX + PDF), `reels/`, `slides/`, `marketing_kit/`, `sources/`.
5. Produce an initial set of voiced animated reels + slides for it (see weekly run).
6. From then on, weekly reels/slides point their CTA to THIS new ebook.

## Environment prerequisites (build sandbox)

- Node 24 · `npx hyperframes@0.9.40` (Engine v7 reels render; auto-installed)
- Chrome via hyperframes `browser ensure` (reels render) + Playwright Chromium (slides)
- ffmpeg/ffprobe · LibreOffice · poppler for QA
- Secrets in `/home/z/my-project/.secrets/`: `github_token`, `fish_audio_key`,
  `zernio_key`, `instagram_account_id`, `pinterest_account_id` (chmod 600)
- Fish Audio free model has fair-use limits — pace calls (~1.5s between reels)

## Hard rules

- **No stock footage, no web images, no static backgrounds in reels — ever.**
  Engine v6 draws every frame programmatically (see `engine/reels/v6/SPEC.md`).
- Deterministic rendering only: seeded randomness, closed-form motion,
  no `Date.now()` / unseeded `Math.random()` in components.
- A reel ships only after `qc.mjs` passes and its contact sheet has been
  vision-checked.
