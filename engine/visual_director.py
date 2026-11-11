#!/usr/bin/env python3
"""Visual Director — the AI director for the Dynamic Centre Visual Engine.

Two modes:
  1) --fetch [--only id,id,...]   network mode: run image searches (z-ai
     image-search), download + validate candidates, write manifest.json with
     source attribution.
  2) (default)                    local mode: build hype_visuals.json — a per-reel
     visual timeline of scenes (main text + image + palette + word timings)
     plus beat markers (audio onset detection merged with narration word
     starts). Reads hype_props.json (word timings) + manifest.json.

Every reel in hype_props.json gets an entry. Reels with curated specs get
hand-tuned scenes; unknown reels (future weekly cron) get auto-generated
scenes via sentence split + keyword extraction, with kinetic-typography
fallback when no image is available — the centre is never empty.
"""
import json
import os
import re
import subprocess
import sys
import random
import hashlib
import io
from concurrent.futures import ThreadPoolExecutor

ROOT = "/home/z/my-project/scripts/reels"
PROPS = os.path.join(ROOT, "hype_props.json")
IMG_DIR = os.path.join(ROOT, "public", "img")
MANIFEST = os.path.join(IMG_DIR, "manifest.json")
OUT = os.path.join(ROOT, "hype_visuals.json")

