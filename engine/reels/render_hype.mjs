// render_hype.mjs — render the 10 voiced hype reels (1080×1920, 30fps, h264)
// into /home/z/my-project/download/reels/.
//
// Prereq: run `node ../fish_tts.mjs` first so public/audio/*.mp3 + hype_props.json exist.
// Usage:  cd /home/z/my-project/scripts/reels && node render_hype.mjs [onlyIds...]
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const entryPoint = path.join(root, "src", "index.ts");
const outDir = "/home/z/my-project/download/reels";
fs.mkdirSync(outDir, { recursive: true });

const hype = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const wanted = process.argv.slice(2);

console.log("Bundling Remotion project…");
const serveUrl = await bundle({ entryPoint, publicDir: path.join(root, "public") });

for (let i = 0; i < hype.reels.length; i++) {
  const reel = hype.reels[i];
  const id = `Hype${String(i + 1).padStart(2, "0")}`;
  if (wanted.length && !wanted.includes(id)) continue;
  if (!reel.captions?.length) { console.log(`skip ${id} (no captions — run fish_tts first)`); continue; }
  const outputLocation = path.join(outDir, reel.file);
  console.log(`Rendering ${id} -> ${reel.file} …`);
  const composition = await selectComposition({ serveUrl, id });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 19,
    outputLocation,
    inputProps: { reel, brand: hype.brand },
  });
  console.log(`Saved ${outputLocation}`);
}

console.log("\nAll hype reels rendered.");
