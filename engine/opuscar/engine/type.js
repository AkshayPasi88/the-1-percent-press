// type.js — kinetic typography: hook slams, word stacks, CTA end card.
// Records visible text boxes (for readcheck) via E.recordText.
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, lerp, rgba, seg, ss, back, spring, word, fitSize, hash, mulberry } = E;

  const FONT = "Anton, 'Archivo Black', sans-serif";
  const TEXTBUF = [];
  E.recordText = function (id, text, x0, y0, x1, y1, pass) {
    if (TEXTBUF.length < 64) TEXTBUF.push({ id, text, x0, y0, x1, y1, pass: !!pass });
  };
  E.takeTexts = function () {
    const out = TEXTBUF.slice();
    TEXTBUF.length = 0;
    return out;
  };

  /** Big word slam-in transform helper. tt = seconds since word t0. */
  function slam(tt) {
    // scale 2.35 → 1 with elastic settle + fast fade-in
    const k = spring(tt, 150, 13);
    const scale = lerp(2.35, 1, clamp(k, 0, 1.12));
    const alpha = clamp(tt / 0.07, 0, 1);
    return { scale, alpha };
  }

  // ————————————————————————— hook (0 – ~2.2s) —————————————————————————

  E.drawHook = function (ctx, W, H, t, hook, pal) {
    const rng = mulberry((hash("hook" + hook.id) ^ 0x9e37) >>> 0);
    const jitterSeeds = hook.words.map(() => (rng() - 0.5) * 4);
    for (let i = 0; i < hook.words.length; i++) {
      const w = hook.words[i];
      if (t < w.t0 - 0.001) continue;
      const next = i + 1 < hook.words.length ? hook.words[i + 1].t0 : hook.t1;
      const tt = t - w.t0;
      if (t > next + 0.02 && t > w.t1 + 0.18) continue; // word gives way to the next slam
      const disp = word(w.text);
      if (!disp) continue;
      const maxW = W * 0.88;
      let size = fitSize(ctx, disp, "Anton, sans-serif", 400, maxW, Math.floor(H * 0.155), 80);
      const { scale, alpha } = slam(tt);
      const cx = W / 2;
      const cy = H * 0.46 + jitterSeeds[i] * 6;
      // strobe fill: alternate accent / white every 2 frames while settling
      const strobe = tt < 0.24 ? Math.floor(tt * 30) % 2 === 0 : true;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(jitterSeeds[i] * 0.004 * (1 - clamp(tt / 0.3, 0, 1)));
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = `400 ${size}px Anton, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // depth shadow
      ctx.fillStyle = rgba(pal.colors[0], 0.55);
      ctx.fillText(disp, 8, 14);
      // main fill
      ctx.fillStyle = strobe ? pal.text : pal.accent;
      ctx.fillText(disp, 0, 0);
      // hard outline
      ctx.lineWidth = Math.max(2, size * 0.02);
      ctx.strokeStyle = rgba("#000000", 0.35);
      ctx.strokeText(disp, 0, 0);
      ctx.restore();
      const bw = ctx.measureText(disp).width;
      E.recordText("hook" + i, disp, cx - maxW / 2, cy - size, cx + maxW / 2, cy + size, tt < 0.2);
    }
    // hook floor bar: accent strip pulsing with the word rhythm
    const hbar = clamp((t - hook.t0) / 0.18, 0, 1) * clamp((hook.t1 + 0.1 - t) / 0.15, 0, 1);
    ctx.fillStyle = rgba(pal.accent, 0.85 * hbar);
    ctx.fillRect(W * (0.5 - 0.42 * hbar), H * 0.605, W * 0.84 * hbar, 10);
  };

  // ————————————————————————— body kinetic words ————————————————————————

  /**
   * segment = { t0, t1, words:[{text,t0,t1,key}], layout }
   * layouts: stack (centre, accumulate ≤4), block (left-aligned),
   * spot (one giant word at a time), arc (words along an arc)
   */
  E.drawWords = function (ctx, W, H, t, segm, pal) {
    const words = segm.words.map((w) => ({ ...w, disp: word(w.text) })).filter((w) => w.disp);
    if (!words.length) return;
    const outT = clamp((segm.t1 - t) / 0.3, 0, 1); // segment fade-out envelope
    const gAlpha = clamp((t - segm.t0) / 0.12, 0, 1) * outT;
    if (gAlpha <= 0.01) return;

    if (segm.layout === "spot") {
      // ——— one giant word at a time ———
      let cur = null, ci = -1;
      for (let i = 0; i < words.length; i++) {
        if (t >= words[i].t0 - 0.02 && (i === words.length - 1 || t < words[i + 1].t0)) { cur = words[i]; ci = i; break; }
      }
      if (!cur) return;
      const tt = t - cur.t0;
      const size = fitSize(ctx, cur.disp, "Anton, sans-serif", 400, W * 0.86, Math.floor(H * 0.17), 90);
      const { scale, alpha } = slam(tt);
      const key = cur.key || ci % 4 === 3;
      ctx.save();
      ctx.translate(W / 2, H * 0.44);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha * gAlpha;
      ctx.font = `400 ${size}px Anton, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(pal.colors[0], 0.5);
      ctx.fillText(cur.disp, 7, 12);
      ctx.fillStyle = key ? pal.accent : pal.text;
      ctx.fillText(cur.disp, 0, 0);
      ctx.restore();
      E.recordText("seg" + segm.i + "w" + ci, cur.disp, W * 0.07, H * 0.35, W * 0.93, H * 0.53, true);
      return;
    }

    // ——— stack / block / arc: accumulate words, flush beyond 4 ———
    const visible = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (t < w.t0) break;
      if (t > w.t1 + 2.2) continue; // spoken long ago → flushed
      visible.push({ ...w, i, age: t - w.t0, live: t >= w.t0 && t <= w.t1 + 0.25 });
    }
    while (visible.length > 4) visible.shift();
    if (!visible.length) return;

    const maxW = W * (segm.layout === "block" ? 0.8 : 0.86);
    let size = segm.layout === "arc" ? 62 : 92;
    for (const w of visible) size = Math.min(size, fitSize(ctx, w.disp, "Anton, sans-serif", 400, maxW, 120, 54));
    size = Math.max(54, size);

    const lineH = size * 1.24;
    const rows = visible.map((w, r) => r);
    const totalH = visible.length * lineH;
    const topY = H * (segm.layout === "block" ? 0.30 : 0.34) - totalH / 2 + lineH / 2;
    const x0 = segm.layout === "block" ? W * 0.12 : W / 2;

    ctx.textBaseline = "middle";
    ctx.textAlign = segm.layout === "block" ? "left" : "center";
    for (const r of rows) {
      const w = visible[r];
      const tt = t - w.t0;
      const k = clamp(spring(tt, 120, 14), 0, 1.05);
      const scale = lerp(1.7, 1, k);
      const alpha = clamp(tt / 0.09, 0, 1);
      let y = topY + r * lineH;
      let x = x0;
      if (segm.layout === "arc") {
        const frac = visible.length > 1 ? r / (visible.length - 1) : 0.5;
        y += Math.sin(frac * Math.PI) * -70;
        x = W / 2 + Math.cos(frac * Math.PI) * 0; // arc = vertical curve only
      }
      // slide-up settle for stacked words
      const slide = (1 - clamp(tt / 0.22, 0, 1)) * 26;
      const key = w.key || w.live;
      ctx.save();
      ctx.translate(x, y + slide);
      if (segm.layout !== "block") ctx.scale(scale, scale);
      else ctx.scale(lerp(1.35, 1, k), lerp(1.35, 1, k));
      ctx.globalAlpha = alpha * gAlpha * (w.live ? 1 : 0.6);
      ctx.font = `400 ${size}px Anton, sans-serif`;
      ctx.fillStyle = key ? pal.accent : pal.text;
      if (w.live) { // active spoken word: underline tick
        ctx.fillStyle = pal.accent;
        ctx.shadowColor = rgba(pal.accent, 0.85);
        ctx.shadowBlur = 24;
      } else {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 8;
      }
      ctx.fillText(w.disp, 0, 0);
      ctx.restore();
      const wdt = ctx.measureText(w.disp).width;
      const bx0 = segm.layout === "block" ? x - 4 : x - wdt / 2 - 8;
      E.recordText("seg" + segm.i + "w" + w.i, w.disp, clamp(bx0, 0, W), clamp(y - size, 0, H), clamp(bx0 + wdt + 8, 0, W), clamp(y + size, 0, H), true);
      if (w.live) {
        ctx.fillStyle = rgba(pal.accent, 0.9 * alpha * gAlpha);
        const barW = clamp(wdt * 1.05, 30, W * 0.7);
        const bx = segm.layout === "block" ? x : W / 2 - barW / 2;
        ctx.fillRect(bx, y + size * 0.72, barW, 7);
      }
    }
  };

  // ————————————————————————— CTA end card ——————————————————————————————

  E.drawCta = function (ctx, W, H, t, cta, pal, brand) {
    const tt = t - cta.t0;
    if (tt < 0) return;
    const land = clamp(tt / 0.32, 0, 1);
    const settle = spring(tt, 90, 14);
    const scale = lerp(0.6, 1, clamp(settle, 0, 1.08)) * lerp(0.9, 1, land);
    const cx = W / 2, cy = H * 0.44;
    const cw = W * 0.82, ch = H * 0.3;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    // card
    ctx.fillStyle = "rgba(8,8,12,0.92)";
    ctx.strokeStyle = rgba(pal.accent, 0.95);
    ctx.lineWidth = 6;
    const r = 28;
    ctx.beginPath();
    ctx.roundRect(-cw / 2, -ch / 2, cw, ch, r);
    ctx.fill();
    ctx.stroke();
    // inner hairline
    ctx.strokeStyle = rgba(pal.accent, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-cw / 2 + 14, -ch / 2 + 14, cw - 28, ch - 28, r - 10);
    ctx.stroke();
    // title
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const t1 = fitSize(ctx, brand.ebookTitle, "Anton, sans-serif", 400, cw - 90, 96, 40);
    ctx.font = `400 ${t1}px Anton, sans-serif`;
    ctx.fillStyle = pal.text;
    ctx.fillText(brand.ebookTitle, 0, -ch * 0.18);
    // sub
    const t2 = fitSize(ctx, brand.ebookSub, "'Source Sans 3', sans-serif", 600, cw - 90, 34, 18);
    ctx.font = `600 ${t2}px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = rgba(pal.text, 0.75);
    ctx.fillText(brand.ebookSub, 0, ch * 0.08);
    // cta pill
    const pulse = 1 + 0.05 * Math.sin(t * 6);
    ctx.save();
    ctx.scale(pulse, pulse);
    ctx.font = `600 ${30}px 'Source Sans 3', sans-serif`;
    const pw = ctx.measureText(brand.cta).width + 56;
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.roundRect(-pw / 2, ch * 0.24, pw, 58, 29);
    ctx.fill();
    ctx.fillStyle = "#0a0a0e";
    ctx.fillText(brand.cta, 0, ch * 0.24 + 29);
    ctx.restore();
    ctx.restore();

    // bouncing chunky arrow right above the card → bio
    const bounce = Math.abs(Math.sin(t * 3.2)) * 40;
    ctx.save();
    ctx.translate(W / 2, cy - ch / 2 - 70 - bounce);
    ctx.strokeStyle = pal.accent;
    ctx.fillStyle = rgba(pal.accent, 0.95);
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-52, 44);
    ctx.lineTo(0, -14);
    ctx.lineTo(52, 44);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-52, 104);
    ctx.lineTo(0, 46);
    ctx.lineTo(52, 104);
    ctx.stroke();
    // glow under the arrow
    const ag = ctx.createRadialGradient(0, 20, 0, 0, 20, 130);
    ag.addColorStop(0, rgba(pal.accent, 0.25));
    ag.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ag;
    ctx.fillRect(-140, -80, 280, 260);
    ctx.restore();

    // handle
    ctx.textAlign = "center";
    ctx.font = `600 30px 'Source Sans 3', sans-serif`;
    ctx.fillStyle = rgba(pal.text, 0.8);
    ctx.fillText(brand.handle, W / 2, cy + ch / 2 + 90);

    E.recordText("ctaTitle", brand.ebookTitle, cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2);
    E.recordText("ctaCta", brand.cta, cx - pw / 2, cy + ch * 0.24 - 29, cx + pw / 2, cy + ch * 0.24 + 29);
  };
})();
