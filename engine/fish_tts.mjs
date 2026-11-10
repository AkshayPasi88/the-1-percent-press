#!/usr/bin/env node
// fish_tts.mjs — generate voiced audio for hype reels via Fish Audio
// s2.1-pro-free + male reference voice "Adrian", using the
// /v1/tts/stream/with-timestamp endpoint so we get word-level alignment
// for perfectly synced karaoke captions.
//
// Usage:
//   node fish_tts.mjs            → all reels in hype_scripts.json
//   node fish_tts.mjs 1 4        → only reels #1 and #4 (1-based)
//
// Reads  : scripts/reels/hype_scripts.json
// Writes : scripts/reels/public/audio/hype_NN.mp3
//          scripts/reels/hype_props.json  (captions + timing for Remotion)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(root, "reels");
const AUDIO_DIR = path.join(SCRIPTS, "public", "audio");
const KEY = fs.readFileSync("/home/z/my-project/.secrets/fish_audio_key", "utf8").trim();

const cfg = JSON.parse(fs.readFileSync(path.join(SCRIPTS, "hype_scripts.json"), "utf8"));
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const only = process.argv.slice(2).map(Number).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Strip [emotion] tags from voice text. */
const cleanVoice = (t) => t.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();

/** Call Fish Audio TTS-with-timestamps; return {mp3: Buffer, words: [{text,start,end}]}. */
async function synthesize(text, referenceId) {
  const res = await fetch("https://api.fish.audio/v1/tts/stream/with-timestamp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      model: cfg.voice.model,
    },
    body: JSON.stringify({ text, reference_id: referenceId, format: cfg.voice.format }),
  });
  if (!res.ok) throw new Error(`fish ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const raw = await res.text();
  const events = raw
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)))
    .sort((a, b) => (a.chunk_seq ?? 0) - (b.chunk_seq ?? 0));

  // Audio: concat base64 chunks in chunk order.
  const mp3 = Buffer.concat(events.filter((e) => e.audio_base64).map((e) => Buffer.from(e.audio_base64, "base64")));

  // Alignment: the API sends a CUMULATIVE alignment — each SSE event repeats all
  // words spoken so far, so the LAST event with alignment carries the complete
  // list. Verify against the expected word count; fall back to per-chunk merge.
  let words = [];
  const withAlign = events.filter((e) => e.alignment?.segments?.length);
  if (withAlign.length) {
    const expected = cleanVoice(text).split(/\s+/).filter(Boolean).length;
    const last = withAlign[withAlign.length - 1];
    const best = last.alignment.segments.length >= expected * 0.8 ? last : null;
    if (best) {
      words = best.alignment.segments.map((s) => ({ text: s.text, start: s.start, end: s.end }));
    } else {
      for (const e of withAlign) {
        const off = e.chunk_audio_offset_sec ?? 0;
        for (const s of e.alignment.segments)
          words.push({ text: s.text, start: s.start + off, end: s.end + off });
      }
    }
  }
  if (!words.length) throw new Error("no word alignment in response");
  return { mp3, words };
}

/** Group words into caption chunks: split at natural pauses (>0.32s gap) or every 4 words. */
function groupCaptions(words) {
  const groups = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (cur.length && w.start - cur[cur.length - 1].end > 0.32) flush();
    cur.push(w);
    if (cur.length >= 4) flush();
  }
  flush();
  return groups;
}

/** Apply display overrides + uppercase-agnostic word cleanup. */
function displayWord(word, overrides) {
  const bare = word.text.toLowerCase().replace(/[.,!?;:]+$/, "");
  if (overrides[bare]) return overrides[bare];
  return word.text;
}

const outReels = [];
const picks = only.length
  ? cfg.reels.filter((_, i) => only.includes(i + 1))
  : cfg.reels;

for (const reel of picks) {
  const idx = cfg.reels.indexOf(reel) + 1;
  const label = `hype_${String(idx).padStart(2, "0")}`;
  process.stdout.write(`[${label}] "${reel.name}" … `);
  const text = cleanVoice(reel.voice);

  let result = null;
  for (let attempt = 1; attempt <= 3 && !result; attempt++) {
    try {
      result = await synthesize(reel.voice, cfg.voice.reference_id);
    } catch (err) {
      if (attempt === 3) throw err;
      console.error(`retry ${attempt}: ${err.message}`);
      await sleep(4000 * attempt);
    }
  }
  await sleep(1500); // fair-use pacing

  const mp3Path = path.join(AUDIO_DIR, `${label}.mp3`);
  fs.writeFileSync(mp3Path, result.mp3);

  // Validate + measure the real duration with ffprobe.
  const dur = parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3Path], { encoding: "utf8" }).trim()
  );
  if (!dur || dur < 1) throw new Error(`bad mp3 for ${label} (dur=${dur})`);

  const words = result.words;
  const groups = groupCaptions(words).map((g) => ({
    start: +g.start.toFixed(3),
    end: +g.end.toFixed(3),
    words: g.words.map((w) => ({
      text: w.text,
      start: +w.start.toFixed(3),
      end: +w.end.toFixed(3),
      display: displayWord(w, reel.wordOverrides || {}),
    })),
  }));

  // hook ends at the first natural sentence pause (word gap > 0.42s);
  // CTA starts one group before the "ebook/guide" mention near the end.
  let hookEndSec = groups.length > 1 ? groups[1].end : 2.5;
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i + 1].start - words[i].end > 0.42) { hookEndSec = words[i].end + 0.12; break; }
  }
  let ctaIdx = -1;
  for (let i = groups.length - 1; i >= 0; i--) {
    const t = groups[i].words.map((w) => w.text).join(" ").toLowerCase();
    if (/ebook|guide|link in bio/.test(t)) { ctaIdx = i; break; }
  }
  if (ctaIdx > 0) {
    const prev = groups[ctaIdx - 1].words.map((w) => w.text).join(" ").toLowerCase();
    if (/free|method|tracker|rule|inside|climate/.test(prev)) ctaIdx--;
  }
  const ctaStartSec = ctaIdx >= 0 ? Math.max(0, groups[ctaIdx].start - 0.2) : Math.max(0, dur - 2.5);

  const lastEnd = result.words[result.words.length - 1].end;
  outReels.push({
    ...reel,
    hookEndSec: +hookEndSec.toFixed(3),
    ctaStartSec: +ctaStartSec.toFixed(3),
    audioDurationSec: +dur.toFixed(3),
    speechEndSec: +lastEnd.toFixed(3),
    captions: groups,
  });

  const wps = (result.words.length / dur).toFixed(2);
  console.log(`${dur.toFixed(1)}s · ${result.words.length} words · ${wps} w/s · ${groups.length} caption groups`);
}

// Merge into hype_props.json (keep entries for reels we did not regenerate).
const propsPath = path.join(SCRIPTS, "hype_props.json");
let existing = { brand: cfg.brand, reels: [] };
try {
  existing = JSON.parse(fs.readFileSync(propsPath, "utf8"));
} catch {}
const merged = { brand: cfg.brand, reels: cfg.reels.map((r) => outReels.find((o) => o.id === r.id) || existing.reels.find((o) => o.id === r.id) || r) };
fs.writeFileSync(propsPath, JSON.stringify(merged, null, 2));
console.log(`\nWrote ${propsPath} (${merged.reels.length} reels)`);
