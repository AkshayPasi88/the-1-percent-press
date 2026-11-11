#!/usr/bin/env python3
"""mix_cinematic.py — professional audio mix for cinematic reels.

  voice (already per-sentence loudnorm'd with emotional dynamics)
  + bed.wav  dark drone/heartbeat at low volume, SIDECHAIN-DUCKED under voice
  + impact/whoosh/riser at scene events (from hype_visuals.json sfx list)
  → public/audio/hype_NN_mix.wav  (final video soundtrack)

Also rewrites hype_props.json so `audio` points at the mixed file.
"""
import json
import os
import subprocess
import sys

ROOT = "/home/z/my-project/scripts/reels"
PROPS = os.path.join(ROOT, "hype_props.json")
VISUALS = os.path.join(ROOT, "hype_visuals.json")
SFX_DIR = os.path.join(ROOT, "public", "sfx")
AUDIO = os.path.join(ROOT, "public", "audio")
SFX_FILE = {"impact": "impact.wav", "whoosh": "whoosh.wav", "riser": "riser.wav"}
SFX_GAIN = {"impact": 0.9, "whoosh": 0.55, "riser": 0.85}  # × event vol


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-800:])
        sys.exit(f"ffmpeg failed: {' '.join(cmd[:6])}…")


def probe(f):
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip())


props = json.load(open(PROPS))
visuals = json.load(open(VISUALS))

for reel in props["reels"]:
    if reel.get("style") != "cinematic":
        continue
    label = reel["file"].replace(".mp4", "")
    voice = os.path.join(AUDIO, f"{label}_voice.wav")  # always the raw emotional voice
    dur = probe(voice)
    events = visuals.get(reel["id"], {}).get("sfx", [])
    bed = os.path.join(SFX_DIR, "bed.wav")
    out = os.path.join(AUDIO, f"{label}_mix.wav")
    print(f"{label}: {dur:.1f}s voice + bed + {len(events)} sfx events")

    # build the filter graph
    inputs = ["-i", voice, "-stream_loop", "-1", "-t", str(dur), "-i", bed]
    filters = []
    mix_labels = ["[v1]"]
    # voice split: one for ducking key, one for the mix
    filters.append("[0:a]asplit=2[v1][vkey]")
    # bed: low volume, ducked under the voice
    filters.append("[1:a]volume=0.30[bedraw]")
    filters.append("[bedraw][vkey]sidechaincompress=threshold=0.02:ratio=8:attack=8:release=220[bedd]")
    mix_labels.append("[bedd]")
    # sfx events: adelay + gain
    for k, ev in enumerate(events):
        wav = SFX_FILE.get(ev["kind"])
        if not wav:
            continue
        inputs += ["-i", os.path.join(SFX_DIR, wav)]
        ms = int(max(0.0, ev["t"]) * 1000)
        vol = round(ev.get("vol", 0.3) * SFX_GAIN.get(ev["kind"], 0.5), 3)
        filters.append(
            f"[{k + 2}:a]adelay={ms}|{ms},volume={vol}[s{k}]")
        mix_labels.append(f"[s{k}]")
    filters.append(
        f"{''.join(mix_labels)}amix=inputs={len(mix_labels)}:duration=first:normalize=0,"
        f"loudnorm=I=-14:TP=-1.2:LRA=11[out]")
    run(["ffmpeg", "-v", "error", "-y", *inputs,
         "-filter_complex", ";".join(filters), "-map", "[out]",
         "-t", str(dur), "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", out])
    # point the reel at the mixed soundtrack
    reel["audio"] = f"audio/{label}_mix.wav"

json.dump(props, open(PROPS, "w"), indent=2)
print("\nmixed soundtracks written; props updated")
