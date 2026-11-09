// render_all.mjs — bundle the Remotion project once, then render all three
// 9:16 reels (1080×1920, 30fps, h264) into /home/z/my-project/download/reels/.
//
// Usage:  cd /home/z/my-project/scripts/reels && node render_all.mjs
// Content lives in props.json — edit that file, re-run this script.
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const props = JSON.parse(fs.readFileSync(path.join(root, "props.json"), "utf8"));
const entryPoint = path.join(root, "src", "index.ts");
const outDir = "/home/z/my-project/download/reels";
fs.mkdirSync(outDir, { recursive: true });

const BROWSER =
  "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome";

console.log("Bundling Remotion project…");
const serveUrl = await bundle({
  entryPoint,
  publicDir: path.join(root, "public"),
});

const jobs = [
  ["TeaserReel", "teaser_reel.mp4"],
  ["QuoteReel", "quote_reel.mp4"],
  ["ChecklistReel", "checklist_reel.mp4"],
];

for (const [id, file] of jobs) {
  const outputLocation = path.join(outDir, file);
  console.log(`Rendering ${id} -> ${file} …`);
  const composition = await selectComposition({ serveUrl, id, inputProps: props });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 19,
    outputLocation,
    inputProps: props,
  });
  console.log(`Saved ${outputLocation}`);
}

console.log("\nAll reels rendered.");
