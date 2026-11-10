#!/usr/bin/env python3
"""generate_slides.py — single 4:5 (1080x1350) motivational quote slides
for Instagram feed + Pinterest photo posts. Renders HTML via headless Chrome.

Usage: python3 /home/z/my-project/scripts/generate_slides.py
Out:   /home/z/my-project/download/slides/slide_01..NN.png
"""
import json, os, subprocess, pathlib

ROOT = pathlib.Path("/home/z/my-project")
OUT = ROOT / "download" / "slides"
GEN = ROOT / "scripts" / "slides_gen"
FONTS = ROOT / "scripts" / "reels" / "public" / "fonts"
CHROME = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome"

SLIDES = [
    {
        "file": "slide_01.png",
        "theme": {"bg": "#141009", "panel": "#1C1710", "accent": "#E8B84B", "ink": "#F5EDD8", "inkSoft": "#A89468"},
        "deco": "bars",
        "quote": "Discipline is choosing between what you want <em>now</em> and what you want <em>most</em>.",
        "tag": "THE DAILY CHOICE",
    },
    {
        "file": "slide_02.png",
        "theme": {"bg": "#1A0D0F", "panel": "#261216", "accent": "#FF4B3E", "ink": "#FFF0EB", "inkSoft": "#B08580"},
        "deco": "bolt",
        "quote": "Nobody is coming to save you. <em>That's the good news.</em>",
        "tag": "HARD TRUTH",
    },
    {
        "file": "slide_03.png",
        "theme": {"bg": "#0A1626", "panel": "#102036", "accent": "#54C8FF", "ink": "#EAF4FF", "inkSoft": "#7E97B5"},
        "deco": "rings",
        "quote": "1% better every day = <em>×37.78</em> in a year. The math is already on your side.",
        "tag": "COMPOUND GROWTH",
    },
    {
        "file": "slide_04.png",
        "theme": {"bg": "#101408", "panel": "#181F0D", "accent": "#C8FF4D", "ink": "#F4FFE0", "inkSoft": "#8A9B6B"},
        "deco": "checks",
        "quote": "Hard days build the person <em>easy days can't.</em>",
        "tag": "EARN IT",
    },
    {
        "file": "slide_05.png",
        "theme": {"bg": "#160E2A", "panel": "#201543", "accent": "#B990FF", "ink": "#F2ECFF", "inkSoft": "#8D82B5"},
        "deco": "dots",
        "quote": "You don't need more time. <em>You need fewer excuses.</em>",
        "tag": "NO MORE EXCUSES",
    },
    {
        "file": "slide_06.png",
        "theme": {"bg": "#201008", "panel": "#2E180C", "accent": "#FF9E45", "ink": "#FFF3E8", "inkSoft": "#B08D72"},
        "deco": "arc",
        "quote": "Start before you're ready. <em>Two minutes counts.</em>",
        "tag": "START TODAY",
    },
]

HTML = """<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face {{ font-family:'Playfair Display'; src:url('{fonts}/PlayfairDisplay-900.ttf') format('truetype'); font-weight:900; }}
@font-face {{ font-family:'Playfair Display'; src:url('{fonts}/PlayfairDisplay-400-italic.ttf') format('truetype'); font-weight:400; font-style:italic; }}
@font-face {{ font-family:'Source Sans 3'; src:url('{fonts}/SourceSans3-700.ttf') format('truetype'); font-weight:700; }}
@font-face {{ font-family:'Source Sans 3'; src:url('{fonts}/SourceSans3-400.ttf') format('truetype'); font-weight:400; }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
html,body {{ width:1080px; height:1350px; overflow:hidden; }}
body {{
  background:{bg}; color:{ink}; font-family:'Source Sans 3',sans-serif;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  position:relative;
}}
.deco {{ position:absolute; inset:0; }}
{deco_css}
.tag {{
  font-size:26px; font-weight:700; letter-spacing:10px; color:{accent};
  margin-bottom:48px;
}}
.quote {{
  font-family:'Playfair Display',serif; font-weight:900; font-size:84px;
  line-height:1.22; text-align:center; max-width:880px; letter-spacing:-1px;
  text-shadow:0 10px 40px rgba(0,0,0,.35);
}}
.quote em {{ font-style:italic; font-weight:400; color:{accent}; }}
.rule {{ width:150px; height:5px; background:{accent}; border-radius:3px; margin:56px 0 40px; }}
.footer {{
  font-size:24px; font-weight:700; letter-spacing:6px; color:{inkSoft};
}}
.footer b {{ color:{accent}; letter-spacing:6px; }}
.vignette {{
  position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(ellipse at 50% 40%, transparent 55%, {bg}B8 100%);
}}
</style></head>
<body>
<div class="deco">{deco_svg}</div>
<div class="tag">{tag}</div>
<div class="quote">{quote}</div>
<div class="rule"></div>
<div class="footer">@self_efficient_daily &nbsp;·&nbsp; <b>FREE EBOOK — LINK IN BIO</b></div>
<div class="vignette"></div>
</body></html>"""

