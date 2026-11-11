#!/usr/bin/env python3
"""Generate CREDITS.md attribution table from sources/img/manifest.json."""
import json
import os

EB = "/home/z/my-project/repos/the-1-percent-method-ebook"
MANIFEST = os.path.join(EB, "sources", "img", "manifest.json")
OUT = os.path.join(EB, "sources", "CREDITS.md")

m = json.load(open(MANIFEST))
rows = []
for key in sorted(m):
    v = m[key]
    url = v.get("url") or "(generated in-session — no external source)"
    rows.append(f"| {key.replace('/', ' / ')} | {v['query']} | {v.get('source', '?')} | {url} |")

table = "\n".join(rows)
doc = f"""# Image Credits & Attribution

All photos used in the reels' Dynamic Centre Visual Engine (search → download →
validate → cache). Queries, source sites and original URLs are preserved in
`manifest.json`; this table is human-readable form. Per-slug queries that
returned only watermarked stock-preview results were replaced by AI-generated
illustrations (marked below) — watermark-free and license-clean.

| Asset | Search query | Source | Original URL |
|---|---|---|---|
{table}
"""
open(OUT, "w").write(doc)
print(f"wrote {OUT}: {len(rows)} entries")
