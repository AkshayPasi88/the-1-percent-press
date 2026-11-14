// v7 render — renders each built HyperFrames project to MP4, then masters in
// ffmpeg (film grain + EBU R128 loudness + faststart). Includes the required
// reliability features:
//   - `npx hyperframes check` gate before every render (contract violations)
//   - per-scene preview renders (`--scene i`) for fast iteration
//   - failed-scene recovery: qc flags a broken scene -> that scene's HTML is
//     regenerated (variant bump) and ONLY that reel re-rendered
//   - black-frame / silence / duration gates after render (qc.mjs)
// Usage: node v7/render.mjs [--reel 1,2|all] [--reel-id gold_math] [--scene 3]
//                          [--skip-master] [--draft]
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const buildDir = path.join(root, "build");

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const outDir = flag("--out") ?? "/home/z/my-project/download/reels";
const master = !process.argv.includes("--skip-master");
const draft = process.argv.includes("--draft");

const onlyArg = flag("--reel");
const sceneIdx = flag("--scene") !== null ? parseInt(flag("--scene"), 10) : null;
const onlyId = flag("--reel-id");

const jobs = props.reels
  .map((reel, i) => ({ reel, n: i + 1 }))
  .filter(({ reel, n }) => {
    if (onlyId) return reel.id === onlyId;
    if (onlyArg && onlyArg !== "all") return onlyArg.split(",").map(Number).includes(n);
    return true;
  });

fs.mkdirSync(outDir, { recursive: true });

const HF = "npx";
const HF_ARGS = ["--yes", "hyperframes@0.9.40"];
const quality = draft ? "draft" : "looks";

function run(cmd, cwd) {
  const r = spawnSync(cmd.cmd, cmd.args, { cwd, encoding: "utf8", maxBuffer: 1 << 26 });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

for (const { reel, n } of jobs) {
  const projName = sceneIdx !== null ? `${reel.id}-s${sceneIdx}` : reel.id;
  const dir = path.join(buildDir, projName);
  if (!fs.existsSync(path.join(dir, "index.html"))) {
    console.error(`SKIP ${reel.id}: no built project at ${path.relative(root, dir)} (run build.mjs first)`);
    process.exitCode = 1;
    continue;
  }
  const id = `Hype${String(n).padStart(2, "0")}`;

  // ---- contract gate: lint + runtime validation -------------------------
  const check = run({ cmd: HF, args: [...HF_ARGS, "check", "--json"] }, dir);
  let checkErrors = [];
  try {
    const j = JSON.parse(check.out.slice(check.out.indexOf("{")));
    checkErrors = (j.errors || j.lint?.errors || []).map((e) => e.rule || e.message || String(e));
  } catch {
    if (check.code !== 0) checkErrors = ["check command failed"];
  }
  if (check.code !== 0 && checkErrors.length === 0) checkErrors = ["check exited non-zero"];
  if (checkErrors.length) {
    console.error(`FAIL ${id}: hyperframes check reported errors:`);
    checkErrors.slice(0, 12).forEach((e) => console.error("  -", e));
    process.exitCode = 1;
    continue;
  }

  // ---- render ------------------------------------------------------------
  const tmp = path.join(dir, "render_tmp.mp4");
  fs.rmSync(tmp, { force: true });
  const t0 = Date.now();
  const render = run({ cmd: HF, args: [...HF_ARGS, "render", ".", "-f", "30", "-q", quality, "-w", "2", "-o", "render_tmp.mp4"] }, dir);
  if (render.code !== 0 || !fs.existsSync(tmp)) {
    console.error(`FAIL ${id}: render exited non-zero`);
    console.error(render.out.split("\n").filter((l) => /error|fail|✗|Error/i.test(l)).slice(0, 10).join("\n"));
    process.exitCode = 1;
    continue;
  }

  // ---- master (grain + loudness + faststart) ------------------------------
  const final = path.join(outDir, sceneIdx !== null ? `${reel.id}-s${sceneIdx}.mp4` : reel.file);
  if (master) {
    try {
      execFileSync("ffmpeg", [
        "-y", "-v", "error", "-i", tmp,
        "-vf", "noise=alls=3:allf=t,format=yuv420p",
        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
        "-c:v", "libx264", "-crf", "20", "-maxrate", "8M", "-bufsize", "12M", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
        "-movflags", "+faststart",
        final,
      ], { stdio: ["ignore", "ignore", "pipe"] });
      fs.rmSync(tmp, { force: true });
    } catch (e) {
      console.error(`FAIL ${id}: ffmpeg master — ${e.message.split("\n")[0]}`);
      process.exitCode = 1;
      continue;
    }
  } else {
    fs.renameSync(tmp, final);
  }
  console.log(`  ${id} ${path.basename(final)} done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log("v7 render complete.");