DECOS = {
    "bars": (
        "",
        "".join(
            f'<div style="position:absolute;bottom:0;left:{110 + i*136}px;width:88px;height:{h}px;'
            f'border-radius:44px 44px 0 0;background:{{accent}};opacity:{o};"></div>'
            for i, (h, o) in enumerate(
                [(80, 0.12), (130, 0.16), (190, 0.22), (250, 0.28), (300, 0.34), (260, 0.44), (230, 0.55)]
            )
        ),
    ),
    "bolt": (
        "",
        '<svg width="1080" height="1350" style="position:absolute;inset:0">'
        '<polygon points="660,180 810,600 700,600 850,980 540,680 660,680 520,420" fill="{accent}" opacity="0.16"/>'
        '<polygon points="200,760 320,1010 270,1010 380,1240 190,930 260,930 170,860" fill="{accent}" opacity="0.10"/>'
        '</svg>',
    ),
    "rings": (
        "",
        '<svg width="1080" height="1350" style="position:absolute;inset:0">'
        + "".join(
            f'<circle cx="540" cy="675" r="{r}" fill="none" stroke="{{accent}}" '
            f'stroke-width="{6 if i==0 else 4}" opacity="{0.38-i*0.05}"/>'
            for i, r in enumerate([170, 280, 395, 515, 640])
        )
        + "</svg>",
    ),
    "checks": (
        "",
        '<svg width="1080" height="1350" style="position:absolute;inset:0">'
        '<circle cx="820" cy="240" r="120" fill="none" stroke="{accent}" stroke-width="8" opacity="0.25"/>'
        '<path d="M 760 240 L 800 285 L 880 190" fill="none" stroke="{accent}" stroke-width="22" '
        'stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>'
        '<circle cx="240" cy="1120" r="80" fill="none" stroke="{accent}" stroke-width="8" opacity="0.25"/>'
        '<path d="M 200 1120 L 228 1148 L 285 1080" fill="none" stroke="{accent}" stroke-width="16" '
        'stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>'
        '</svg>',
    ),
    "dots": (
        "",
        '<svg width="1080" height="1350" style="position:absolute;inset:0">'
        + "".join(
            f'<circle cx="{60+c*120}" cy="{110+r*130}" r="9" fill="{{accent}}" opacity="{max(0.06, 0.5-abs((r*130+c*60))/950):.2f}"/>'
            for r in range(10) for c in range(9)
        )
        + "</svg>",
    ),
    "arc": (
        "",
        '<svg width="1080" height="1350" style="position:absolute;inset:0">'
        '<circle cx="540" cy="1350" r="330" fill="{accent}" opacity="0.18"/>'
        '<circle cx="540" cy="1350" r="330" fill="none" stroke="{accent}" stroke-width="12" opacity="0.6"/>'
        + "".join(
            f'<line x1="{540+390*__import__("math").sin(-1.57+i*0.35):.0f}" y1="{1350-390*__import__("math").cos(-1.57+i*0.35):.0f}" '
            f'x2="{540+450*__import__("math").sin(-1.57+i*0.35):.0f}" y2="{1350-450*__import__("math").cos(-1.57+i*0.35):.0f}" '
            f'stroke="{{accent}}" stroke-width="10" opacity="0.3" stroke-linecap="round"/>'
            for i in range(9)
        )
        + "</svg>",
    ),
}

def main():
    GEN.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for i, s in enumerate(SLIDES, 1):
        t = s["theme"]
        # build deco svg with accent color substituted
        _, svg = DECOS[s["deco"]]
        svg = svg.replace("{accent}", t["accent"])
        # arc deco uses inline f-string math already; rewrite that piece simply:
        html = HTML.format(
            fonts=str(FONTS), bg=t["bg"], ink=t["ink"], accent=t["accent"],
            inkSoft=t["inkSoft"], deco_css="", deco_svg=svg,
            tag=s["tag"], quote=s["quote"],
        )
        # fix arc lines (computed above need math) — replace placeholder-safe
        page = GEN / f"slide_{i:02d}.html"
        page.write_text(html)
        png = OUT / s["file"]
        subprocess.run([
            CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--force-device-scale-factor=1",
            f"--screenshot={png}", "--window-size=1080,1350",
            "--virtual-time-budget=4000", page.as_uri(),
        ], check=True, capture_output=True, timeout=60)
        size = png.stat().st_size
        print(f"slide_{i:02d}.png  {size//1024} KB  ({s['tag']})")

if __name__ == "__main__":
    main()
