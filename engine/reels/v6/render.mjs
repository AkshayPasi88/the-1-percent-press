// v6 render — bundle once, render every v6 composition (1080×1920, 30fps,
// deterministic), then master in ffmpeg (grain + loudnorm + faststart).
// Usage: node v6/render.mjs [--only 1,2] [--out /dir] [--skip-master]
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const only = flag("--only") ? flag("--only").split(",").map((s) => parseInt(s, 10)) : null;
const outDir = flag("--out") ?? "/home/z/my-project/download/reels";
const master = !args.includes("--skip-master");

fs.mkdirSync(outDir, { recursive: true });
const tmpDir = path.join(root, "v6", "render_tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const BROWSER =
  "/home/z/.cache/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell";
if (!fs.existsSync(BROWSER)) throw new Error("headless chrome not found: " + BROWSER);

console.log("Bundling v6 project…");
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: path.join(root, "public"),
});

const jobs = props.reels
  .map((reel, i) => ({ reel, n: i + 1 }))
  .filter(({ n }) => !only || only.includes(n));

console.log(`Rendering ${jobs.length} reels -> ${outDir}`);
for (const { reel, n } of jobs) {
  const id = `Hype${String(n).padStart(2, "0")}`;
  const spec = JSON.parse(fs.readFileSync(path.join(root, "v6", "specs", `${reel.id}.json`), "utf8"));
  const tmp = path.join(tmpDir, reel.file);
  const final = path.join(outDir, reel.file);
  if (fs.existsSync(final) && !only) {
    console.log(`${id} exists, skip`);
    continue;
  }
  const t0 = Date.now();
  const composition = await selectComposition({ serveUrl, id, inputProps: { spec } });
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    crf: 19,
    inputProps: { spec },
    jpegQuality: 92,
    browserExecutable: BROWSER,
    concurrency: 2,
    outputLocation: tmp,
    onProgress: (prog) => {
      if (Math.round(prog * 20) % 2 === 0) {
        process.stdout.write(`\r  ${id} ${(prog * 100).toFixed(0)}%   `);
      }
    },
  });
  process.stdout.write("\r");
  if (master) {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-v", "error",
        "-i", tmp,
        "-vf", "noise=alls=3:allf=t,format=yuv420p",
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
        "-c:v", "libx264", "-crf", "22", "-maxrate", "8M", "-bufsize", "12M", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
        "-movflags", "+faststart",
        final,
      ],
      { stdio: "inherit" }
    );
    fs.rmSync(tmp, { force: true });
  } else if (tmp !== final) {
    fs.renameSync(tmp, final);
  }
  console.log(`  ${id} ${reel.file} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

console.log("\nv6 render complete.");
