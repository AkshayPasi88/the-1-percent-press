// v7 audio probe — deterministic audio analysis for audio-reactive animation.
// Identical algorithm to v6 (ffmpeg decode -> per-frame RMS envelope at 30fps,
// p95-normalised, attack-fast/decay-slow smoothing, onset detection).
// Output: v7/probe/<reelId>.json  (no Remotion, no browser — pure ffmpeg+node)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const props = JSON.parse(fs.readFileSync(path.join(root, "hype_props.json"), "utf8"));
const probeDir = path.join(root, "v7", "probe");
fs.mkdirSync(probeDir, { recursive: true });

const FPS = 30;
const SR = 8000;

function probeFile(file) {
  const buf = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"],
    { maxBuffer: 1 << 28 }
  );
  const n = buf.length / 4;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = buf.readFloatLE(i * 4);
  const spf = SR / FPS;
  const frames = Math.ceil(n / spf);
  const rms = new Array(frames).fill(0);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const a = Math.floor(f * spf);
    const b = Math.min(n, Math.floor((f + 1) * spf));
    for (let i = a; i < b; i++) s += samples[i] * samples[i];
    rms[f] = b > a ? Math.sqrt(s / (b - a)) : 0;
  }
  const sorted = [...rms].sort((x, y) => x - y);
  const p95 = Math.max(1e-6, sorted[Math.floor(sorted.length * 0.95)] || 1);
  let env = rms.map((v) => Math.min(1, v / p95));
  const sm = new Array(frames).fill(0);
  for (let f = 0; f < frames; f++) {
    const prev = f > 0 ? sm[f - 1] : 0;
    sm[f] = env[f] > prev ? env[f] : Math.max(env[f], prev * 0.82);
  }
  env = sm;
  const onsets = [];
  let last = -99;
  for (let f = 2; f < frames; f++) {
    const win = [];
    for (let k = f - 16; k < f; k++) if (k >= 0) win.push(env[k]);
    const mean = win.reduce((a, b) => a + b, 0) / Math.max(1, win.length);
    if (env[f] > 0.16 && env[f] > mean * 1.38 && env[f] >= env[f - 1] && f - last >= 8) {
      onsets.push(f);
      last = f;
    }
  }
  return { envelope: env.map((v) => Math.round(v * 1000) / 1000), onsets };
}

for (const reel of props.reels) {
  const file = path.join(root, "public", reel.audio);
  const out = path.join(probeDir, `${reel.id}.json`);
  const r = probeFile(file);
  fs.writeFileSync(out, JSON.stringify(r));
  console.log(`probe ${reel.id}: ${r.envelope.length} frames, ${r.onsets.length} onsets`);
}
console.log("done");
