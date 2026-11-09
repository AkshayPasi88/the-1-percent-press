# The 1% Press — Self-Improvement Content Engine

An automated weekly production line for **free lead-magnet ebooks + social reels**,
built for distribution through **Zernio** (Instagram, Pinterest and other platforms).

Each Monday at **09:00 IST** an automated batch produces:

| # | Deliverable | Spec |
|---|-------------|------|
| 1 | Pocket ebook | 18 pages · 4:5 portrait (8×10 in / 1024×1280 px) · PPTX (editable master) + PDF (distribution copy) |
| 2 | Reels ×3 | 9:16 · 1080×1920 · 30 fps · H.264 · silent branded text design (add trending audio at posting time) |
| 3 | Marketing kit | Instagram captions, Pinterest pin copy, hashtag tiers, IST posting schedule, Zernio publishing guide |

Niche: **self-improvement only** (tiny habits, morning routines, deep focus, digital
minimalism, journaling, …) — see the topic rotation in [`PIPELINE.md`](PIPELINE.md).

## Repository layout

```
the-1-percent-press/
├── PIPELINE.md                    ← weekly runbook (how each batch is produced)
├── engine/                        ← the build scripts
│   ├── build_pptx_4x5.js          ← HTML slides → 4:5 portrait PPTX (pptxgenjs)
│   ├── slides_to_pdf.js           ← HTML slides → print-ready PDF
│   ├── fetch_fonts.py             ← downloads Playfair Display + Source Sans 3
│   ├── fix_font_names.py          ← post-processes font names inside the PPTX
│   ├── make_contact_sheets.py     ← QA contact sheets from rendered pages
│   └── reels/                     ← Remotion project (src/, public/fonts/, props.json, render_all.mjs)
└── batch-001-the-1-percent-method/
    ├── The_1_Percent_Method_Ebook_4x5.pptx   ← editable master
    ├── The_1_Percent_Method_Ebook.pdf        ← distribution copy
    ├── slides/                    ← 18 HTML source pages + global.css + slides_brief.json
    ├── reels/                     ← teaser / quote / checklist reels (MP4)
    └── marketing_kit/             ← captions, pin copy, hashtags, schedule, Zernio guide
```

A new folder `batch-NNN-<topic-slug>/` lands here every week.

## Publishing (Zernio)

The engine does **not** auto-post — no Zernio credentials live in the build sandbox.
Each batch ships ready-to-post instead:

1. Open `batch-001-the-1-percent-method/marketing_kit/zernio_posting_guide.md` for the full walkthrough (dashboard or REST API).
2. Schedule the reels and pins using the pre-written captions and IST time slots.
3. Find-and-replace the placeholder brand `@The1PercentPress` with your real handle before posting.

## Editing / rebuilding a batch

```bash
# PPTX from slide HTML (needs global pptxgenjs):
NODE_PATH=/home/z/.npm-global/lib/node_modules node engine/build_pptx_4x5.js <slides-dir> <out.pptx>

# PDF from slide HTML:
NODE_PATH=/home/z/.npm-global/lib/node_modules node engine/slides_to_pdf.js <slides-dir> <out.pdf>

# Re-render reels after editing engine/reels/props.json:
cd engine/reels && npm install && node render_all.mjs
```

## Design system (locked)

- Palette: cream `#FAF6EF` · ink `#1C1B18` · antique gold `#C9A227`
- Type: Playfair Display (display) + Source Sans 3 (body)
- Canvas: 4:5 portrait, 1024×1280 px (8×10 in)

## Automation

A weekly scheduled task (Monday 09:00, Asia/Calcutta) runs the `PIPELINE.md` runbook
and pushes each new batch to this repository automatically.