# ── Curated scene specs ─────────────────────────────────────────────────
# phrase  : contiguous words in the narration (punctuation/hyphens ignored)
# text    : centre main text (kinetic typography), ALL-CAPS
# stat    : optional big animated counter instead of text
# slug    : image file name (manifest key "reel/slug")
# query   : image search sentence (natural language)
# cat     : content category → background palette
CURATED = {
    "gold_math": [
        {"phrase": "one percent better every day for one year",
         "text": "1% BETTER. EVERY DAY.", "slug": "climbing",
         "query": "silhouette of a person climbing steep stairs at sunrise determination",
         "cat": "path"},
        {"phrase": "not one percent total thirty seven times better",
         "stat": {"prefix": "×", "to": 37.78, "decimals": 2}, "slug": "curve",
         "query": "exponential growth curve chart rising line dark background",
         "cat": "math"},
    ],
    "mono_weather": [
        {"phrase": "motivation is weather",
         "text": "MOTIVATION = WEATHER", "slug": "storm",
         "query": "dramatic dark storm clouds over a moody landscape",
         "cat": "nature"},
        {"phrase": "systems are climate build the climate",
         "text": "SYSTEMS = CLIMATE", "slug": "calm",
         "query": "calm mountain lake at dawn with serene horizon",
         "cat": "nature"},
    ],
    "lime_2min": [
        {"phrase": "shrink it to two minutes",
         "text": "SHRINK IT TO 2 MINUTES", "slug": "timer",
         "query": "minimal kitchen countdown timer close up on table",
         "cat": "timer"},
        {"phrase": "two minutes is a vote",
         "text": "2 MINUTES = 1 VOTE", "slug": "ballot",
         "query": "hand casting a vote ballot paper into a ballot box",
         "cat": "vote"},
    ],
    "crimson_twice": [
        {"phrase": "missed today fine",
         "text": "MISSED TODAY? FINE.", "slug": "calendar",
         "query": "desk calendar page with a red circle around a missed day",
         "cat": "calendar"},
        {"phrase": "never miss twice that is the rule",
         "text": "NEVER MISS TWICE.", "slug": "chain",
         "query": "heavy steel chain links close up on dark background",
         "cat": "calendar"},
    ],
    "ocean_votes": [
        {"phrase": "every action is a vote for the person you are becoming",
         "text": "EVERY ACTION = A VOTE", "slug": "ballotbox",
         "query": "wooden ballot box with voting slips election",
         "cat": "vote"},
        {"phrase": "cast cheap votes daily",
         "text": "CAST CHEAP VOTES. DAILY.", "slug": "steps",
         "query": "person walking up a long staircase seen from below",
         "cat": "path"},
    ],
    "steel_env": [
        {"phrase": "discipline is not willpower it is furniture",
         "text": "DISCIPLINE IS FURNITURE", "slug": "interior",
         "query": "minimalist living room interior with clean furniture design",
         "cat": "room"},
        {"phrase": "fruit on the counter phone in the drawer",
         "text": "FRUIT OUT. PHONE AWAY.", "slug": "fruit",
         "query": "bowl of fresh fruit on a bright kitchen counter",
         "cat": "room"},
        {"phrase": "design the room",
         "text": "DESIGN THE ROOM.", "slug": "blueprint",
         "query": "architect blueprint sketches and pencil on a desk",
         "cat": "room"},
    ],
    "forest_chain": [
        {"phrase": "day one day two day three",
         "text": "DAY 1. DAY 2. DAY 3.", "slug": "tracker",
         "query": "habit tracker calendar with a marked streak of days",
         "cat": "calendar"},
        {"phrase": "do not break the chain",
         "text": "DON'T BREAK THE CHAIN.", "slug": "chainlink",
         "query": "unbroken iron chain links macro photography dark",
         "cat": "calendar"},
    ],
    "coral_decade": [
        {"phrase": "tiny gains are invisible in a day",
         "text": "INVISIBLE IN A DAY.", "slug": "seedling",
         "query": "tiny green seedling sprouting from soil macro shot",
         "cat": "nature"},
        {"phrase": "undeniable in a decade",
         "text": "UNDENIABLE IN A DECADE.", "slug": "oak",
         "query": "majestic giant oak tree standing alone in a field",
         "cat": "nature"},
    ],
    "violet_monday": [
        {"phrase": "stop waiting for monday",
         "text": "STOP WAITING FOR MONDAY.", "slug": "monday",
         "query": "desk calendar with monday page circled in red pen",
         "cat": "calendar"},
        {"phrase": "two minutes right now",
         "text": "2 MINUTES. RIGHT NOW.", "slug": "stopwatch",
         "query": "stopwatch showing two minutes close up dramatic light",
         "cat": "timer"},
    ],
    "sunset_onepct": [
        {"phrase": "you do not need more motivation",
         "text": "NOT MORE MOTIVATION.", "slug": "couch",
         "query": "young man lying on couch bored scrolling his phone",
         "cat": "emotional"},
        {"phrase": "you need one percent",
         "stat": {"to": 1, "suffix": "%", "label": "IS ALL YOU NEED"}, "slug": "sunrise",
         "query": "runner tying shoes starting a run at sunrise",
         "cat": "path"},
    ],
    "gold_plateau": [
        {"phrase": "day twenty and it still looks like nothing this is where everybody quits",
         "text": "DAY 20. STILL NOTHING.", "slug": "road",
         "query": "empty desert highway road stretching to the horizon",
         "cat": "path"},
        {"phrase": "the workout that changes nothing",
         "text": "THE WORKOUT.", "slug": "gym",
         "query": "dumbbells on a rack in a dark moody gym",
         "cat": "workout"},
        {"phrase": "the page nobody reads the ten dollars that buys nothing",
         "text": "THE PAGE. THE $10.", "slug": "money",
         "query": "stack of hundred dollar bills close up dark",
         "cat": "math"},
        {"phrase": "but one percent compounds quietly and the results always lag the work",
         "text": "RESULTS LAG THE WORK.", "slug": "iceberg",
         "query": "iceberg above and below the water surface",
         "cat": "math"},
        {"phrase": "then one tuesday the curve bends and everyone calls it luck",
         "text": "ONE TUESDAY, THE CURVE BENDS.", "slug": "hockey",
         "query": "hockey stick exponential growth chart rising sharply",
         "cat": "math"},
        {"phrase": "it was not luck it was math",
         "text": "NOT LUCK. MATH.", "slug": "chalk",
         "query": "mathematics equations written on a dark chalkboard",
         "cat": "math"},
    ],
    "ocean_identity": [
        {"phrase": "you do not rise to your goals you fall to your systems",
         "text": "YOU FALL TO YOUR SYSTEMS.", "slug": "stairs",
         "query": "person climbing stairs upward into dramatic light",
         "cat": "path"},
        {"phrase": "you become what you repeat",
         "text": "YOU BECOME WHAT YOU REPEAT.", "slug": "mirror",
         "query": "silhouette of a person looking at his reflection in a mirror",
         "cat": "identity"},
        {"phrase": "read one page you are a reader",
         "text": "1 PAGE = A READER.", "slug": "book",
         "query": "open book with a warm reading lamp on a desk at night",
         "cat": "reading"},
        {"phrase": "train once a week you are training show up daily you are reliable",
         "text": "SHOW UP DAILY.", "slug": "athlete",
         "query": "athlete training silhouette in gym at sunrise",
         "cat": "workout"},
        {"phrase": "nobody feels the shift on day one",
         "text": "NOBODY FEELS DAY ONE.", "slug": "path",
         "query": "person walking a long path journey forward",
         "cat": "path"},
        {"phrase": "but three hundred votes later you are a different person",
         "stat": {"to": 300, "label": "VOTES LATER"}, "slug": None,
         "cat": "identity"},
        {"phrase": "and it started with one tiny rep cast the first vote today",
         "text": "START WITH ONE REP.", "slug": "domino",
         "query": "first domino falling and starting a chain reaction",
         "cat": "math"},
    ],
}

