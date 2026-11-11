#!/usr/bin/env node
// cinematic_tts.mjs — EMOTIONAL VOICE ENGINE for cinematic reels.
//
// Instead of one flat TTS pass, every sentence is:
//   1. synthesized separately with its [emotion] tag (shout/angry/sad/fast/
//      whisper/calm/dramatic/serious/motivational/excited/sarcastic),
//   2. time-compressed with ffmpeg `atempo`   → REAL speed variation
//      (fast talk 1.13x, dramatic 0.90x, sad 0.93x, angry 1.07x ...),
//   3. loudness-normalized per emotion        → REAL intensity variation
//      (shout -13.5 LUFS, whisper -20, calm -18 ...),
//   4. joined with emotion-specific pauses     → REAL rhythm variation
//      (dramatic 0.5s, sad 0.4s, fast 0.08s ...).
// Word-level alignment is kept per sentence and offset onto the final
// timeline, so captions stay perfectly synced to the processed audio.
//
// Usage:   node cinematic_tts.mjs [reelNumbers...]   (1-based, default: all cinematic)
// Writes:  scripts/reels/public/audio/hype_NN_voice.wav
//          hype_props.json  (sentences + captions + timing + audio path)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(root, "reels");
const AUDIO_DIR = path.join(SCRIPTS, "public", "audio");
const TMP = path.join(SCRIPTS, ".tts");
const KEY = fs.readFileSync("/home/z/my-project/.secrets/fish_audio_key", "utf8").trim();
fs.mkdirSync(TMP, { recursive: true });

const cfg = JSON.parse(fs.readFileSync(path.join(SCRIPTS, "hype_scripts.json"), "utf8"));

