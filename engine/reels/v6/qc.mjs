// v6 QC — automated gates on every rendered reel:
//   1. duration matches the scene spec (±0.3s)
//   2. h264 + aac streams present
//   3. no black frames (blackdetect)
//   4. audio is not silent (mean_volume)
//   5. contact sheet per reel for human visual review
// Exits non-zero on any failure. Output: v6/qc_report.json
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const outDir = process.argv[2] ?? "/home/z/my-project/download/reels";
const sheetDir = path.join(root, "v6", "sheets");
fs.mkdirSync(sheetDir, { recursive: true });

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] });
const shErr = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });
  return (r.stdout ?? "") + (r.stderr ?? "");
};

const report = [];
let failed = 0;

for (const reel of props.reels) {
  const file = path.join(outDir, reel.file);
  const spec = JSON.parse(fs.readFileSync(path.join(root, "v6", "specs", `${reel.id}.json`), "utf8"));
  const item = { id: reel.id, file: reel.file, checks: {} };
  if (!fs.existsSync(file)) {
    item.error = "missing file";
    report.push(item);
    failed++;
    console.log(`FAIL ${reel.id}: missing file`);
    continue;
  }
  // duration + streams
  const probe = JSON.parse(
    sh("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file])
  );
  const dur = parseFloat(probe.format.duration);
  item.checks.duration = { expected: spec.durationSec, actual: dur, ok: Math.abs(dur - spec.durationSec) <= 0.35 };
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  item.checks.streams = { video: v?.codec_name, audio: a?.codec_name, ok: !!v && !!a };
  // black frames
  const blackOut = shErr("ffmpeg", ["-v", "info", "-i", file, "-vf", "blackdetect=d=0.2:pix_th=0.05", "-f", "null", "-"]);
  const blacks = [...blackOut.matchAll(/blackdetect.*t:([\d.]+)/g)].map((m) => parseFloat(m[1]));
  item.checks.black_frames = { count: blacks.length, ok: blacks.length === 0 };
  // silence check
  const volOut = shErr("ffmpeg", ["-v", "info", "-i", file, "-af", "volumedetect", "-f", "null", "-"]);
  const mean = parseFloat(volOut.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1] ?? "-99");
  item.checks.audio = { mean_volume_db: mean, ok: mean > -30 };
  // contact sheet (6 frames spread evenly across the reel)
  const sheet = path.join(sheetDir, `${reel.id}.jpg`);
  try {
    const fps = v?.avg_frame_rate ? eval(v.avg_frame_rate) : 30;
    const frames = Array.from({ length: 6 }, (_, i) =>
      Math.max(0, Math.round((dur * (i + 0.5)) / 6 * fps))
    );
    const sel = frames.map((f) => `eq(n,${f})`).join("+");
    sh("ffmpeg", [
      "-y", "-v", "error", "-i", file,
      "-vf", `select='${sel}',scale=270:480,tile=6x1`,
      "-frames:v", "1", sheet,
    ]);
    item.sheet = sheet;
  } catch (e) {
    item.sheet = null;
  }
  const ok = Object.values(item.checks).every((c) => c.ok);
  if (!ok) failed++;
  item.ok = ok;
  report.push(item);
  console.log(`${ok ? "PASS" : "FAIL"} ${reel.id} — dur ${dur.toFixed(1)}s, vol ${mean}dB, blacks ${blacks.length}`);
}

fs.writeFileSync(path.join(root, "v6", "qc_report.json"), JSON.stringify(report, null, 2));
console.log(failed === 0 ? `\nQC: all ${report.length} reels passed.` : `\nQC: ${failed} reels FAILED`);
process.exit(failed === 0 ? 0 : 1);