# ── Cinematic reels: one visual plan per SENTENCE (index-aligned) ──────
# text   : the section headline (ALL-CAPS punch line for that sentence)
# slug/query: footage for that sentence
CURATED_CINEMATIC = {
    "onyx_rescue": [
        {"text": "NOBODY IS COMING TO SAVE YOU.", "slug": "rooftop",
         "query": "lone man silhouette standing on rooftop overlooking city at night"},
        {"text": "THE BEST THING YOU'LL EVER UNDERSTAND.", "slug": "stormcity",
         "query": "dramatic storm clouds and lightning over a city at night"},
        {"text": "STOP WAITING.", "slug": "road",
         "query": "man walking alone on empty road at night in fog"},
        {"text": "NOBODY ELSE WILL BELIEVE IN YOU.", "slug": "bench",
         "query": "person sitting alone on a bench at night under a streetlight"},
        {"text": "YOUR FUTURE. YOUR RESPONSIBILITY.", "slug": "walker",
         "query": "determined man walking forward portrait dark moody lighting"},
        {"text": "NOBODY ELSE'S.", "slug": "mirror",
         "query": "man looking at his own reflection in a dark mirror"},
        {"text": "WHILE THEY SLEEP ON THEIR DREAMS...", "slug": "window",
         "query": "single lit window in dark apartment building at night"},
        {"text": "WORK ON YOURS!", "slug": "nightdesk",
         "query": "person working late at a desk with a lamp at night"},
        {"text": "NO MORE EXCUSES...", "slug": "fists",
         "query": "clenched fists close up determination dark lighting"},
        {"text": "TAKE ACTION!", "slug": "dawnrun",
         "query": "runner running alone on empty city street before sunrise"},
        {"text": "YOU DON'T NEED TO BE THE BEST.", "slug": "ocean",
         "query": "calm ocean horizon before sunrise soft moody light"},
        {"text": "BETTER THAN YESTERDAY.", "slug": "barbell",
         "query": "athlete lifting heavy barbell in dark gym dramatic lighting"},
        {"text": "ONE DAY...", "slug": "candle",
         "query": "single candle flame burning in the darkness close up"},
        {"text": "DISCIPLINE WILL INTRODUCE YOU.", "slug": "chess",
         "query": "chess king piece close up on dark board dramatic light"},
        {"text": "WHERE YOUR EXCUSES HELD YOU BACK!", "slug": "summit",
         "query": "silhouette of person standing on mountain summit at sunrise"},
    ],
    "iron_pain": [
        {"text": "PAIN EITHER WAY.", "slug": "wraps",
         "query": "boxer wrapping his hands in a dark gym dramatic light"},
        {"text": "DISCIPLINE... OR REGRET.", "slug": "corner",
         "query": "boxer sitting alone in the corner of a dark boxing ring"},
        {"text": "DISCIPLINE HURTS FOR MINUTES.", "slug": "bag",
         "query": "boxer hitting a punching bag with sweat in dark gym"},
        {"text": "REGRET HURTS FOR YEARS.", "slug": "rainman",
         "query": "sad man standing alone in the rain at night silhouette"},
        {"text": "CHOOSE YOUR PAIN.", "slug": "gloves",
         "query": "boxing gloves close up hanging in dark gym"},
        {"text": "NOBODY SEES THE 5AM ALARMS.", "slug": "alarm",
         "query": "alarm clock in a dark bedroom early morning"},
        {"text": "NOBODY CLAPS FOR THE BORING DAYS.", "slug": "emptygym",
         "query": "empty dark gym with a single spotlight on the floor"},
        {"text": "THAT'S WHERE RESULTS LIVE.", "slug": "plates",
         "query": "barbell with weight plates close up in gym"},
        {"text": "EVERY REP...", "slug": "scream",
         "query": "athlete screaming with intensity during workout in gym"},
        {"text": "IT COMPOUNDS.", "slug": "books",
         "query": "stack of books beside a reading lamp at night"},
        {"text": "CHOOSE DISCIPLINE TODAY.", "slug": "lion",
         "query": "lion face intense stare close up dark background"},
        {"text": "OR DROWN IN REGRET TOMORROW.", "slug": "finish",
         "query": "runner crossing finish line with arms raised at sunrise"},
    ],
}

