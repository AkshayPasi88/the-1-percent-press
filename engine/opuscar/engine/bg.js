// bg.js — animated background scenes. Every scene is a pure function of
// (t, seed): the pixels are different every single frame. No static fills:
// even the base coat is an animated two-stop gradient with drifting noise.
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, lerp, rgba, mulberry, hash, makeNoise, ss } = E;

  // ————————————————————————————————— base coat (never flat) —————————————————

  /** Animated vertical gradient + drifting blotches. Every scene starts with this. */
  function base(ctx, W, H, t, s) {
    const pal = s.palette;
    const wob = Math.sin(t * 0.9 + s.phase) * 0.5 + 0.5;
    const g = ctx.createLinearGradient(0, 0, W * 0.25 * Math.sin(t * 0.21 + s.phase), H);
    g.addColorStop(0, pal.bg0);
    g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // two slow drifting blotches so even "calm" scenes breathe
    const n = s.noise;
    for (let i = 0; i < 2; i++) {
      const cx = W * (0.3 + 0.4 * n(t * 0.05 + i * 7.3, s.phase));
      const cy = H * (0.3 + 0.4 * n(t * 0.043 + i * 11.1, s.phase + 3));
      const r = W * (0.55 + 0.25 * Math.sin(t * 0.6 + i * 2.1 + s.phase));
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, rgba(pal.colors[i % pal.colors.length], 0.06 + 0.05 * wob));
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ————————————————————————————————— scene painters ————————————————————————

  /** 1. rings — expanding pulse rings from seeded emitters. */
  function rings(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const rng = mulberry((hash("rings" + s.id) ^ s.seed) >>> 0);
    const K = 3 + Math.floor(rng() * 2);
    for (let k = 0; k < K; k++) {
      const ex = W * (0.25 + rng() * 0.5), ey = H * (0.18 + rng() * 0.64);
      const period = (1.1 + rng() * 1.6) / sp;
      const age = (t + rng() * 9) % period;
      const r = (age / period) * (W * 1.15);
      const col = pal.colors[k % pal.colors.length];
      const a = 0.75 * (1 - age / period);
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1, r), 0, Math.PI * 2);
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = 10 + 26 * (1 - age / period);
      ctx.stroke();
      // ring shock lip
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(1, r * 1.02), 0, Math.PI * 2);
      ctx.strokeStyle = rgba(col, a * 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // slow rotating halo
    ctx.save();
    ctx.translate(W / 2, H * 0.5);
    ctx.rotate(t * 0.15 * sp);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, W * (0.2 + i * 0.11), 0, Math.PI * 2);
      ctx.strokeStyle = rgba(pal.accent, 0.05 + 0.04 * Math.sin(t * 2 + i));
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 2. flow — particle storm advected through value noise. */
  function flow(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const N = 260;
    const noise = s.noise;
    const rng = mulberry((hash("flow" + s.id) ^ s.seed) >>> 0);
    // deterministic per-particle offsets, advected from a fixed birth lattice
    for (let i = 0; i < N; i++) {
      const bx = rng(), by = rng();
      let x = bx * W, y = (by + t * 0.05 * sp) % 1 * H;
      // integrate a few noise steps for the trail head
      for (let st = 0; st < 5; st++) {
        const ang = noise(x * 0.004 + st * 3.1 + t * 0.02 * sp, y * 0.004 - t * 0.015 * sp) * Math.PI * 4;
        x += Math.cos(ang) * 26 * sp;
        y += Math.sin(ang) * 26 * sp;
      }
      x = ((x / W) % 1 + 1) % 1 * W;
      y = ((y / H) % 1 + 1) % 1 * H;
      const col = pal.colors[i % pal.colors.length];
      const sz = 2 + ((i * 7) % 5);
      // short comet trail (two echoes) so motion is visible per frame
      ctx.fillStyle = rgba(col, 0.85);
      ctx.fillRect(x, y, sz, sz);
      ctx.fillStyle = rgba(col, 0.25);
      ctx.fillRect(x - 12 * sp, y - 4, sz, sz);
      ctx.fillRect(x - 24 * sp, y - 8, sz, sz);
      if (i % 9 === 0) { // rare accent sparks
        ctx.fillStyle = rgba(pal.accent, 0.9);
        ctx.fillRect(x, y + 10, sz + 3, sz + 3);
      }
    }
  }

  /** 3. waves — liquid gradient bands drifting horizontally. */
  function waves(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const BANDS = 9;
    for (let b = 0; b < BANDS; b++) {
      const y0 = (b / BANDS) * H * 1.3 - H * 0.15;
      const amp = 60 + 50 * Math.sin(t * 0.8 + b * 1.7 + s.phase);
      const col = pal.colors[b % pal.colors.length];
      ctx.beginPath();
      ctx.moveTo(-20, H + 40);
      const ph = t * (1.1 + b * 0.13) * sp + b * 2.3 + s.phase;
      for (let x = -20; x <= W + 20; x += 24) {
        const y = y0 + Math.sin(x * 0.006 + ph) * amp + Math.cos(x * 0.013 - ph * 0.7) * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, H + 40);
      ctx.closePath();
      ctx.fillStyle = rgba(col, 0.16 + 0.1 * Math.sin(t + b));
      ctx.fill();
      ctx.strokeStyle = rgba(col, 0.5);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  /** 4. tunnel — perspective grid racing toward the viewer + horizon glow. */
  function tunnel(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const hz = H * 0.42;
    // horizon glow
    const g = ctx.createLinearGradient(0, hz - W * 0.35, 0, hz + W * 0.2);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, rgba(pal.accent, 0.28));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, hz - W * 0.35, W, W * 0.55);
    // floor + ceiling perspective lines, scrolling in depth
    ctx.strokeStyle = rgba(pal.colors[0], 0.65);
    ctx.lineWidth = 2.2;
    const K = 14;
    const scroll = (t * sp * 1.4) % (1 / K);
    for (let i = 0; i <= K; i++) {
      const d = (i + scroll) / K; // 0 far → 1 near
      const yy = hz + (H - hz) * d * d;
      ctx.beginPath();
      ctx.moveTo(-W, yy);
      ctx.lineTo(W * 2, yy);
      ctx.stroke();
      const y2 = hz - hz * d * d * 1.1;
      ctx.beginPath();
      ctx.moveTo(-W, y2);
      ctx.lineTo(W * 2, y2);
      ctx.stroke();
    }
    for (let i = -8; i <= 8; i++) {
      const x = W / 2 + i * W * 0.1;
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 3, hz);
      ctx.lineTo(x * 3 - W, H * 1.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 3, hz);
      ctx.lineTo(x * 3 - W, -H * 0.35);
      ctx.stroke();
    }
    // racing glow dot
    const rd = (t * sp) % 1;
    const ry = hz + (H - hz) * rd * rd;
    const rr = 4 + rd * 26;
    ctx.fillStyle = rgba(pal.accent, 0.9);
    ctx.beginPath();
    ctx.arc(W / 2, ry, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  /** 5. stripes — fat diagonal bands sliding in alternating directions. */
  function stripes(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.42 + Math.sin(t * 0.1 + s.phase) * 0.08);
    const D = W + H;
    const N = 8;
    for (let i = 0; i < N; i++) {
      const dir = i % 2 ? 1 : -1;
      const off = ((t * sp * (0.35 + (i % 3) * 0.22) * dir * 260) % (D / N) + D / N) % (D / N);
      const y = -D / 2 + (i / N) * D + off;
      const col = pal.colors[i % pal.colors.length];
      ctx.fillStyle = rgba(col, 0.22);
      ctx.fillRect(-D, y, D * 2, D / N * 0.34);
      ctx.fillStyle = rgba(col, 0.08);
      ctx.fillRect(-D, y + D / N * 0.4, D * 2, D / N * 0.6);
    }
    // accent ticker edge
    const tick = ((t * sp * 500) % 90);
    ctx.fillStyle = rgba(pal.accent, 0.8);
    ctx.fillRect(-D, -D / 2 + tick, D * 2, 6);
    ctx.restore();
  }

  /** 6. shards — rotating polygons orbiting the centre, 3 parallax depths. */
  function shards(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const rng = mulberry((hash("shards" + s.id) ^ s.seed) >>> 0);
    const cx = W / 2, cy = H * 0.5;
    for (let layer = 0; layer < 3; layer++) {
      const K = 7 + layer * 4;
      const rad = W * (0.18 + layer * 0.14);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * sp * (layer % 2 ? -0.5 : 0.35) + layer);
      for (let i = 0; i < K; i++) {
        const a = (i / K) * Math.PI * 2;
        const r = rad * (0.7 + rng() * 0.6);
        const x = Math.cos(a) * r, y = Math.sin(a) * r * 1.7;
        const col = layer === 2 ? pal.accent : pal.colors[(i + layer) % pal.colors.length];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + t * (1.5 + layer));
        ctx.fillStyle = rgba(col, layer === 0 ? 0.5 : 0.28);
        const sz = (16 + layer * 10) * (0.6 + rng() * 0.8);
        ctx.beginPath();
        ctx.moveTo(0, -sz);
        ctx.lineTo(sz * 0.7, sz * 0.6);
        ctx.lineTo(-sz * 0.7, sz * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  /** 7. mosaic — tile grid lighting up in seeded travelling waves. */
  function mosaic(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const cols = 7, rows = 12;
    const tw = W / cols, th = H / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = Math.hypot(c - cols / 2 + 0.5, (r - rows / 2 + 0.5) * 0.9);
        const wv = Math.sin(t * 2.2 * sp - d * 0.7 + s.phase);
        const hot = clamp(wv, 0, 1);
        const col = pal.colors[(c + r) % pal.colors.length];
        ctx.fillStyle = rgba(col, 0.05 + hot * 0.4);
        ctx.fillRect(c * tw + 3, r * th + 3, tw - 6, th - 6);
        if (hot > 0.86) {
          ctx.strokeStyle = rgba(pal.accent, (hot - 0.86) * 5);
          ctx.lineWidth = 3;
          ctx.strokeRect(c * tw + 3, r * th + 3, tw - 6, th - 6);
        }
      }
    }
  }

  /** 8. blobs — soft luminous blobs on lissajous paths. */
  function blobs(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const K = 5;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < K; i++) {
      const f1 = 0.23 + i * 0.11, f2 = 0.17 + i * 0.07;
      const cx = W / 2 + Math.sin(t * f1 * sp + i * 1.9 + s.phase) * W * 0.36;
      const cy = H / 2 + Math.cos(t * f2 * sp + i * 0.8) * H * 0.3;
      const r = W * (0.2 + 0.14 * Math.sin(t * 0.7 + i * 2.2));
      const col = i % 2 ? pal.accent : pal.colors[i % pal.colors.length];
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(col, 0.35));
      g.addColorStop(0.55, rgba(col, 0.12));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /** 9. matrix — glyph columns raining with speed variance. */
  function matrix(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const rng = mulberry((hash("matrix" + s.id) ^ s.seed) >>> 0);
    const chars = "01ABDEGHMNPRSTXZ%+=?".split("");
    const colW = 54;
    const nCols = Math.floor(W / colW);
    ctx.textAlign = "center";
    ctx.font = "700 40px 'Source Sans 3', sans-serif";
    for (let c = 0; c < nCols; c++) {
      const speed = (2.2 + rng() * 7) * sp * 120;
      const head = ((t * speed + rng() * H * 2) % (H + 300)) - 150;
      const trail = 8 + Math.floor(rng() * 8);
      for (let k = 0; k < trail; k++) {
        const y = head - k * 46;
        if (y < -60 || y > H + 60) continue;
        const gi = (c * 13 + k * 7 + Math.floor(t * 9)) % chars.length; // glyphs mutate every frame-step
        const ch = chars[gi];
        if (k === 0) {
          ctx.fillStyle = rgba(pal.accent, 0.95);
        } else {
          ctx.fillStyle = rgba(pal.colors[c % pal.colors.length], 0.65 * (1 - k / trail));
        }
        ctx.fillText(ch, c * colW + colW / 2, y);
      }
    }
    ctx.textAlign = "left";
  }

  /** 10. spotlight — sweeping cone over a dot texture on near-black. */
  function spotlight(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    // dot texture, always crawling
    const rng = mulberry((hash("spot" + s.id) ^ s.seed) >>> 0);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    const dots = [];
    for (let i = 0; i < 130; i++) dots.push([rng(), rng(), rng()]);
    ctx.fillStyle = rgba(pal.colors[0], 0.5);
    for (const [dx, dy, dz] of dots) {
      const x = ((dx + t * 0.013 * sp) % 1) * W;
      const y = ((dy + t * 0.008 * sp) % 1) * H;
      const r = 1.4 + dz * 2.6;
      ctx.fillRect(x, y, r * 2, r * 2);
    }
    // sweeping cone
    const ang = Math.sin(t * 0.55 * sp + s.phase) * 0.9 + Math.PI / 2;
    const ox = W / 2, oy = -H * 0.1;
    const L = H * 1.6;
    const spread = 0.3;
    const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * L, oy + Math.sin(ang) * L);
    g.addColorStop(0, rgba(pal.accent, 0.5));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(ang - spread) * L, oy + Math.sin(ang - spread) * L);
    ctx.lineTo(ox + Math.cos(ang + spread) * L, oy + Math.sin(ang + spread) * L);
    ctx.closePath();
    ctx.fill();
    // floor bounce
    ctx.fillStyle = rgba(pal.accent, 0.06 + 0.05 * Math.sin(t * 3));
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
  }

  /** 11. orbits — dense dot rings rotating at different speeds. */
  function orbits(ctx, W, H, t, s) {
    const pal = s.palette, sp = s.speed;
    const cx = W / 2, cy = H * 0.5;
    const R = 460;
    for (let ring = 0; ring < 9; ring++) {
      const r = R * (0.16 + ring * 0.1);
      const rot = t * sp * (ring % 2 ? 0.7 + ring * 0.1 : -(0.4 + ring * 0.07)) + ring;
      const K = 18 + ring * 6;
      for (let i = 0; i < K; i++) {
        const a = (i / K) * Math.PI * 2 + rot;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r * 1.55;
        const col = i % 11 === 0 ? pal.accent : pal.colors[ring % pal.colors.length];
        const sz = 3 + (i % 3) + ring * 0.4;
        ctx.fillStyle = rgba(col, 0.3 + 0.45 * Math.sin(t * 2 + i));
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** 12. glitch — base scene under travelling RGB-split slices. */
  function glitch(ctx, W, H, t, s, inner) {
    inner(ctx, W, H, t, s);
    const pal = s.palette;
    const rng = mulberry((hash("glitch" + s.id) ^ Math.floor(t * 14)) >>> 0); // reseed every ~14th of a sec: jitter is per-frame
    const K = 3 + Math.floor(rng() * 5);
    for (let k = 0; k < K; k++) {
      const y = rng() * H, h = 8 + rng() * 60;
      const dx = (rng() - 0.5) * 90 * (0.3 + Math.sin(t * 7 + k));
      ctx.fillStyle = rgba(pal.accent, 0.14);
      ctx.fillRect(dx, y, W, h * 0.5);
      ctx.fillStyle = rgba(pal.colors[k % pal.colors.length], 0.16);
      ctx.fillRect(-dx, y + h * 0.5, W, h * 0.5);
    }
  }

  // ————————————————————————————————— dispatcher ——————————————————————————

  const SCENES = { rings, flow, waves, tunnel, stripes, shards, mosaic, blobs, matrix, spotlight, orbits };

  /**
   * Draw the animated background for a scene spec at time t.
   * s = { id, type, seed, palette, speed, phase, noise }
   */
  E.drawBackground = function (ctx, W, H, t, s) {
    base(ctx, W, H, t, s);
    const fn = SCENES[s.type] || rings;
    if (s.type === "glitch") {
      // glitch wraps the previous scene type stored in s.inner
      const innerFn = SCENES[s.inner] || rings;
      const innerSpec = Object.assign({}, s, { type: s.inner });
      glitch(ctx, W, H, t, s, (c, w, h, tt, ss) => innerFn(c, w, h, tt, innerSpec));
    } else {
      fn(ctx, W, H, t, s);
    }
  };

  E.BG_TYPES = Object.keys(SCENES).concat(["glitch"]);
})();
