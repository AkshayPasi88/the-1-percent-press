// worlds.js — story environments: layered parallax worlds drawn entirely in
// code. Each world paints sky + terrain layers + atmosphere; the story
// compositor (story.js) places the character, props, typography and lighting
// on top. Every layer drifts/scrolls/breathes → the pixels change every frame.
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, lerp, rgba, mulberry, hash } = E;

  /** Seeded mountain-ridge silhouette, horizontal pixel drift (camera
   * parallax feel) + slow shape morph. Every layer physically moves. */
  function ridge(ctx, W, H, baseY, amp, seed, scroll, freq, fill, outline, driftPx) {
    const noise = E.makeNoise(seed >>> 0);
    ctx.save();
    if (driftPx) ctx.translate(-((driftPx % 200) - 100), 0); // ±100 px slide
    ctx.beginPath();
    ctx.moveTo(-160, H + 40);
    for (let x = -160; x <= W + 160; x += 30) {
      const y = baseY - (noise(x * freq + scroll, seed % 31) * 0.65 + noise(x * freq * 2.7 + scroll * 1.7, seed % 17) * 0.35) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 160, H + 40);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  }

  // ————————————————————————————————— 1. dark mountain night ———————————————
  E.worldDarkMountain = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    // night sky gradient (slow hue drift)
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    E.objStars(ctx, W, H, t, sc.seed, 110, H * 0.5);
    E.objMoon(ctx, W * 0.76, H * 0.16, W * 0.09, t);
    // three parallax ridges, far → near, each physically drifting sideways
    ridge(ctx, W, H, H * 0.52, H * 0.16, sc.seed + 1, t * 0.009, 0.0022, rgba(pal.colors[1] || "#1a2030", 0.5), null, t * 5);
    ridge(ctx, W, H, H * 0.66, H * 0.2, sc.seed + 2, t * 0.022, 0.0031, rgba(pal.colors[1] || "#141a28", 0.8), null, t * 11);
    ridge(ctx, W, H, H * 0.84, H * 0.22, sc.seed + 3, t * 0.046, 0.0042, pal.bg0, rgba(pal.accent, 0.08), t * 24);
    // far peak glint (the goal, far away)
    E.objPeakGlint(ctx, W * 0.7, H * 0.5, W * 0.12, t);
    // ground fog
    E.objFog(ctx, W, H, H * 0.78, t, sc.seed + 5, 0.1, pal);
    E.objMotes(ctx, W, H, t, sc.seed, pal, { count: 34, maxY: H * 0.62, alpha: 0.55 });
  };

  // ————————————————————————————————— 2. empty road ———————————————————————
  E.worldRoad = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.5);
    E.objStars(ctx, W, H, t, sc.seed + 9, 60, H * 0.3);
    // horizon glow
    const hg = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.6);
    hg.addColorStop(0, rgba(pal.accent, 0.14));
    hg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, H * 0.2, W, H * 0.4);
    // distant ridge
    ridge(ctx, W, H, H * 0.43, H * 0.05, sc.seed + 4, t * 0.003, 0.004, rgba(pal.colors[1] || "#1a2030", 0.6));
    // ground plane
    ctx.fillStyle = pal.bg0;
    ctx.fillRect(0, H * 0.42, W, H * 0.58);
    // perspective road: vanishing point at (W/2, H*0.42)
    const vp = [W / 2, H * 0.42];
    const roadW = W * 0.94;
    ctx.beginPath();
    ctx.moveTo(vp[0] - 6, vp[1]);
    ctx.lineTo(vp[0] + 6, vp[1]);
    ctx.lineTo(W / 2 + roadW / 2, H);
    ctx.lineTo(W / 2 - roadW / 2, H);
    ctx.closePath();
    ctx.fillStyle = "#14161f";
    ctx.fill();
    // center dashes scrolling toward viewer (speed = walking)
    const scroll = t * (sc.speed || 1) * 0.5;
    const N = 11;
    for (let i = 0; i < N; i++) {
      const f = ((i / N + scroll) % 1);
      const persp = f * f; // accelerate outward
      const y = vp[1] + persp * (H - vp[1]);
      const w = lerp(3, W * 0.035, persp);
      const h = lerp(8, H * 0.045, persp);
      ctx.fillStyle = rgba(pal.text, 0.5 + 0.3 * persp);
      ctx.fillRect(W / 2 - w / 2, y - h, w, h);
    }
    // roadside poles with wires, parallax marching past (kept clear of the
    // walking character at centre)
    const psp = t * (sc.speed || 1) * 0.22;
    for (let side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const f = ((i / 4 + psp) % 1);
        const persp = f * f;
        const y = vp[1] + persp * (H - vp[1]);
        const px = W / 2 + side * lerp(30, W * 0.64, persp);
        const ph = lerp(14, H * 0.26, persp);
        ctx.strokeStyle = rgba(pal.text, 0.35 + 0.4 * persp);
        ctx.lineWidth = lerp(1.5, 5, persp);
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y - ph); ctx.stroke();
        // crossarm
        ctx.lineWidth = lerp(1, 3.5, persp);
        ctx.beginPath(); ctx.moveTo(px - lerp(6, W * 0.04, persp), y - ph); ctx.lineTo(px + lerp(6, W * 0.04, persp), y - ph); ctx.stroke();
        // sagging wire to next pole (outside the centre corridor)
        if (i < 3) {
          const f2 = (((i + 1) / 4 + psp) % 1);
          const p2 = f2 * f2;
          const y2 = vp[1] + p2 * (H - vp[1]);
          const px2 = W / 2 + side * lerp(30, W * 0.64, p2);
          ctx.beginPath();
          ctx.moveTo(px, y - ph);
          ctx.quadraticCurveTo((px + px2) / 2, y - ph + lerp(4, H * 0.05, persp) * 0.4, px2, y2 - lerp(14, H * 0.26, p2));
          ctx.lineWidth = lerp(1, 2.5, persp);
          ctx.stroke();
        }
      }
    }
    // dust devils drifting across the road
    E.objFog(ctx, W, H, H * 0.6, t, sc.seed + 8, 0.05, pal);
    E.objMotes(ctx, W, H, t, sc.seed + 2, pal, { count: 22, maxY: H * 0.7, alpha: 0.4 });
  };

  // ————————————————————————————————— 3. the climb ————————————————————————
  E.worldClimb = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // distant peaks below-left (we are high already)
    ridge(ctx, W, H, H * 0.34, H * 0.1, sc.seed + 6, t * 0.006, 0.003, rgba(pal.colors[1] || "#1a2030", 0.45));
    E.objStars(ctx, W, H, t, sc.seed + 3, 70, H * 0.3);
    // the great slope: steep diagonal wall lower-left → upper-right
    const noise = E.makeNoise((sc.seed + 21) >>> 0);
    ctx.beginPath();
    ctx.moveTo(-40, H + 60);
    // slope surface: from bottom-left up to top-right, jagged
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const x = lerp(-40, W + 40, f);
      const y = lerp(H * 1.02, -60, Math.pow(f, 1.25));
      const jag = (noise(x * 0.01 + t * 0.01, 3.3) - 0.5) * H * 0.045;
      ctx.lineTo(x, y + jag);
    }
    ctx.lineTo(W + 40, H + 60);
    ctx.closePath();
    ctx.fillStyle = "#1c2130";
    ctx.fill();
    ctx.strokeStyle = rgba(pal.accent, 0.22);
    ctx.lineWidth = 4;
    ctx.stroke();
    // rock ledges (handholds) along the slope
    const rng = mulberry((hash("ledges") ^ sc.seed) >>> 0);
    for (let i = 0; i < 14; i++) {
      const f = 0.12 + rng() * 0.8;
      const x = lerp(0, W, f) + (rng() - 0.5) * 40;
      const y = lerp(H * 0.98, -40, Math.pow(f, 1.25)) + (rng() - 0.5) * 60;
      const s = 8 + rng() * 16;
      ctx.fillStyle = "#2a3145";
      roundRectPath(ctx, x, y, s * 2, s, s * 0.3);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2; ctx.stroke();
      if (rng() > 0.7) E.objPeakGlint(ctx, x + s, y - s * 0.4, s * 0.8, t * 0.7 + i);
    }
    // tumbling pebbles rolling down past the climber
    for (let i = 0; i < 5; i++) {
      const fr = ((t * (0.25 + i * 0.09) + i * 0.31) % 1);
      const px = W * (0.28 + i * 0.13) - fr * W * 0.1;
      const py = H * 0.24 + fr * H * 0.6;
      ctx.fillStyle = rgba(pal.colors[1] || "#3a4258", 0.8);
      ctx.beginPath(); ctx.arc(px, py, 4 + (i % 3) * 2, 0, Math.PI * 2); ctx.fill();
    }
    // abyss fog below
    E.objFog(ctx, W, H, H * 0.88, t, sc.seed + 12, 0.14, pal);
    E.objMotes(ctx, W, H, t, sc.seed + 4, pal, { count: 20, maxY: H * 0.8, alpha: 0.35 });
  };

  // ————————————————————————————————— 4. the storm ————————————————————————
  E.worldStorm = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0c14");
    g.addColorStop(0.55, pal.bg1);
    g.addColorStop(1, "#07080d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // roiling cloud banks (dark blobs on lissajous, near-black)
    ctx.globalCompositeOperation = "source-over";
    const rng = mulberry((hash("stormclouds") ^ sc.seed) >>> 0);
    for (let i = 0; i < 7; i++) {
      const cx = W * (0.15 + 0.7 * rng()) + Math.sin(t * (0.3 + rng() * 0.3) + i) * W * 0.06;
      const cy = H * (0.08 + 0.3 * rng()) + Math.cos(t * 0.2 + i * 1.7) * H * 0.02;
      const r = W * (0.2 + 0.15 * rng());
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cg.addColorStop(0, "rgba(6,8,14,0.75)");
      cg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(cx - r, cy - r * 0.6, r * 2, r * 1.2);
    }
    // ridge below (battling on the slope)
    ridge(ctx, W, H, H * 0.9, H * 0.12, sc.seed + 31, t * 0.01, 0.005, "#11141d");
    // rain, wind-driven
    E.objRain(ctx, W, H, t, pal, { density: (sc.rain ?? 1) * 1.3, wind: 0.55, seed: sc.seed });
  };

  // ————————————————————————————————— 5. summit sunrise ————————————————————
  E.worldSummit = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    const rise = sc.rise ?? 0.5; // 0 below horizon → 1 high
    // sky warming with the sun
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(0.55, lerpColor(pal.bg1, pal.accent, 0.22 + 0.3 * rise));
    g.addColorStop(1, lerpColor(pal.bg0, pal.accent, 0.12 * (1 - rise)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    E.objStars(ctx, W, H, t, sc.seed + 6, Math.max(8, 90 - 90 * rise), H * 0.4); // stars fade as sun rises
    // sun cresting above the cloud sea (below the caption band so the
    // kinetic words never fight the disc for contrast)
    E.objSun(ctx, W / 2, H * 0.52, W * 0.2, t, pal, { rise });
    // cloud sea below the summit (layered, drifting)
    const noise = E.makeNoise((sc.seed + 41) >>> 0);
    for (let layer = 0; layer < 3; layer++) {
      const y = H * (0.62 + layer * 0.09);
      const sp = 0.004 + layer * 0.006;
      ctx.beginPath();
      ctx.moveTo(-40, H + 40);
      for (let x = -40; x <= W + 40; x += 34) {
        const wv = noise(x * 0.006 + t * sp, layer * 7.7) * H * (0.05 + layer * 0.02);
        ctx.lineTo(x, y + Math.sin(x * 0.008 + t * 0.7 + layer) * H * 0.012 - wv);
      }
      ctx.lineTo(W + 40, H + 40);
      ctx.closePath();
      ctx.fillStyle = rgba(lerpColor(pal.bg1, "#ffffff", 0.2 + 0.25 * rise), 0.34 + layer * 0.22);
      ctx.fill();
    }
    // the summit platform we stand on (foreground rock)
    ctx.beginPath();
    ctx.moveTo(-40, H + 40);
    ctx.lineTo(-40, H * 0.86);
    ctx.quadraticCurveTo(W * 0.28, H * 0.8, W * 0.5, H * 0.865);
    ctx.quadraticCurveTo(W * 0.74, H * 0.92, W + 40, H * 0.88);
    ctx.lineTo(W + 40, H + 40);
    ctx.closePath();
    ctx.fillStyle = "#232837";
    ctx.fill();
    ctx.strokeStyle = rgba(pal.accent, 0.3);
    ctx.lineWidth = 4;
    ctx.stroke();
    // birds circling in the dawn
    E.objBirds(ctx, W * 0.18, H * 0.2, t, 5, W * 0.03);
    E.objBirds(ctx, W * 0.7, H * 0.14, t * 1.1 + 3, 4, W * 0.024);
    // warm motes
    E.objMotes(ctx, W, H, t, sc.seed + 8, pal, { count: 30, maxY: H * 0.75, alpha: 0.6 });
  };

  // ————————————————————————————————— 6. vault of coins ————————————————————
  E.worldVault = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // god rays from above
    for (let i = 0; i < 3; i++) {
      const a = Math.sin(t * 0.25 + i * 2.1) * 0.3;
      ctx.save();
      ctx.translate(W * (0.3 + i * 0.2), 0);
      ctx.rotate(a);
      const rg = ctx.createLinearGradient(0, 0, 0, H * 0.9);
      rg.addColorStop(0, rgba(pal.accent, 0.09));
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(120, H * 0.9); ctx.lineTo(-120, H * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    E.objMotes(ctx, W, H, t, sc.seed, pal, { count: 40, maxY: H, alpha: 0.7 });
  };

  // ————————————————————————————————— 7. night city (build) —————————————————
  E.worldCity = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    E.objStars(ctx, W, H, t, sc.seed + 5, 60, H * 0.4);
    E.objMoon(ctx, W * 0.8, H * 0.14, W * 0.07, t);
    E.objCityBuild(ctx, W, H, H * 0.9, t, pal, { progress: sc.prog ?? 0.5, seed: sc.seed });
  };

  // ————————————————————————————————— 8. study / desk —————————————————————
  E.worldStudy = function (ctx, W, H, t, sc) {
    const pal = sc.palette;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // warm lamp cone from upper-left
    const lg = ctx.createLinearGradient(W * 0.25, 0, W * 0.55, H);
    lg.addColorStop(0, rgba(pal.accent, 0.14));
    lg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(W * 0.2, 0); ctx.lineTo(W * 0.42, 0);
    ctx.lineTo(W * 0.72, H * 0.92); ctx.lineTo(W * 0.2, H * 0.92);
    ctx.closePath(); ctx.fill();
    E.objMotes(ctx, W, H, t, sc.seed, pal, { count: 26, maxY: H, alpha: 0.5 });
  };

  // ————————————————————————————————— helpers ———————————————————————————
  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  function lerpColor(hA, hB, f) {
    const a = E.hex2rgb(hA), b = E.hex2rgb(hB);
    return `rgb(${Math.round(lerp(a[0], b[0], f))},${Math.round(lerp(a[1], b[1], f))},${Math.round(lerp(a[2], b[2], f))})`;
  }
  E.lerpColor = lerpColor;

  E.WORLDS = {
    dark_mountain: E.worldDarkMountain,
    road: E.worldRoad,
    climb: E.worldClimb,
    storm: E.worldStorm,
    summit: E.worldSummit,
    vault: E.worldVault,
    city: E.worldCity,
    study: E.worldStudy,
  };
})();