# emotion → scene energy (drives cut type, zoom speed, text size, sfx volume)
EMOTION_ENERGY = {
    "shout": 1.0, "angry": 0.9, "fast": 0.85, "excited": 0.8,
    "motivational": 0.65, "serious": 0.5, "sarcastic": 0.5, "dramatic": 0.45,
    "calm": 0.3, "sad": 0.25, "whisper": 0.2,
}

# keyword set for beat markers (visual rhythm follows strong spoken words)
STRONG_WORDS = set("""day never stop free one twice chain nobody save action work
pain discipline regret minutes years excuses future best better yesterday
compounds results alarms boring reps pages choose today tomorrow drown yours
waiting moment believe responsibility sleeping dreams""".split())

# ── Category → ambient palette (bg tint + glow) ─────────────────────────
PALETTES = {
    "workout":  {"bg": "#160D0F", "glow": "#FF4B3E"},
    "reading":  {"bg": "#171208", "glow": "#E8B84B"},
    "math":     {"bg": "#0F1206", "glow": "#C8FF4D"},
    "calendar": {"bg": "#10151B", "glow": "#A8C5DE"},
    "timer":    {"bg": "#150E24", "glow": "#B990FF"},
    "vote":     {"bg": "#0A1626", "glow": "#54C8FF"},
    "room":     {"bg": "#1B150D", "glow": "#E8B84B"},
    "nature":   {"bg": "#0C1710", "glow": "#57E39A"},
    "identity": {"bg": "#0A1220", "glow": "#54C8FF"},
    "path":     {"bg": "#1C1108", "glow": "#FF9E45"},
    "emotional":{"bg": "#1F1016", "glow": "#FF7A66"},
    "onyx":     {"bg": "#0C0B10", "glow": "#FF6B4A"},
    "iron":     {"bg": "#0B0F15", "glow": "#FF4438"},
    "stack":   {"bg": "#06181C", "glow": "#2DD4BF"},
}

STOPWORDS = set("""a an the is are was were it its to of and or but not no you your i we they he
she this that these those for from in on at by with as so than then too very can will just do does
did done be been being have has had want wants need needs one here there what who when why how all
any both each few more most other some such only own same s t d ll m o re ve y ain aren couldn didn
doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn""".split())

CATEGORY_KEYWORDS = {
    "workout": ["gym", "workout", "train", "training", "athlete", "runner", "run", "lift",
                "muscle", "exercise", "reps", "rep"],
    "reading": ["book", "read", "reading", "reader", "page", "library", "journal"],
    "math": ["math", "percent", "compound", "compounds", "curve", "number", "numbers", "luck",
             "dollars", "money", "domino", "bends"],
    "calendar": ["day", "days", "monday", "week", "weekly", "daily", "calendar", "streak",
                 "chain", "missed", "miss", "tuesday", "decade"],
    "timer": ["minute", "minutes", "second", "seconds", "timer", "now", "quick", "two"],
    "vote": ["vote", "votes", "ballot", "action", "cast"],
    "room": ["room", "furniture", "counter", "drawer", "phone", "fruit", "design",
             "environment", "systems", "system"],
    "nature": ["tree", "seed", "seedling", "grow", "growth", "climate", "weather", "storm",
               "invisible", "tiny", "gains"],
    "identity": ["become", "becomes", "repeat", "identity", "person", "mirror", "reliable",
                 "shift", "different"],
    "path": ["path", "journey", "road", "step", "steps", "start", "started", "first", "rise",
             "fall", "falls", "climb", "stairs"],
}

