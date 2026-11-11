#!/usr/bin/env node
// voice.mjs — emotional per-sentence Fish Audio TTS for opuscar reels.
// s2.1 supports NATURAL-LANGUAGE [bracket] emotion control (docs.fish.audio):
// tags at sentence start, one emotion per sentence, e.g. [shouting], [whispering].
// Per line we synthesize separately → real, audible emotional variety.
//
// Writes: <film>/voice/lines.json — [{id,text,delivery,file,dur,words:[{text,t0,t1}]}]
//         <film>/voice/NN.mp3
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const KEY = fs.readFileSync("/home/z/my-project/.secrets/fish_audio_key", "utf8").trim();
const MODEL = "s2.1-pro-free";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One Fish TTS call with word timestamps. text includes [emotion] tags.
 *  prosody: {speed: 0.5..2, volume} — real API-side pace control. */
async function synthesize(text, referenceId, prosody = null, attempt = 1) {
  const body = { text, reference_id: referenceId, format: "mp3" };
  if (prosody) body.prosody = prosody;
  const res = await fetch("https://api.fish.audio/v1/tts/stream/with-timestamp", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", model: MODEL },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && attempt <= 4) {
    const wait = 6000 * attempt;
    console.error(`  429 → waiting ${wait / 1000}s (attempt ${attempt})`);
    await sleep(wait);
    return synthesize(text, referenceId, prosody, attempt + 1);
  }
  if (!res.ok) throw new Error(`fish ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const raw = await res.text();
  const events = raw.split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
  const mp3 = Buffer.concat(events.filter((e) => e.audio_base64).map((e) => Buffer.from(e.audio_base64, "base64")));
  // alignment: per chunk_seq keep the LAST event (cumulative within chunk),
  // then shift by chunk_audio_offset_sec for absolute times.
  const byChunk = new Map();
  for (const e of events) {
    if (!e.alignment?.segments?.length) continue;
    byChunk.set(e.chunk_seq ?? 0, e);
  }
  const words = [];
  for (const e of byChunk.values()) {
    const off = e.chunk_audio_offset_sec ?? 0;
    for (const s of e.alignment.segments) words.push({ text: s.text, t0: s.start + off, t1: s.end + off });
  }
  const spoken = text.replace(/\[[^\]]*\]/g, "").split(/\s+/).filter(Boolean).length;
  if (words.length < Math.floor(spoken * 0.8)) throw new Error(`alignment incomplete: ${words.length}/${spoken}`);
  if (mp3.length < 2000) throw new Error("no audio returned");
  return { mp3, words };
}

/**
 * Voice a film. film = { dir, sentences:[{text, delivery}], reference_id }
 */
export async function voiceFilm(film) {
  const vdir = path.join(film.dir, "voice");
  fs.mkdirSync(vdir, { recursive: true });
  const lines = [];
  for (let i = 0; i < film.sentences.length; i++) {
    const s = film.sentences[i];
    const id = String(i + 1).padStart(2, "0");
    const file = path.join(vdir, `${id}.mp3`);
    const hasCache = fs.existsSync(file) && fs.existsSync(path.join(vdir, "lines.json"));
    if (hasCache && !process.env.FRESH_VOICE) {
      const prev = JSON.parse(fs.readFileSync(path.join(vdir, "lines.json"), "utf8"));
      const p = prev[i];
      console.log(`  [${id}] cached ${p.delivery}`);
      s._words = p.words;
      s._dur = p.dur;
      lines.push({ id, text: s.text, delivery: p.delivery, file: `${id}.mp3`, dur: p.dur, words: p.words });
      continue;
    }
      process.stdout.write(`  [${id}] ${s.delivery} … `);
      const tag = `[${s.delivery}] ${s.text}`;
      let out = null;
      for (let a = 1; a <= 3 && !out; a++) {
        try {
          out = await synthesize(tag, film.reference_id, s.speed ? { speed: s.speed } : null);
        } catch (err) {
          if (a === 3) throw err;
          console.error(`retry ${a}: ${err.message}`);
          await sleep(3500 * a);
        }
      }
      fs.writeFileSync(file, out.mp3);
      await sleep(1400); // fair-use pacing on the free tier
      console.log(`${out.words.length} words`);
      const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" }).trim());
      s._words = out.words;
      s._dur = dur;
      lines.push({ id, text: s.text, delivery: s.delivery, file: `${id}.mp3`, dur: s._dur, words: s._words });
  }
  fs.writeFileSync(path.join(vdir, "lines.json"), JSON.stringify(lines, null, 1));
  return lines;
}

// CLI: node voice.mjs <probe> "<text>" — sanity probe used by build
if (process.argv[2] === "probe") {
  const text = process.argv[3] || "[shouting] Test one two.";
  const ref = process.argv[4] || "bf322df2096a46f18c579d0baa36f41d";
  const pros = process.argv[5] ? { speed: parseFloat(process.argv[5]) } : null;
  const out = await synthesize(text, ref, pros);
  console.log(`ok: ${Math.round(out.mp3.length / 1024)}KB, ${out.words.length} words, first="${out.words[0]?.text}"`);
}
