#!/usr/bin/env python3
"""mix.py — procedural sound design + mix for one opuscar reel.

Buses:
  voice  — Fish TTS lines placed on the timeline (from plan.json segments)
  sfx   — impacts / whooshes / risers / subdrops / ticks from events.json (EV)
  music — seeded dark-trap loop (kick/snare/hats/808/pad) with an energy
          envelope from plan.energyMap, ducked under the voice

Out: <film>/out/mix.wav (48 kHz stereo). The final −14 LUFS master is done by
lemo-opuscar's mux.sh (two-pass loudnorm + true-peak limiter).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
FILM = Path(sys.argv[1])
RNG_SEED = int(json.loads((FILM / "plan.json").read_text())["seed"]) & 0x7FFFFFFF
rng = np.random.default_rng(RNG_SEED)


def read_audio(path: Path) -> np.ndarray:
    """decode any input to mono float64 @SR via ffmpeg"""
    wav = path.with_suffix(".tmp.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), str(wav)],
        check=True,
    )
    a, _ = sf.read(wav, dtype="float64")
    if wav.exists():
        wav.unlink()
    return a


def place(bus: np.ndarray, sound: np.ndarray, at: float, gain: float = 1.0):
    i = int(at * SR)
    n = len(sound)
    if i >= len(bus):
        return
    n = min(n, len(bus) - i)
    bus[i : i + n] += sound[:n] * gain


# ————————————————————————————— SFX synthesis ——————————————————————————————

def sfx_impact(gain=1.0, seed=0):
    """Body-hit: sine pitch crash 170→40 Hz + click transient."""
    t = np.arange(int(0.42 * SR)) / SR
    f = 170 * np.exp(-t * 9) + 40
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7)
    click = rng.normal(0, 1, int(0.006 * SR)) * np.exp(-np.arange(int(0.006 * SR)) / SR / 0.0015)
    return (body * 0.9 + np.pad(click, (0, len(body) - len(click)))) * gain


def sfx_whoosh(gain=1.0):
    """Swept noise whoosh — 4 crossfaded bandpass chunks, centre rising."""
    n = int(0.42 * SR)
    out = np.zeros(n)
    chunk = int(0.15 * SR)
    centers = [300, 800, 1800, 3200]
    for k, c in enumerate(centers):
        start = int(k * 0.085 * SR)
        seg = rng.normal(0, 1, chunk)
        spec = np.fft.rfft(seg)
        freqs = np.fft.rfftfreq(chunk, 1 / SR)
        spec *= np.exp(-((freqs - c) ** 2) / (2 * (c * 0.55) ** 2))
        seg = np.fft.irfft(spec, chunk)
        seg /= max(1e-9, np.max(np.abs(seg)))
        env = np.hanning(chunk) * (0.25 + 0.75 * k / 3)
        end = min(n, start + chunk)
        out[start:end] += (seg * env)[: end - start]
    return out * gain


def sfx_riser(gain=1.0):
    """1.15 s noise+sine riser with a rising envelope, hard stop."""
    t = np.arange(int(1.15 * SR)) / SR
    noise = rng.normal(0, 1, len(t))
    spec = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(len(t), 1 / SR)
    spec *= np.exp(-((freqs - 1400) ** 2) / (2 * 900**2))  # airy band
    airy = np.fft.irfft(spec, len(t))
    airy /= max(1e-9, np.max(np.abs(airy)))
    f = 110 * 2 ** (t * 2.6)
    sine = np.sin(2 * np.pi * np.cumsum(f) / SR)
    env = (t / 1.15) ** 2.4
    x = airy * env + sine * env * 0.35
    return x * gain


def sfx_subdrop(gain=1.0):
    t = np.arange(int(0.6 * SR)) / SR
    f = 72 * np.exp(-t * 2.2) + 26
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.0) * gain


def sfx_tick(gain=1.0):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    ping = np.sin(2 * np.pi * 3800 * t) + 0.6 * np.sin(2 * np.pi * 7600 * t)
    return ping * np.exp(-t * 90) * gain


# ————————————————————————————— music ————————————————————————————————————

def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def kick(seed_i):
    t = np.arange(int(0.22 * SR)) / SR
    f = 150 * np.exp(-t * 26) + 42
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    x[: int(0.004 * SR)] += rng.normal(0, 0.5, int(0.004 * SR))
    return x * 1.1


def snare(seed_i):
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n) * np.exp(-t * 28)
    tone = np.sin(2 * np.pi * 200 * t) * np.exp(-t * 42)
    return (noise * 0.7 + tone) * 0.9


def hat(accent):
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    spec = np.fft.rfft(noise)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    spec *= (freqs > 7000)
    x = np.fft.irfft(spec, n) * np.exp(-t * (55 if accent else 85))
    m = max(1e-9, np.max(np.abs(x)))
    return x / m * (0.34 if accent else 0.2)


def bass808(note, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f0 = midi_hz(note)
    glide = f0 * np.concatenate([np.linspace(1.18, 1.0, int(0.05 * SR)), np.ones(n - int(0.05 * SR))])
    ph = 2 * np.pi * np.cumsum(glide) / SR
    x = np.sin(ph)
    x += 0.28 * np.sin(2 * ph)  # 2nd harmonic so it speaks on phone speakers
    env = np.ones(n)
    a = int(0.01 * SR)
    env[:a] = np.linspace(0, 1, a)
    r = int(0.05 * SR)
    env[-r:] *= np.linspace(1, 0, r)
    return x * env * 0.62


def pad_chord(root, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for interval in (0, 3, 7, 12):
        f = midi_hz(root + 12 + interval)
        det = 1 + 0.002 * np.sin(2 * np.pi * 0.3 * t + interval)
        x += np.sin(2 * np.pi * f * det * t) / 4
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.15 * t)
    env = np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.4)
    return x * lfo * env * 0.16


def build_music(dur_total, bpm, root, energy_at):
    """dark motivational loop: kick/snare/hats/808/pad, energy-gated."""
    beat = 60.0 / bpm
    step = beat / 4
    bus = np.zeros(int(dur_total * SR) + SR)
    t_cursor = 0.0
    bar = 0
    riff = [0, 0, 3, -2, 0, 0, -4, -2]
    while t_cursor < dur_total:
        e = energy_at(t_cursor)
        drums = e > 0.6
        # kick: 1, syncopated (2.75/3.5 of a step), and the "and" of beat 2
        kicks = [0.0, (2.75 if bar % 2 else 3.5) * step, 2.5 * beat]
        for kk in kicks:
            if t_cursor + kk < dur_total and drums:
                place(bus, kick(bar), t_cursor + kk, 0.9 * min(1, e + 0.2))
        # snare: 2 & 4
        for s_i in (1, 3):
            if drums:
                place(bus, snare(bar), t_cursor + s_i * beat, 0.6)
        # hats: 16ths w/ seeded accents + occasional double
        for h in range(16):
            if t_cursor + h * step >= dur_total:
                break
            if drums:
                accent = h % 4 == 2 or (h % 7 == 5 and bar % 3 == 1)
                g = (0.9 if accent else 0.55) * (0.8 + 0.2 * e)
                place(bus, hat(accent), t_cursor + h * step, g)
                if h == 14 and bar % 4 == 3:  # trap 32nd fill
                    place(bus, hat(False), t_cursor + h * step + step / 2, 0.5)
        # 808 bass: half-bar notes from the riff
        for half in (0, 1):
            n_idx = (bar * 2 + half) % len(riff)
            note = root - 12 + riff[n_idx]
            b0 = t_cursor + half * beat * 2
            if b0 < dur_total:
                place(bus, bass808(note, beat * 2 * 0.96), b0, 0.9 * min(1, e + 0.35))
        # pad per bar
        place(bus, pad_chord(root, beat * 4), t_cursor, 0.9)
        t_cursor += beat * 4
        bar += 1
    return bus[: int(dur_total * SR)]


# ————————————————————————————— ducking ————————————————————————————————————

def duck_env(voice, sr=SR, attack=0.02, release=0.26):
    env = np.abs(voice)
    # smooth with attack/release
    a_n, r_n = int(attack * sr), int(release * sr)
    kern = np.exp(-np.arange(max(r_n, 2)) / (r_n / 3))
    env = np.convolve(env, kern / np.sum(kern), "same")
    return np.clip(env / (np.percentile(env, 99.5) + 1e-9), 0, 1)


# ————————————————————————————— main ——————————————————————————————————————

def main():
    plan = json.loads((FILM / "plan.json").read_text())
    lines = json.loads((FILM / "voice" / "lines.json").read_text())
    ev = json.loads((FILM / "events.json").read_text())["ev"]
    dur_total = plan["DUR"]
    N = int(dur_total * SR)

    # voice bus — line i sits at segments[i].t0
    voice = np.zeros(N)
    for i, line in enumerate(lines):
        t0 = plan["segments"][i]["t0"]
        a = read_audio(FILM / "voice" / line["file"])
        place(voice, a, t0)
    # trim trailing silence in each line? Fish output is already tight.

    # sfx bus
    sfx = np.zeros(N)
    for e in ev:
        g = e.get("gain", 0.8)
        if e["type"] == "impact":
            place(sfx, sfx_impact(), e["t"], 0.5 * g)
        elif e["type"] == "whoosh":
            place(sfx, sfx_whoosh(), max(0, e["t"] - 0.18), 0.34 * g)
        elif e["type"] == "riser":
            place(sfx, sfx_riser(), e["t"], 0.5 * g)
        elif e["type"] == "subdrop":
            place(sfx, sfx_subdrop(), e["t"], 0.4 * g)
        elif e["type"] == "tick":
            place(sfx, sfx_tick(), e["t"], 0.2 * g)

    # music bus with energy envelope
    def energy_at(t):
        for seg in plan["energyMap"]:
            if seg["t0"] <= t < seg["t1"]:
                return seg["level"]
        return 0.5

    music = build_music(dur_total, plan["bpm"], plan["root"], energy_at)
    # duck under voice
    duck = duck_env(voice)
    music *= (1.0 - 0.62 * duck)
    # voice light compression: soft-knee via tanh on modest drive
    voice = np.tanh(voice * 1.6) / 1.6

    # sum → stereo (voice centred; sfx+music get ~2 ms Haas width)
    mono = voice * 1.0 + sfx * 1.0 + music * 0.85
    D = int(0.002 * SR)
    wide = sfx * 0.35 + music * 0.35
    left = mono + wide * 0.5
    right = mono + np.concatenate([np.zeros(D), wide])[:N] * 0.5
    st = np.stack([left, right], axis=1)
    peak = np.max(np.abs(st))
    if peak > 0:
        st *= min(1.0, 0.92 / peak)

    out = FILM / "out" / "mix.wav"
    sf.write(str(out), st, SR, subtype="PCM_24")
    vrms = 20 * np.log10(np.sqrt(np.mean(voice**2)) + 1e-12)
    print(f"mix.wav → {out}  {dur_total:.1f}s  voice RMS {vrms:.1f} dB  peak {20 * np.log10(peak):.1f} dBFS")


if __name__ == "__main__":
    main()