# Query overrides for slugs whose first-round results were placeholders /
# screenshots / watermarked (re-fetch with more specific wording).
QUERY_OVERRIDES = {
    "money":     "US hundred dollar bills close up macro photography",
    "curve":     "stock market chart line graph rising on a screen",
    "ballot":    "hand putting a vote into a ballot box close up",
    "timer":     "egg timer counting down on kitchen counter",
    "hockey":    "runner crossing finish line with arms raised victory",
    "mirror":    "person standing in front of a large mirror indoors",
    "ballotbox": "voting ballot box with a slot close up",
    "blueprint": "house plan blueprint drawings with white pencil on blue paper",
    "couch":     "young man bored lying on a sofa at home",
    "monday":    "wall calendar with a red circle around a date",
    "chalk":     "math formulas handwritten on blackboard classroom",
    "dominoes":  "domino tiles lined up in a row falling close up on table",
}

# Stock-preview sites whose results are always watermarked — never accept.
BAD_SOURCES = ("alamy", "shutterstock", "dreamstime", "depositphotos", "getty",
               "istock", "youworkforthem", "123rf", "fotolia", "stock")

# ── helpers ──────────────────────────────────────────────────────────────
def norm_tokens(text):
    text = text.lower()
    text = re.sub(r"\[[^\]]*\]", " ", text)          # emotion tags
    text = re.sub(r"[^a-z0-9$%\s]", " ", text)       # strip punctuation (keeps $ %)
    return [t for t in text.split() if t]

def load_json(path):
    with open(path) as f:
        return json.load(f)

def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

# ── FETCH MODE (network) ────────────────────────────────────────────────
def fetch_images(only_ids=None):
    os.makedirs(IMG_DIR, exist_ok=True)
    manifest = load_json(MANIFEST) if os.path.exists(MANIFEST) else {}
    # drop stale entries whose files no longer exist
    manifest = {k: v for k, v in manifest.items()
                if os.path.exists(os.path.join(ROOT, "public", v["file"]))}
    jobs = []  # (reel, slug, query)
    for reel_id, scenes in list(CURATED.items()) + list(CURATED_CINEMATIC.items()):
        if only_ids and reel_id not in only_ids:
            continue
        for sc in scenes:
            if sc.get("slug"):
                query = QUERY_OVERRIDES.get(sc["slug"], sc["query"])
                jobs.append((reel_id, sc["slug"], query))
    jobs = [j for j in jobs if not os.path.exists(
        os.path.join(IMG_DIR, j[0], j[1] + ".jpg"))]
    print(f"fetch jobs: {len(jobs)} (skipping already-downloaded)")
    if not jobs:
        return

    def run_search(job):
        reel, slug, query = job
        import time as _t
        for attempt in range(4):
            try:
                proc = subprocess.run(
                    ["z-ai", "image-search", "-q", query, "-c", "5", "--gl", "us",
                     "--no-rank"],
                    capture_output=True, timeout=240)
                out = proc.stdout.decode("utf-8", "replace")
                err = proc.stderr.decode("utf-8", "replace")
                if "429" in out + err or "Too many requests" in out + err:
                    wait = 25 * (attempt + 1)
                    print(f"  429 rate-limited {reel}/{slug}, waiting {wait}s …", flush=True)
                    _t.sleep(wait)
                    continue
                idx = out.find("{")
                res = json.loads(out[idx:]) if idx >= 0 else None
                return job, res if res and res.get("success") else None
            except Exception as e:
                print(f"  search failed {reel}/{slug}: {e}")
                return job, None
        return job, None

    # NOTE: the z-ai CLI is not concurrency-safe (parallel calls fail with
    # empty results) — run searches strictly serially. Each takes ~3-10 s.
    results = []
    for job in jobs:
        print(f"  searching {job[0]}/{job[1]} …", flush=True)
        results.append(run_search(job))

    from PIL import Image
    downloaded = 0
    generated = 0
    for (reel, slug, query), res in results:
        os.makedirs(os.path.join(IMG_DIR, reel), exist_ok=True)
        path = os.path.join(IMG_DIR, reel, slug + ".jpg")
        ok = False
        for cand in (res.get("results") if res else [])[:5]:
            url = cand.get("original_url")
            src = (cand.get("source") or "").lower()
            if not url:
                continue
            if any(b in src for b in BAD_SOURCES):
                continue  # stock-preview sites → always watermarked
            try:
                import urllib.request
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                raw = urllib.request.urlopen(req, timeout=60).read()
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                w, h = img.size
                if w < 500 or h < 300:
                    continue
                scale = min(1.0, 1400 / max(w, h))
                if scale < 1.0:
                    img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                img.save(path, "JPEG", quality=84)
                manifest[f"{reel}/{slug}"] = {
                    "file": f"img/{reel}/{slug}.jpg",
                    "query": query,
                    "source": cand.get("source"),
                    "url": url,
                    "width": img.size[0], "height": img.size[1],
                }
                downloaded += 1
                ok = True
                break
            except Exception as e:
                print(f"  candidate failed {reel}/{slug}: {e}")
                continue
        if not ok:
            # fallback level 3 (PRD): generated illustration — watermark-free
            try:
                print(f"  generating {reel}/{slug} …", flush=True)
                png = path.replace(".jpg", ".png")
                subprocess.run(
                    ["z-ai", "image", "-p",
                     f"{query}, cinematic moody photography, high detail, no text, no watermark",
                     "-o", png, "-s", "1344x768"],
                    capture_output=True, timeout=240)
                img = Image.open(png).convert("RGB")
                img.save(path, "JPEG", quality=84)
                os.remove(png)
                manifest[f"{reel}/{slug}"] = {
                    "file": f"img/{reel}/{slug}.jpg",
                    "query": query,
                    "source": "AI-generated (z-ai image)",
                    "url": "",
                    "width": img.size[0], "height": img.size[1],
                }
                generated += 1
            except Exception as e:
                print(f"  GENERATION FAILED {reel}/{slug}: {e}")
    save_json(MANIFEST, manifest)
    print(f"downloaded {downloaded}, generated {generated} / {len(jobs)} jobs; "
          f"manifest has {len(manifest)} entries")


