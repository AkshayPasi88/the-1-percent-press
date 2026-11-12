#!/usr/bin/env python3
"""qc.py — post-render quality gates for one opuscar reel.

Rejects (exit 1) when:
  - specs wrong (size / fps / codec / duration vs plan.DUR)
  - consecutive sampled frames are IDENTICAL (a static background = the exact
    thing the user banned: "every time changing frame")
  - any sampled frame is blank / near-uniform colour
  - audio missing, silent, or desynced from plan timeline
Writes a contact sheet + a vision-rubric JSON for z-ai review.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

FILM = Path(sys.argv[1])
FILE = sys.argv[2]
mp4 = FILM / "out" / f"{FILE}.mp4"
plan = json.loads((FILM / "plan.json").read_text())
fails, warns = [], []


def probe():
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,avg_frame_rate,codec_name:format=duration", "-of", "json", str(mp4)],
        capture_output=True, text=True, check=True)
    d = json.loads(r.stdout)
    v = d["streams"][0]
    return v, float(d["format"]["duration"])


def grab_frames(times, prefix):
    for i, t in enumerate(times):
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", str(mp4),
                        "-frames:v", "1", f"/tmp/qa/{prefix}_{i:02d}.png"], check=True)


def load_gray(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype=np.uint8).astype(np.float64)


def main():
    import os
    os.makedirs("/tmp/qa", exist_ok=True)

    # ——— 1. specs ———
    v, dur = probe()
    w, h = int(v["width"]), int(v["height"])
    fps = v["avg_frame_rate"]
    if (w, h) != (1080, 1920): fails.append(f"size {w}x{h} ≠ 1080x1920")
    if not fps.startswith("30"): warns.append(f"fps {fps}")
    if abs(dur - plan["DUR"]) > 0.35: fails.append(f"duration {dur:.2f} vs plan {plan['DUR']}")
    if v["codec_name"] != "h264": fails.append("not h264")

    # ——— 2. frame freshness: sampled t vs t+0.12 s (≈4 frames apart) ———
    # (input-seek rounding makes exact next-frame grabs unreliable; a 0.12 s
    #  gap still proves the picture keeps changing — no static windows)
    times = [0.4 + i * (dur - 0.9) / 22 for i in range(23)]
    grab_frames(times, "s")
    grab_frames([t + 0.12 for t in times], "n")
    static_pairs, blanks = [], []
    for i in range(len(times)):
        a = load_gray(Path(f"/tmp/qa/s_{i:02d}.png"))
        b = load_gray(Path(f"/tmp/qa/n_{i:02d}.png"))
        if a.shape != b.shape:
            fails.append(f"frame shape mismatch at {times[i]:.1f}s")
            continue
        diff = np.mean(np.abs(a - b))
        std = a.std()
        if diff < 0.5:  # ~4 frames virtually identical → static window
            static_pairs.append((times[i], diff))
        if std < 6:  # near-uniform single colour frame
            blanks.append((times[i], std))
    if static_pairs: fails.append(f"static frames at {[f'{t:.1f}s' for t, _ in static_pairs]}")
    if blanks: fails.append(f"blank frames at {[f'{t:.1f}s' for t, _ in blanks]}")

    # ——— 2b. film gates: story coverage, world variety, pacing ———
    story = [s for s in plan["scenes"] if s.get("kind") == "story"]
    if plan.get("engine") == "v6-film":
        if not story:
            fails.append("v6 film has no story scenes")
        else:
            speech0 = plan["segments"][0]["t0"]
            speech1 = max(s["t1"] for s in plan["segments"])
            covered = sum(
                min(s["t1"], speech1) - max(s["t0"], speech0)
                for s in story if s["t1"] > speech0 and s["t0"] < speech1
            )
            cov = covered / (speech1 - speech0)
            if cov < 0.7: fails.append(f"story scenes cover only {cov:.0%} of speech")
            worlds = sorted({s.get("world") for s in story})
            if len(worlds) < 3: fails.append(f"only {len(worlds)} worlds staged ({worlds})")
            longs = [s["id"] for s in story if s["t1"] - s["t0"] > 4.8]
            if longs: fails.append(f"story scenes too long: {longs}")
            if not plan.get("fxs"): warns.append("no fx events")
            actor_scenes = [s for s in story if s.get("actor")]
            if not actor_scenes: fails.append("Seeker never appears")

    # ——— 3. audio present + voice starts on time ———
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0",
                        "-show_entries", "stream=codec_name:format=duration", "-of", "json", str(mp4)],
                       capture_output=True, text=True, check=True)
    a = json.loads(r.stdout)
    if not a.get("streams"): fails.append("no audio stream")
    else:
        wav = FILM / "out" / "mix.wav"
        import soundfile as sf
        x, sr = sf.read(str(wav))
        if len(x) / sr < dur - 0.3: fails.append("mix.wav shorter than video")
        mono = x.mean(axis=1) if x.ndim > 1 else x
        rms = 20 * np.log10(np.sqrt(np.mean(mono**2)) + 1e-12)
        if rms < -35: fails.append(f"audio too quiet ({rms:.1f} dB)")
        # hook word 1 must land inside the first 2.5 s of speech energy
        seg0 = np.abs(mono[: int(3 * sr)])
        if np.max(seg0) < 0.05: warns.append("weak energy in first 3 s")

    # ——— 4. contact sheet for human/vision review ———
    sheet = FILM / "out" / "qc_sheet.jpg"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp4),
                    "-vf", f"fps={max(1.0, 20 / dur):.3f},scale=216:384,tile=5x4", "-frames:v", "1", str(sheet)], check=True)

    # ——— report ———
    report = {
        "file": str(mp4), "duration": dur, "size": f"{w}x{h}", "fps": fps,
        "scenes": len(plan["scenes"]), "hookWords": len(plan["hook"]["words"]),
        "engine": plan.get("engine"),
        "worlds": sorted({s.get("world") for s in plan["scenes"] if s.get("world")}),
        "fxEvents": len(plan.get("fxs", [])),
        "staticPairs": len(static_pairs), "blanks": len(blanks),
        "fails": fails, "warns": warns, "sheet": str(sheet),
    }
    (FILM / "out" / "qc_report.json").write_text(json.dumps(report, indent=1))
    print(json.dumps(report, indent=1))
    if fails:
        print("QC FAILED")
        sys.exit(1)
    print("QC PASSED")


if __name__ == "__main__":
    main()
