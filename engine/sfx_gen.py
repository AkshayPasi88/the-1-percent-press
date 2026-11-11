#!/usr/bin/env python3
"""sfx_gen.py — synthesize the sound-design kit with numpy (no external assets).

  impact.wav  : 55 Hz body hit with exp decay + click   → hook & CTA slams
  whoosh.wav  : swept noise burst                        → scene transitions
  riser.wav   : 1.25 s rising tension bed                → pre-CTA build
  bed.wav     : dark cinematic drone + 85 BPM heartbeat  → music bed (ducked)

All 44.1 kHz mono 16-bit, peak-normalized. Kept subtle so the voice rules.
"""
import numpy as np
import wave
import os

SR = 44100
OUT = "/home/z/my-project/scripts/reels/public/sfx"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def save(name, sig):
    sig = sig / max(1e-9, np.abs(sig).max())  # normalize to 0.99
    pcm = (sig * 0.99 * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  {name}: {len(sig)/SR:.2f}s")


t = lambda dur: np.arange(int(SR * dur)) / SR

# ── impact: sub drop + mid punch + transient click ──────────────────────
d = 0.9
tt = t(d)
impact = (0.85 * np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 5.5)
          + 0.35 * np.sin(2 * np.pi * 110 * tt) * np.exp(-tt * 8)
          + 0.25 * np.sin(2 * np.pi * 1750 * tt) * np.exp(-tt * 45))
save("impact.wav", impact)

# ── whoosh: high-passed noise with a breathing envelope ─────────────────
d = 0.5
tt = t(d)
noise = rng.standard_normal(len(tt))
hp = np.diff(noise, prepend=0)          # crude high-pass → airy band
env = np.sin(np.pi * tt / d) ** 2       # smooth swell in/out
# slight "sweep" feel: rising AM shimmer
shimmer = 0.75 + 0.25 * np.sin(2 * np.pi * 90 * tt) * (tt / d)
whoosh = hp * env * shimmer * 0.4 + noise * env * 0.10
save("whoosh.wav", whoosh)

# ── riser: tension build (rising tone + airy noise, amplitude ramp) ─────
d = 1.25
tt = t(d)
tone = np.sin(2 * np.pi * (200 + 700 * (tt / d) ** 2) * tt)  # accelerating sweep
noise = np.diff(rng.standard_normal(len(tt)), prepend=0)
riser = (tone * 0.22 + noise * 0.5) * (tt / d) ** 2.4
save("riser.wav", riser)

# ── bed: dark drone + 85 BPM heartbeat, ~45 s loopable ───────────────────
d = 45.0
tt = t(d)
lfo = lambda f, p=0: np.sin(2 * np.pi * f * tt + p)
drone = (0.30 * np.sin(2 * np.pi * 55 * tt) * (0.7 + 0.3 * lfo(0.07, 1.1))
         + 0.18 * np.sin(2 * np.pi * 82.4 * tt) * (0.7 + 0.3 * lfo(0.05))
         + 0.12 * np.sin(2 * np.pi * 110.6 * tt) * (0.7 + 0.3 * lfo(0.09, 2.0)))
# heartbeat: soft double-kick every 60/85 s
beat = np.zeros(len(tt))
period = 60.0 / 85.0
for k in range(int(d / period)):
    for off, amp in ((0.0, 0.5), (0.16, 0.3)):     # boom - boom
        i0 = int((k * period + off) * SR)
        n = int(0.30 * SR)
        if i0 + n >= len(beat):
            break
        tau = t(0.30)
        beat[i0:i0 + n] += amp * np.sin(2 * np.pi * 48 * tau) * np.exp(-tau * 16)
air = np.diff(rng.standard_normal(len(tt)), prepend=0) * 0.012
save("bed.wav", drone * 0.7 + beat * 0.8 + air)
print("sfx kit ready →", OUT)