# ── CINEMATIC scene planner: sentence → scene + energy/zoom/cut/sfx ────
def build_cinematic_scenes(reel):
    """One scene per narration sentence (1–3 s cuts), seeded for determinism.
    Every scene: footage + headline + energy-driven treatment. Also returns
    beat markers (strong spoken words) and the sound-design event list."""
    sents = reel.get("sentences") or []
    cid = reel["id"]
    plan = CURATED_CINEMATIC.get(cid, [])
    rng = random.Random(cid)          # deterministic per-reel creativity
    scenes, beats, sfx = [], [], []
    for i, sent in enumerate(sents):
        sp = plan[i] if i < len(plan) else {}
        emotion = (sent.get("emotion") or "motivational").lower()
        energy = EMOTION_ENERGY.get(emotion, 0.5)
        start, end = sent["start"], sent["end"]
        slug = sp.get("slug")
        mf = MANIFEST_DATA.get(f"{cid}/{slug}") if slug else None
        sc = {
            "start": round(start, 3), "end": round(end, 3),
            "text": sp.get("text") or " ".join(
                w for w in sent["text"].split()[:3]).upper() + ".",
            "words": sent.get("words", []),
            "energy": round(energy, 2),
            "cinematic": True,
            "palette": PALETTES["emotional"],
        }
        if mf and os.path.exists(os.path.join(ROOT, "public", mf["file"])):
            sc["image"] = mf["file"]
            sc["credit"] = {"query": mf["query"], "source": mf["source"], "url": mf["url"]}
        # camera treatment: high energy → fast punch/pull + hard cut;
        # low energy → slow push with crossfade
        if energy >= 0.75:
            sc["zoomStyle"] = rng.choice(["punch", "pullFast", "punch"])
            sc["cutType"] = "hard"
        elif energy >= 0.45:
            sc["zoomStyle"] = rng.choice(["push", "panL", "panR", "pullFast"])
            sc["cutType"] = "xf"
        else:
            sc["zoomStyle"] = rng.choice(["slowPush", "slowPush", "panL"])
            sc["cutType"] = "xf"
        scenes.append(sc)
        # beats: sentence start + strong words (visual rhythm = spoken rhythm)
        beats.append(round(start, 3))
        for w in sent.get("words", []):
            if w["text"].lower().strip(".,!?'\"") in STRONG_WORDS:
                beats.append(round(w["start"], 3))
        # sfx: whoosh on each scene switch (skipping the hook sentence)
        if i > 0:
            sfx.append({"t": round(start, 3), "kind": "whoosh",
                        "vol": round(0.10 + 0.16 * energy, 3)})
    # dedupe beats, keep order, enforce 0.22 s spacing
    beats = sorted(set(beats))
    spaced, last = [], -1.0
    for b in beats:
        if b - last >= 0.22:
            spaced.append(b)
            last = b
    cta = reel.get("ctaStartSec", 0)
    sfx = ([{"t": 0.12, "kind": "impact", "vol": 0.55}]
           + sfx
           + [{"t": round(cta - 1.25, 3), "kind": "riser", "vol": 0.38},
              {"t": round(cta, 3), "kind": "impact", "vol": 0.5}])
    return scenes, spaced[:26], sfx


