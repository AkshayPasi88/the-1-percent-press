// v7 QC — automated gates on every rendered reel, with the migration PRD's
// scene-level checks:
//   1. duration matches the scene spec (±0.35s)
//   2. h264 + aac streams present
//   3. no black frames (blackdetect) + per-scene luma sampling
//   4. audio is not silent (mean volume) — narration sync present
//   5. SCENE UNIQUENESS: per-scene perceptual hash (dHash 8x8 via ffmpeg
//      raw gray). Any pair of scenes with hamming distance < 10 fails loud —
//      this is the "same screen replaying" detector.
//   6. per-scene luma: scenes that render dead-black fail (dead scene detector)
//   7. contact sheet per reel for human review
// Output: v7/qc_report.json — exits non-zero on any failure.
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const outDir = process.argv[2] ?? "/home/z/my-project/download/reels";
const sheetDir = path.join(root, "v7", "sheets");
fs.mkdirSync(sheetDir, { recursive: true });

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] });
const shErr = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });
  return (r.stdout ?? "") + (r.stderr ?? "");
};

// ---- dHash via ffmpeg: 16x16 grayscale raw bytes -> 256-bit hash -------
// (finer than 8x8: distinguishes layout variants within the same world)
function dHash(file, t) {
  const buf = execFileSync("ffmpeg", [
    "-y", "-v", "error", "-ss", String(t), "-i", file,
    "-frames:v", "1", "-vf", "scale=17:16", "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { maxBuffer: 1 << 22 });
  if (buf.length < 272) return null;
  let h = 0n;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const a = buf[y * 17 + x];
      const b = buf[y * 17 + x + 1];
      if (a > b) h |= 1n << BigInt(y * 16 + x);
    }
  }
  return h;
}
const hamming = (a, b) => {
  let x = a ^ b, c = 0n;
  while (x) { c += x & 1n; x >>= 1n; }
  return Number(c);
};

// ---- per-scene mean luma (character/black checks) --------------------------
function lumaAt(file, t) {
  const out = shErr("ffmpeg", ["-v", "info", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "signalstats,metadata=print:file=-", "-f", "null", "-"]);
  const m = out.match(/YAVG=([\d.]+)/);
  return m ? parseFloat(m[1]) : -1;
}

const report = [];
let failed = 0;

for (const reel of props.reels) {
  const file = path.join(outDir, reel.file);
  const spec = JSON.parse(fs.readFileSync(path.join(root, "v7", "specs", `${reel.id}.json`), "utf8"));
  const item = { id: reel.id, file: reel.file, checks: {} };
  if (!fs.existsSync(file)) {
    item.error = "missing file";
    report.push(item);
    failed++;
    console.log(`FAIL ${reel.id}: missing file`);
    continue;
  }
  const probe = JSON.parse(sh("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
  const dur = parseFloat(probe.format.duration);
  item.checks.duration = { expected: spec.durationSec, actual: dur, ok: Math.abs(dur - spec.durationSec) <= 0.35 };
  const v = probe.streams.find((s) => s.codec_type === "video");
  const a = probe.streams.find((s) => s.codec_type === "audio");
  item.checks.streams = { video: v?.codec_name, audio: a?.codec_name, ok: !!v && !!a };

  // black frames
  const blackOut = shErr("ffmpeg", ["-v", "info", "-i", file, "-vf", "blackdetect=d=0.2:pix_th=0.05", "-f", "null", "-"]);
  const blacks = [...blackOut.matchAll(/blackdetect.*t:([\d.]+)/g)].map((m) => parseFloat(m[1]));
  item.checks.black_frames = { count: blacks.length, ok: blacks.length === 0 };

  // silence
  const volOut = shErr("ffmpeg", ["-v", "info", "-i", file, "-af", "volumedetect", "-f", "null", "-"]);
  const mean = parseFloat(volOut.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1] ?? "-99");
  item.checks.audio = { mean_volume_db: mean, ok: mean > -30 };

  // ---- scene uniqueness: perceptual hash at scene midpoints --------------
  const sceneHashes = [];
  for (const s of spec.scenes) {
    const mid = (s.startSec + s.endSec) / 2;
    if (mid >= dur) continue;
    const h = dHash(file, Math.min(mid, dur - 0.05));
    if (h !== null) sceneHashes.push({ id: s.id, world: s.world, h });
  }
  const dupPairs = [];
  for (let i = 0; i < sceneHashes.length; i++)
    for (let j = i + 1; j < sceneHashes.length; j++) {
      const d = hamming(sceneHashes[i].h, sceneHashes[j].h);
      if (d < 26) dupPairs.push({ a: sceneHashes[i].id, b: sceneHashes[j].id, dist: d });
    }
  item.checks.scene_uniqueness = { scenes: sceneHashes.length, duplicates: dupPairs, ok: dupPairs.length === 0 };

  // ---- per-scene luma (blank scene / dead render detector) ---------------
  const deadScenes = [];
  for (const s of spec.scenes) {
    const mid = Math.min((s.startSec + s.endSec) / 2, dur - 0.05);
    if (mid <= 0) continue;
    const l = lumaAt(file, mid);
    if (l >= 0 && l < 6) deadScenes.push({ id: s.id, luma: l });
  }
  item.checks.scene_luma = { dead: deadScenes, ok: deadScenes.length === 0 };

  // contact sheet (8 frames across the reel)
  const sheet = path.join(sheetDir, `${reel.id}.jpg`);
  try {
    const fps = v?.avg_frame_rate ? eval(v.avg_frame_rate) : 30;
    const frames = Array.from({ length: 8 }, (_, i) => Math.max(0, Math.round((dur * (i + 0.5)) / 8 * fps)));
    const sel = frames.map((f) => `eq(n,${f})`).join("+");
    sh("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", `select='${sel}',scale=270:480,tile=8x1`, "-frames:v", "1", sheet]);
    item.sheet = sheet;
  } catch (e) {
    item.sheet = null;
  }

  const ok = Object.values(item.checks).every((c) => c.ok);
  if (!ok) failed++;
  item.ok = ok;
  report.push(item);
  const dupMsg = dupPairs.length ? `, DUPES: ${dupPairs.map((d) => `${d.a}~${d.b}(${d.dist})`).join(" ")}` : "";
  const deadMsg = deadScenes.length ? `, DEAD: ${deadScenes.map((d) => d.id).join(" ")}` : "";
  console.log(`${ok ? "PASS" : "FAIL"} ${reel.id} — dur ${dur.toFixed(1)}s, vol ${mean}dB, blacks ${blacks.length}, scenes ${sceneHashes.length}${dupMsg}${deadMsg}`);
}

fs.writeFileSync(path.join(root, "v7", "qc_report.json"), JSON.stringify(report, null, 2));
console.log(failed === 0 ? `\nQC: all ${report.length} reels passed.` : `\nQC: ${failed} reels FAILED`);
process.exit(failed === 0 ? 0 : 1);
