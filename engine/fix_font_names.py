#!/usr/bin/env python3
"""Fix name tables of v1-API Source Sans 3 TTFs in ~/.fonts so fontconfig
and LibreOffice see family 'Source Sans 3' (Playfair files are already fine)."""
from fontTools.ttLib import TTFont

FIXES = [
    ("SourceSans3-400.ttf", "Regular"),
    ("SourceSans3-600.ttf", "SemiBold"),
    ("SourceSans3-700.ttf", "Bold"),
    ("SourceSans3-400-italic.ttf", "Italic"),
]

for fname, style in FIXES:
    path = f"/home/z/.fonts/{fname}"
    font = TTFont(path)
    name = font["name"]
    name.setName("Source Sans 3", 1, 3, 1, 0x409)
    name.setName(style, 2, 3, 1, 0x409)
    name.setName(f"Source Sans 3 {style}", 4, 3, 1, 0x409)
    name.setName(f"SourceSans3-{style}", 6, 3, 1, 0x409)
    name.removeNames(nameID=16)
    name.removeNames(nameID=17)
    font.save(path)
    print(f"fixed {fname} -> Source Sans 3 {style}")
