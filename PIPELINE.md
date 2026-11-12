# Pipeline Runbook

Weekly task runs **Monday 09:00 IST**. Niche: **self-improvement only.**

## Weekly run (posting)

1. **Pick the format** — flip a coin / random pick: **reel** or **slide**.

2. **REEL** (voiced, 9:16) — **default since 2026-11-12: the animated FILM engine (v6)**:

   **v6 — opuscar film engine (preferred, `engine/opuscar/` in this repo):**
   - Add a reel definition to `REELS` in
     `/home/z/my-project/repos/the-1-percent-press/engine/opuscar/build.mjs`
     (sentences with roles: hook / tension / imperative / contrast /
     reflective / punchline, a palette, bpm, seed, voiceRef). Narratives
     stay 25–40 words.
   - The **creative director** (`director.mjs`) reads each sentence, casts
     the story world (dark mountains → road → climb → storm → summit
     sunrise, or vault/city/study for money/time narratives), stages the
     Seeker (our code-drawn hooded character), places custom animated
     objects, designs camera + lighting, and schedules narration-synced fx
     (lightning-on-"storm", sunrise-on-"sun", flag at the payoff) — then
     validates the storyboard schema before rendering.
   - `node /home/z/my-project/repos/the-1-percent-press/engine/opuscar/build.mjs <key>`
     — plans + voices (Fish s2.1 per-sentence emotions), renders
     frame-by-frame (headless Chrome), mixes SFX + music + ambience, muxes
     at −14 LUFS and runs QC. `--fresh-voice` re-voices; `--stage
     plan|render|mix|mux|qc` runs one stage. `node preview.mjs <key>`
     renders quick per-world stills with fake timings (no TTS cost) for a
     visual smoke test.
   - QC gates: storyboard schema, no static frames, no blank frames,
     correct 1080×1920@30 specs, audio present, story coverage ≥70% of
     speech, ≥3 worlds, ≤4.6 s scenes, Seeker present; vision-review the
     contact sheet.
   - New seed → new film (emotions, staging, cameras, fx, typography,
     music all re-randomised meaningfully). Voice cache avoids re-paying
     TTS calls. Reference repos (MIT): lemo-opuscar (pipeline + craft),
     awesome-opus5-5-videos (creative library) — cloned under `repos/`.

   **v3 legacy (photo/card reels 1–12):**
   - Add a new entry to `/home/z/my-project/scripts/reels/hype_scripts.json`
     (fresh hook + 15–25 word voice script with [emotion] tags, a theme from the
     10 existing color/svg themes or a new one, CTA to the CURRENT ebook).
   - `cd /home/z/my-project/scripts && node fish_tts.mjs <n>` — generates the
     voice-over + word timestamps (public/audio/hype_NN.mp3 + hype_props.json).
   - `python3 visual_director.py --fetch --only <id>` — image search + download
     for the reel's curated scene specs; then `python3 visual_director.py` to
     rebuild hype_visuals.json (scene windows + beat markers).
   - `cd /home/z/my-project/scripts/reels && node render_hype.mjs HypeNN` —
     renders `download/reels/hype_NN.mp4` (1080×1920 h264+aac).
   - QA: ffprobe the MP4; extract 2 frames and vision-check captions/hook/CTA
     (or PIL ink check); ASR one file if voice changed.

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
5. Produce an initial set of voiced reels + slides for it (see weekly run).
6. From then on, weekly reels/slides point their CTA to THIS new ebook.

## Environment prerequisites (build sandbox)

- Node 24 · Remotion deps in `scripts/reels` (`npm install` if recycled)
- Playwright Chromium (slides) + Remotion's headless Chrome (reels)
- ffmpeg/ffprobe · LibreOffice · poppler for QA
- Secrets in `/home/z/my-project/.secrets/`: `github_token`, `fish_audio_key`,
  `zernio_key`, `instagram_account_id`, `pinterest_account_id` (chmod 600)
- Fish Audio free model has fair-use limits — pace calls (~1.5s between reels)
