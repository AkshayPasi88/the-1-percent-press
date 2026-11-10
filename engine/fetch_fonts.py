#!/usr/bin/env python3
"""Fetch Playfair Display + Source Sans 3 TTFs via Google Fonts v1 CSS API.

v1 endpoint + legacy UA serves static per-weight TTFs — works for both
Remotion (@font-face) and LibreOffice (~/.fonts install).

Saves to:
  /home/z/my-project/scripts/reels/public/fonts/  (Remotion @font-face)
  /home/z/.fonts/                                  (LibreOffice PDF check)
"""
import re
import urllib.request
from pathlib import Path

CSS_URL = (
    "https://fonts.googleapis.com/css?family="
    "Playfair+Display:400,700,900,400italic"
    "|Source+Sans+3:400,600,700,400italic"
)
UA = "Mozilla/4.0"
DESTS = [
    Path("/home/z/my-project/scripts/reels/public/fonts"),
    Path("/home/z/.fonts"),
]

req = urllib.request.Request(CSS_URL, headers={"User-Agent": UA})
css = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")

faces = re.findall(r"@font-face\s*\{([^}]+)\}", css)
print(f"parsed {len(faces)} @font-face blocks")
for body in faces:
    family = re.search(r"font-family:\s*'([^']+)'", body).group(1)
    style = re.search(r"font-style:\s*(\w+)", body).group(1)
    weight = re.search(r"font-weight:\s*(\d+)", body).group(1)
    url = re.search(r"url\(([^)]+)\)", body).group(1)
    fname = f"{family.replace(' ', '')}-{weight}{'-italic' if style == 'italic' else ''}.ttf"
    data = urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30
    ).read()
    for dest in DESTS:
        dest.mkdir(parents=True, exist_ok=True)
        (dest / fname).write_bytes(data)
    print(f"  {fname} ({len(data) // 1024} KB)")

print(f"done -> {DESTS}")