# ── LOCAL MODE (build hype_visuals.json) ────────────────────────────────
def audio_onsets(mp3_path, sr=16000):
    """Energy-based onset detection → list of times (sec)."""
    import numpy as np
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", mp3_path, "-ac", "1", "-ar", str(sr),
         "-f", "wav", "-"], capture_output=True)
    import wave
    w = wave.open(io.BytesIO(proc.stdout))
    n = w.getnframes()
    pcm = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    hop = int(sr * 0.02)  # 20 ms
    nframes = len(pcm) // hop
    rms = np.sqrt((pcm[: nframes * hop].reshape(nframes, hop) ** 2).mean(axis=1))
    if len(rms) < 10:
        return []
    # adaptive local mean (window ±0.5 s)
    k = 25
    pad = np.pad(rms, (k, k), mode="edge")
    local = np.convolve(pad, np.ones(2 * k + 1) / (2 * k + 1), mode="valid")
    peak = rms.max()
    cand = (rms > local * 1.45) & (rms > 0.22 * peak)
    onsets, last = [], -10.0
    for i in np.nonzero(cand)[0]:
        t = i * 0.02
        if t - last > 0.4:  # min separation
            onsets.append(round(float(t), 3))
            last = t
    return onsets


def match_phrase(words, phrase):
    """Find contiguous subsequence matching phrase tokens. Returns (i, j) incl."""
    toks = norm_tokens(phrase)
    normed = [norm_tokens(w["text"]) or [""] for w in words]
    flat = []  # (word_idx, token)
    for wi, parts in enumerate(normed):
        for tok in parts:
            flat.append((wi, tok))
    n = len(toks)
    for s in range(len(flat) - n + 1):
        if [flat[s + k][1] for k in range(n)] == toks:
            return flat[s][0], flat[s + n - 1][0]
    return None


def build_scenes(reel, words):
    """Curated (or auto) scene list with narration-synced timings."""
    hook_end, cta = reel["hookEndSec"], reel["ctaStartSec"]
    specs = CURATED.get(reel["id"])
    if specs is None:
        specs = auto_specs(reel, words)
    raw = []
    for sp in specs:
        m = match_phrase(words, sp["phrase"])
        if m is None:
            print(f"  !! phrase not found in {reel['id']}: {sp['phrase'][:40]}…")
            continue
        i, j = m
        start = (max(0.12, words[i]["start"] - 0.25) if sp.get("cover")
                 else max(hook_end + 0.05, words[i]["start"] - 0.15))
        end = min(cta - 0.15, words[j]["end"] + 0.35)
        sc = {
            "start": round(start, 3), "end": round(max(end, start + 0.7), 3),
            "cinematic": bool(sp.get("cinematic")),
            "text": sp.get("text", ""),
            "words": [
                {"text": w["text"], "start": round(w["start"], 3),
                 "end": round(w["end"], 3)} for w in words[i: j + 1]],
            "palette": PALETTES.get(sp.get("cat", "emotional"), PALETTES["emotional"]),
        }
        if sp.get("stat"):
            sc["stat"] = sp["stat"]
            sc.pop("text", None)
        slug = sp.get("slug")
        mf = MANIFEST_DATA.get(f"{reel['id']}/{slug}") if slug else None
        if mf and os.path.exists(os.path.join(ROOT, "public", mf["file"])):
            sc["image"] = mf["file"]
            sc["credit"] = {"query": mf["query"], "source": mf["source"], "url": mf["url"]}
        raw.append(sc)
    raw.sort(key=lambda s: s["start"])
    # de-overlap: clip previous end below next start; if too short, drop the
    # previous scene and let the next one start at the earlier position so
    # the centre is covered continuously (no holes).
    scenes = []
    for sc in raw:
        while scenes and sc["start"] < scenes[-1]["end"] + 0.05:
            prev = scenes[-1]
            clipped = round(sc["start"] - 0.05, 3)
            if clipped - prev["start"] >= 0.5:
                prev["end"] = clipped
                break
            sc["start"] = prev["start"]   # absorb the dropped scene's slot
            scenes.pop()
        scenes.append(sc)
    # fill holes: extend each scene's end up to the next start
    for a, b in zip(scenes, scenes[1:]):
        if b["start"] - a["end"] > 0.03:
            a["end"] = round(b["start"] - 0.02, 3)
    if scenes:
        scenes[-1]["end"] = round(max(scenes[-1]["start"] + 0.8, cta - 0.25), 3)
    # split scenes longer than 4.5 s into an image phase + a kinetic-text
    # phase so long stretches never sit on one still composition
    out = []
    for sc in scenes:
        dur = sc["end"] - sc["start"]
        if dur > 4.5 and sc.get("image") and not sc.get("cinematic"):
            mid = round((sc["start"] + sc["end"]) / 2, 3)
            first = dict(sc)
            first["end"] = mid
            second = dict(sc)
            second["start"] = mid
            second.pop("image", None)
            # the kinetic phase shows a SHORT headline (full phrase words would
            # blow up the giant type) — static, no word-by-word reveal
            second["words"] = []
            if sc.get("stat"):
                second["text"] = (sc["stat"].get("prefix", "")
                                  + f"{sc['stat']['to']:g}"
                                  + sc["stat"].get("suffix", ""))
                second.pop("stat", None)
            out += [first, second]
        else:
            out.append(sc)
    return [s for s in out if s["end"] - s["start"] >= 0.7]


