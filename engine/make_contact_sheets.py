#!/usr/bin/env python3
"""Combine rendered ebook pages into 2x2 contact sheets for VLM QA."""
import glob
import math
from PIL import Image

pages = sorted(glob.glob("/tmp/render/page-*.jpg"))
print(f"{len(pages)} pages")

GROUP = 4
sheets = [pages[i:i + GROUP] for i in range(0, len(pages), GROUP)]
for si, group in enumerate(sheets, 1):
    thumbs = [Image.open(p) for p in group]
    w = max(t.width for t in thumbs)
    h = max(t.height for t in thumbs)
    cols = 2
    rows = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * w + 12, rows * h + 12), "#888888")
    for i, t in enumerate(thumbs):
        sheet.paste(t, ((i % cols) * (w + 8) + 2, (i // cols) * (h + 8) + 2))
    out = f"/tmp/render/sheet_{si:02d}.jpg"
    sheet.save(out, quality=72)
    labels = [p.split("-")[-1].split(".")[0] for p in group]
    print(out, "pages:", labels)
