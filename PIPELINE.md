# Weekly Batch Runbook

Executed every **Monday 09:00 IST** by the scheduled task.
Niche rule: **self-improvement and adjacent niches only.**

## Topic rotation (never repeat an existing batch)

tiny habits · morning routines · deep focus · self-discipline · digital minimalism ·
journaling · gratitude practice · sleep reset · reading habits · daily walking ·
energy management · saying no — extend with adjacent self-improvement niches when exhausted.

## Steps

1. **Topic** — pick the next un-produced topic from the rotation.
2. **Slides** — author 18 HTML pages on the locked design system
   (cream `#FAF6EF` / ink `#1C1B18` / gold `#C9A227`, Playfair Display + Source Sans 3,
   canvas **1024×1280 px, 4:5 portrait**): cover, TOC, intro with stats,
   4 chapters × (opener / body / worksheet), takeaways page, 30-day challenge, back cover.
3. **Exports** — 4:5 PPTX + PDF via the `engine/` scripts; both must report
   18 pages at 8×10 in before continuing.
4. **Reels** — edit `engine/reels/props.json` (teaser / quote / checklist content for
   the new topic), re-render 3 × 1080×1920 H.264 MP4s.
5. **Marketing kit** — rewrite captions (Instagram + Pinterest), hashtag tiers and the
   kit README with the weekly IST schedule.
6. **QA** — render 3–4 PDF pages and check for overflow / blank pages / placeholders;
   ffprobe each MP4 (1080×1920, h264); scan slides for leftover TODO markers.
7. **Archive to this repo** — copy the finished batch as `batch-NNN-<slug>/`
   (ebook PPTX + PDF, `slides/`, `reels/`, `marketing_kit/`), then
   `git add -A && git commit -m "batch NNN: <topic>" && git push origin main`.
   Auth: the git credential helper reads a sandbox secret file —
   the token is **never printed, never committed**.
8. **Report** — topic, file list, QA results, repo URL.

## Environment prerequisites (build sandbox)

- Node 24 with global `pptxgenjs` (`NODE_PATH=/home/z/.npm-global/lib/node_modules`)
- Remotion dependencies installed in `engine/reels` (`node_modules/` is not committed)
- Playwright Chromium for Remotion rendering
- LibreOffice + poppler (`pdftoppm` / `pdftotext`) for PDF QA
- GitHub token at `/home/z/my-project/.secrets/github_token` (chmod 600, outside this repo)