def auto_specs(reel, words):
    """Fallback director for future reels: sentence split + keywords."""
    text = " ".join(w["text"] for w in words)
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    # skip CTA-ish sentences
    sentences = [s for s in sentences
                 if not re.search(r"ebook|link in bio|free guide", s, re.I)]
    specs = []
    for s in sentences:
        toks = [t for t in norm_tokens(s) if t not in STOPWORDS and len(t) > 2]
        if not toks:
            continue
        cat = "emotional"
        for c, kws in CATEGORY_KEYWORDS.items():
            if any(t in kws for t in toks):
                cat = c
                break
        key = " ".join(toks[:3]).upper()
        specs.append({
            "phrase": s,
            "text": key,
            "slug": None,           # no pre-fetched image; kinetic fallback
            "cat": cat,
        })
    return specs[:6]


def main():
    global MANIFEST_DATA
    props = load_json(PROPS)
    # normalize hook duration to 2.2–3.4 s: the hook overlay must not eat the
    # body window where the centre scenes live
    for reel in props["reels"]:
        h = reel["hookEndSec"]
        reel["hookEndSec"] = round(min(max(h, 2.2), 3.4), 3)
        if reel.get("style") == "cinematic":
            # the closing line IS the ending section; the ebook card owns the tail
            reel["ctaStartSec"] = round(reel["speechEndSec"] + 0.1, 3)
    save_json(PROPS, props)
    MANIFEST_DATA = load_json(MANIFEST) if os.path.exists(MANIFEST) else {}
    out = {}
    for reel in props["reels"]:
        if reel.get("style") == "cinematic":
            scenes, beats, sfx = build_cinematic_scenes(reel)
            out[reel["id"]] = {"scenes": scenes, "beats": beats, "sfx": sfx}
            imgs = sum(1 for s in scenes if s.get("image"))
            hard = sum(1 for s in scenes if s.get("cutType") == "hard")
            print(f"{reel['file']}: {len(scenes)} sentence-scenes ({imgs} img, "
                  f"{hard} hard cuts), {len(beats)} beats, {len(sfx)} sfx")
            continue
        words = [w for g in reel["captions"] for w in g["words"]]
        scenes = build_scenes(reel, words)
        mp3 = os.path.join(ROOT, "public", reel["audio"])
        onsets = audio_onsets(mp3) if os.path.exists(mp3) else []
        lo = reel["hookEndSec"] + 0.2
        hi = reel["ctaStartSec"] - 0.2
        beats = sorted({b for b in onsets if lo <= b <= hi})[:18]
        out[reel["id"]] = {"scenes": scenes, "beats": beats}
        imgs = sum(1 for s in scenes if s.get("image"))
        print(f"{reel['file']}: {len(scenes)} scenes ({imgs} with image), "
              f"{len(beats)} beats")
    save_json(OUT, out)
    print(f"\nwrote {OUT} for {len(out)} reels")


if __name__ == "__main__":
    if "--fetch" in sys.argv:
        only = None
        if "--only" in sys.argv:
            only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
        fetch_images(only)
    else:
        main()