/* per-emotion delivery: speed factor, loudness target (LUFS), pause after (s) */
const EMO = {
  shout:      { s: 1.05, l: -13.5, g: 0.22 },
  angry:      { s: 1.07, l: -15.0, g: 0.16 },
  fast:       { s: 1.13, l: -15.0, g: 0.08 },
  excited:    { s: 1.08, l: -15.0, g: 0.12 },
  motivational: { s: 1.02, l: -15.5, g: 0.20 },
  serious:    { s: 0.98, l: -16.5, g: 0.26 },
  sarcastic:  { s: 1.00, l: -17.0, g: 0.20 },
  calm:       { s: 0.95, l: -18.0, g: 0.30 },
  sad:        { s: 0.93, l: -19.0, g: 0.40 },
  whisper:    { s: 0.94, l: -20.0, g: 0.38 },
  dramatic:   { s: 0.90, l: -17.0, g: 0.50 },
};
const DEF = { s: 1.0, l: -16.0, g: 0.20 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Split the tagged script into sentences. A sentence starts after [.!?] when
    the next token begins with a capital/digit/quote/tag (so "..." inside a
    sentence does not split it). Each sentence carries its leading [tag]. */
function splitSentences(voice) {
  const pieces = voice.split(/(?<=[.!?])\s+(?=[A-Z0-9"[])/);
  return pieces.map((raw) => {
    const m = /^\s*\[([^\]]+)\]\s*/.exec(raw);
    const tag = m ? m[1].trim().toLowerCase() : null;
    const text = (m ? raw.slice(m[0].length) : raw).trim();
    return { tag, text };
  }).filter((s) => s.text);
}

/** Fish TTS with word timestamps (per-chunk offset logic, same as fish_tts). */
async function synthesize(text, referenceId) {
  const res = await fetch("https://api.fish.audio/v1/tts/stream/with-timestamp", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", model: cfg.voice.model },
    body: JSON.stringify({ text, reference_id: referenceId, format: "mp3" }),
  });
  if (!res.ok) throw new Error(`fish ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const raw = await res.text();
  const events = raw.split("\n").filter((l) => l.startsWith("data: "))
    .map((l) => JSON.parse(l.slice(6)))
    .sort((a, b) => (a.chunk_seq ?? 0) - (b.chunk_seq ?? 0));
  const mp3 = Buffer.concat(events.filter((e) => e.audio_base64).map((e) => Buffer.from(e.audio_base64, "base64")));
  const byChunk = new Map();
  for (const e of events) {
    if (!e.alignment?.segments?.length) continue;
    byChunk.set(e.chunk_seq ?? 0, e);
  }
  const words = [];
  for (const e of byChunk.values()) {
    const off = e.chunk_audio_offset_sec ?? 0;
    for (const s of e.alignment.segments) words.push({ text: s.text, start: s.start + off, end: s.end + off });
  }
  return { mp3, words };
}

const probe = (f) => parseFloat(execFileSync("ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

/** Synthesize one sentence → speed/loudness-processed wav + scaled word times. */
async function synthSentence(idx, tag, text, refId) {
  const e = EMO[tag] ?? DEF;
  let result = null;
  const payload = `[${tag ?? "motivational"}] ${text}`;
  for (let attempt = 1; attempt <= 3 && !result; attempt++) {
    try { result = await synthesize(payload, refId); }
    catch (err) {
      if (attempt === 3) throw err;
      console.error(`  retry ${attempt}: ${err.message.slice(0, 80)}`);
      await sleep(4000 * attempt);
    }
  }
  await sleep(1200); // fair-use pacing
  const mp3Path = path.join(TMP, `s${idx}.mp3`);
  fs.writeFileSync(mp3Path, result.mp3);
  const wavPath = path.join(TMP, `s${idx}.wav`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", mp3Path,
    "-af", `atempo=${e.s},loudnorm=I=${e.l}:TP=-1.5:LRA=11`,
    "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", wavPath]);
  const dur = probe(wavPath);
  if (!dur || dur < 0.3) throw new Error(`bad sentence wav ${idx} (dur=${dur})`);
  const expected = text.split(/\s+/).filter(Boolean).length;
  if (result.words.length < Math.floor(expected * 0.8)) {
    throw new Error(`alignment incomplete s${idx}: ${result.words.length}/${expected}`);
  }
  const words = result.words.map((w) => ({
    text: w.text,
    start: Math.min(w.start / e.s, Math.max(0, dur - 0.04)),
    end: Math.min(w.end / e.s, dur),
  }));
  return { wavPath, dur, words };
}

/** Caption groups: split at pauses > 0.35 s or every 4 words. */
function groupCaptions(words) {
  const groups = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
  };
  for (const w of words) {
    if (cur.length && w.start - cur[cur.length - 1].end > 0.35) flush();
    cur.push(w);
    if (cur.length >= 4) flush();
  }
  flush();
  return groups;
}

const picks = cfg.reels.filter((r) => r.style === "cinematic");
const only = process.argv.slice(2).map(Number).filter(Boolean);
const run = only.length ? picks.filter((_, i) => only.includes(i + 1)) : picks;

for (const reel of run) {
  const idx = cfg.reels.indexOf(reel) + 1;
  const label = `hype_${String(idx).padStart(2, "0")}`;
  console.log(`[${label}] "${reel.name}"`);
  const sents = splitSentences(reel.voice);
  console.log(`  ${sents.length} sentences: ${sents.map((s) => s.tag).join(", ")}`);

  // 1) synthesize every sentence with its emotion
  const synthed = [];
  for (let i = 0; i < sents.length; i++) {
    const s = synthSentence(i, sents[i].tag, sents[i].text, cfg.voice.reference_id);
    synthed.push(await s);
    process.stdout.write(`  s${i} [${sents[i].tag}] ${synthed[i].dur.toFixed(2)}s\n`);
  }

  // 2) lay them on the timeline with emotion pauses
  const SENT0 = 0.15; // fast attack: first sound lands almost immediately
  let t = SENT0;
  const sentences = [];
  const allWords = [];
  for (let i = 0; i < sents.length; i++) {
    const e = EMO[sents[i].tag] ?? DEF;
    const start = t;
    const end = start + synthed[i].dur;
    const words = synthed[i].words.map((w) => ({
      text: w.text, start: +(start + w.start).toFixed(3), end: +(start + w.end).toFixed(3),
    }));
    allWords.push(...words);
    sentences.push({ text: sents[i].text, emotion: sents[i].tag ?? "motivational", start: +start.toFixed(3), end: +end.toFixed(3), words });
    t = end + e.g;
  }
  const total = +(t + 0.25).toFixed(3);

  // 3) concat: sentence wavs + gap silences → voice.wav
  const list = [];
  for (let i = 0; i < sents.length; i++) {
    list.push(synthed[i].wavPath);
    if (i < sents.length - 1) {
      const e = EMO[sents[i].tag] ?? DEF;
      const gapPath = path.join(TMP, `gap${i}.wav`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
        "-t", String(e.g), "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", gapPath]);
      list.push(gapPath);
    }
  }
  const listFile = path.join(TMP, "list.txt");
  fs.writeFileSync(listFile, list.map((f) => `file '${f}'`).join("\n"));
  const voiceWav = path.join(AUDIO_DIR, `${label}_voice.wav`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile,
    "-c:a", "pcm_s16le", voiceWav]);
  const finalDur = probe(voiceWav);

  // 4) timing metadata
  const hookEndSec = Math.min(Math.max(sentences[0].end + 0.15, 1.2), 3.2);
  const speechEndSec = sentences[sentences.length - 1].end;
  const captions = groupCaptions(allWords).map((g) => ({
    start: +g.start.toFixed(3), end: +g.end.toFixed(3),
    words: g.words.map((w) => ({ text: w.text, start: +w.start.toFixed(3), end: +w.end.toFixed(3), display: w.text })),
  }));

  // 5) merge into hype_props.json
  const propsPath = path.join(SCRIPTS, "hype_props.json");
  let existing = { brand: cfg.brand, reels: [] };
  try { existing = JSON.parse(fs.readFileSync(propsPath, "utf8")); } catch {}
  const entry = {
    ...reel,
    audio: `audio/${label}_voice.wav`,
    hookEndSec, ctaStartSec: +(speechEndSec + 0.12).toFixed(3),
    audioDurationSec: +finalDur.toFixed(3), speechEndSec,
    captions, sentences,
  };
  existing.reels = cfg.reels.map((r) =>
    r.id === reel.id ? entry : (existing.reels.find((o) => o.id === r.id) ?? r));
  fs.writeFileSync(propsPath, JSON.stringify(existing, null, 2));
  console.log(`  → ${label}_voice.wav ${finalDur.toFixed(1)}s · ${sents.length} emotions · ${allWords.length} words`);
}
console.log("\nEmotional voice pass complete.");
