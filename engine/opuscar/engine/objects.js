// objects.js — custom animated objects, drawn entirely in code. Every object
// is an original asset with its own animation, positioning, lighting and
// movement (PRD: "AI doesn't search for clips — it creates the animated world").
// Style: flat toon fills + one hard shadow side + bold outlines + accent
// glows, consistent with the Seeker character. All pure functions of t.
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, lerp, rgba, mulberry, hash, seg } = E;

  const OUT = "rgba(9,10,16,0.95)";

  // small local helpers -----------------------------------------------------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  /** spark glint (4-point star) used on peaks, coins, sun edges. */
  function glint(ctx, x, y, s, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = rgba("#ffffff", a);
    const w = s * 0.16;
    ctx.fillRect(-s / 2, -w / 2, s, w);
    ctx.fillRect(-w / 2, -s / 2, w, s);
    ctx.restore();
  }

  // ————————————————————————————————— clock & time ————————————————————————

  /** Ringing alarm clock — bells vibrating, hammer, legs. opts.shake 0..1 */
  E.objAlarmClock = function (ctx, x, y, s, t, pal, o = {}) {
    const shake = o.shake ?? 1;
    const jx = Math.sin(t * 43) * 3 * shake, jy = Math.cos(t * 39) * 2 * shake;
    ctx.save();
    ctx.translate(x + jx, y + jy);
    const lw = Math.max(3, s * 0.05);
    // legs
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.34); ctx.lineTo(-s * 0.42, s * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.3, s * 0.34); ctx.lineTo(s * 0.42, s * 0.62); ctx.stroke();
    // bells + hammer
    for (const bx of [-1, 1]) {
      ctx.save();
      ctx.translate(bx * s * 0.72, -s * 0.62);
      ctx.rotate(bx * (0.5 + Math.sin(t * 43 + bx) * 0.16 * shake));
      ctx.beginPath(); ctx.arc(0, 0, s * 0.24, Math.PI, 0);
      ctx.lineTo(s * 0.24, s * 0.16); ctx.lineTo(-s * 0.24, s * 0.16);
      ctx.closePath();
      ctx.fillStyle = pal.accent; ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.7; ctx.stroke();
      ctx.restore();
    }
    // body
    ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = pal.colors[0]; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
    // face
    ctx.beginPath(); ctx.arc(0, 0, s * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = "#f4f1e6"; ctx.fill();
    ctx.lineWidth = lw * 0.5; ctx.stroke();
    // ticks
    ctx.strokeStyle = "rgba(20,22,30,0.7)"; ctx.lineWidth = lw * 0.35;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.38, Math.sin(a) * s * 0.38);
      ctx.lineTo(Math.cos(a) * s * 0.44, Math.sin(a) * s * 0.44);
      ctx.stroke();
    }
    // hands spinning fast to 5:00 (hour ≈ 5, minute racing)
    const spin = (t * (2.5 + 5 * shake)) % (Math.PI * 2);
    const aH = -Math.PI / 2 + (5 / 12) * Math.PI * 2 + Math.sin(spin) * 0.3;
    const aM = -Math.PI / 2 + spin;
    ctx.lineCap = "round"; ctx.strokeStyle = OUT;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aH) * s * 0.24, Math.sin(aH) * s * 0.24); ctx.stroke();
    ctx.strokeStyle = pal.accent; ctx.lineWidth = lw * 0.55;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aM) * s * 0.38, Math.sin(aM) * s * 0.38); ctx.stroke();
    // motion rings while shaking
    if (shake > 0.1) {
      ctx.strokeStyle = rgba(pal.accent, 0.5 * shake);
      ctx.lineWidth = lw * 0.5;
      const rr = s * (0.66 + 0.12 * (Math.sin(t * 20) * 0.5 + 0.5));
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  };

  /** Giant wall clock — hands accelerate, "time running out". o.urgency 0..1 */
  E.objBigClock = function (ctx, x, y, s, t, pal, o = {}) {
    const urg = o.urgency ?? 0.5;
    const rate = 0.3 + urg * 2.6;
    ctx.save();
    ctx.translate(x, y);
    const lw = Math.max(3, s * 0.035);
    // outer glow ring
    const g = ctx.createRadialGradient(0, 0, s * 0.4, 0, 0, s * 0.75);
    g.addColorStop(0, rgba(pal.accent, 0.16 + 0.12 * urg));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    // face
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(14,15,22,0.86)"; ctx.fill();
    ctx.strokeStyle = pal.accent; ctx.lineWidth = lw; ctx.stroke();
    // ticks
    ctx.strokeStyle = rgba(pal.text, 0.55); ctx.lineWidth = lw * 0.35;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const R1 = i % 3 === 0 ? s * 0.36 : s * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R1, Math.sin(a) * R1);
      ctx.lineTo(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45);
      ctx.stroke();
    }
    // sweeping hands (accelerating with urgency)
    const aM = -Math.PI / 2 + ((t * rate) % 1) * Math.PI * 2;
    const aH = -Math.PI / 2 + ((t * rate * 0.14) % 1) * Math.PI * 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = pal.text; ctx.lineWidth = lw * 0.9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aH) * s * 0.24, Math.sin(aH) * s * 0.24); ctx.stroke();
    ctx.strokeStyle = pal.accent; ctx.lineWidth = lw * 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(aM) * s * 0.4, Math.sin(aM) * s * 0.4); ctx.stroke();
    // pendulum tick
    const swing = Math.sin(t * (3 + urg * 9));
    ctx.strokeStyle = rgba(pal.text, 0.7); ctx.lineWidth = lw * 0.5;
    ctx.beginPath(); ctx.moveTo(0, s * 0.48);
    ctx.quadraticCurveTo(swing * s * 0.08, s * 0.68, swing * s * 0.14, s * 0.86);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(swing * s * 0.14, s * 0.86, s * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent; ctx.fill();
    ctx.restore();
  };

  /** Hourglass — sand falling, top emptying, bottom piling. */
  E.objHourglass = function (ctx, x, y, s, t, pal, o = {}) {
    const p = o.progress ?? ((Math.sin(t * 0.35) + 1) / 2); // 0 just flipped → 1 nearly done
    ctx.save();
    ctx.translate(x, y);
    const lw = Math.max(2.5, s * 0.05);
    ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.lineJoin = "round";
    // frame
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.55); ctx.lineTo(s * 0.4, -s * 0.55);
    ctx.moveTo(-s * 0.4, s * 0.55); ctx.lineTo(s * 0.4, s * 0.55);
    ctx.stroke();
    // glass
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.5);
    ctx.quadraticCurveTo(0, -s * 0.16, -s * 0.34, s * 0.5);
    ctx.lineTo(s * 0.34, s * 0.5);
    ctx.quadraticCurveTo(0, -s * 0.16, s * 0.34, -s * 0.5);
    ctx.closePath();
    ctx.fillStyle = "rgba(210,225,240,0.12)";
    ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip();
    // top sand (shrinks with p)
    const topH = (1 - p) * s * 0.34;
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3 * (1 - p * 0.7), -s * 0.5);
    ctx.lineTo(s * 0.3 * (1 - p * 0.7), -s * 0.5);
    ctx.lineTo(s * 0.12 * (1 - p * 0.5), -s * 0.5 + topH);
    ctx.lineTo(-s * 0.12 * (1 - p * 0.5), -s * 0.5 + topH);
    ctx.closePath(); ctx.fill();
    // falling stream (wobbling)
    ctx.fillRect(-s * 0.02 + Math.sin(t * 18) * s * 0.008, -s * 0.16, s * 0.035, s * 0.32);
    // bottom pile (grows)
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, s * 0.5);
    ctx.quadraticCurveTo(0, s * 0.5 - p * s * 0.36, s * 0.34, s * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  // ————————————————————————————————— money —————————————————————————————————

  /** Coins: spinning discs falling & stacking. o.stack: current stack count. */
  E.objCoins = function (ctx, x, y, s, t, pal, o = {}) {
    const stack = o.stack ?? 6;
    const rng = mulberry((hash("coins" + (o.id || "x")) ^ (o.seed || 7)) >>> 0);
    ctx.save();
    ctx.translate(x, y);
    const lw = Math.max(2.5, s * 0.05);
    // stack column
    for (let i = 0; i < Math.max(3, Math.floor(stack)); i++) {
      const wob = (rng() - 0.5) * s * 0.08;
      const yy = -i * s * 0.16;
      ctx.beginPath();
      ctx.ellipse(wob, yy, s * 0.5, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fillStyle = pal.accent; ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.7; ctx.stroke();
      // inner face ellipse (readable as coin)
      ctx.beginPath();
      ctx.ellipse(wob, yy - s * 0.012, s * 0.3, s * 0.07, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba("#000000", 0.25); ctx.lineWidth = lw * 0.5; ctx.stroke();
      if (i % 3 === 0) glint(ctx, wob + s * 0.34, yy - s * 0.05, s * 0.16, 0.7);
    }
    // falling coin(s) above — spin = ellipse squash cycle
    const fr = ((t * 0.7) % 1);
    const fx = s * (0.4 + Math.sin(t * 1.1) * 0.3);
    const fy = -s * (0.8 + (1 - fr) * 1.4);
    const sq = Math.abs(Math.cos(t * 6 + (o.seed || 7)));
    ctx.beginPath();
    ctx.ellipse(fx, fy, s * 0.34 * sq + s * 0.06, s * 0.34, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.6; ctx.stroke();
    glint(ctx, fx + s * 0.2, fy - s * 0.2, s * 0.2, 0.8);
    ctx.restore();
  };

  // ————————————————————————————————— city / build —————————————————————————

  /** City skyline under construction — floors rise, cranes rotate, windows light. */
  E.objCityBuild = function (ctx, W, H, y, t, pal, o = {}) {
    const prog = o.progress ?? 0.5;
    const rng = mulberry((hash("city" + (o.id || "x")) ^ (o.seed || 3)) >>> 0);
    ctx.save();
    const lw = Math.max(2, W * 0.004);
    // three parallax rows of buildings
    for (let row = 0; row < 3; row++) {
      const depth = row / 2;
      const hue = pal.colors[row % pal.colors.length];
      const maxFloors = 4 + Math.floor(6 * (1 - depth * 0.5));
      const bw = W * (0.16 - depth * 0.04);
      let bx = -bw * 0.4;
      while (bx < W) {
        const floors = Math.max(2, Math.round(maxFloors * clamp(prog * (0.6 + rng() * 0.55), 0.15, 1)));
        const fh = (H - y) * 0.062;
        const bh = floors * fh;
        const wobble = Math.sin(t * (0.6 + row * 0.2) + bx) * 3;
        // body
        ctx.fillStyle = row === 2 ? hue : rgba(hue, 0.5 - depth * 0.18);
        ctx.fillRect(bx, y - bh + wobble, bw, bh + 40);
        ctx.strokeStyle = OUT; ctx.lineWidth = lw * (1 - depth * 0.3);
        ctx.strokeRect(bx, y - bh + wobble, bw, bh + 40);
        // floors rising: the top floor pulses while under construction
        const top = y - bh + wobble;
        if (prog < 0.98) {
          const grow = clamp((Math.sin(t * 2.2 + bx * 0.01) + 1) / 2, 0, 1);
          ctx.fillStyle = rgba(pal.accent, 0.16 + 0.2 * grow);
          ctx.fillRect(bx, top - fh * (1 - grow), bw, fh);
        }
        // windows lighting up in waves
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < 3; c++) {
            const wi = f * 3 + c + Math.floor(bx / 10);
            const lit = (Math.sin(t * 1.4 + wi * 2.7) > 0.25 - prog * 0.35) ? 1 : 0.15;
            ctx.fillStyle = rgba(pal.accent, 0.24 * lit * (1 - depth * 0.2));
            ctx.fillRect(bx + bw * (0.14 + c * 0.3), y - bh + f * fh + fh * 0.24 + wobble, bw * 0.2, fh * 0.5);
          }
        }
        // crane on some buildings
        if (row === 0 && (rng() > 0.55)) {
          const cx = bx + bw * 0.5;
          const armA = Math.sin(t * (0.7 + rng() * 0.3)) * 0.5 - 0.25;
          ctx.strokeStyle = pal.accent; ctx.lineWidth = lw * 1.1;
          ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, top - fh * 2.2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, top - fh * 2.2);
          ctx.lineTo(cx + Math.cos(armA) * bw * 0.5, top - fh * 2.2 + Math.sin(armA) * bw * 0.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(armA) * bw * 0.5, top - fh * 2.2 + Math.sin(armA) * bw * 0.5);
          ctx.lineTo(cx + Math.cos(armA) * bw * 0.5, top - fh * 1.4 + Math.sin(armA) * bw * 0.5);
          ctx.stroke();
        }
        bx += bw * (1.25 + rng() * 0.3);
      }
    }
    ctx.restore();
  };

  // ————————————————————————————————— gym / study ——————————————————————————

  /** Barbell with plates + chalk-dust lift burst. o.lift 0 ground → 1 pressed. */
  E.objBarbell = function (ctx, x, y, s, t, pal, o = {}) {
    const lift = o.lift ?? 0;
    ctx.save();
    ctx.translate(x, y - lift * s * 0.55);
    const lw = Math.max(3, s * 0.045);
    ctx.lineCap = "round";
    // bar
    ctx.strokeStyle = "#c9ccd6"; ctx.lineWidth = lw * 0.9;
    ctx.beginPath(); ctx.moveTo(-s * 0.95, 0); ctx.lineTo(s * 0.95, 0); ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.3;
    ctx.beginPath(); ctx.moveTo(-s * 0.95, 0); ctx.lineTo(s * 0.95, 0); ctx.stroke();
    // plates each side (two sizes)
    for (const side of [-1, 1]) {
      for (const [px, pr, col] of [[0.62, 0.3, pal.colors[0]], [0.74, 0.24, pal.colors[1] || pal.colors[0]]]) {
        ctx.beginPath();
        ctx.ellipse(side * s * px, 0, pr * s * 0.35, pr * s, 0, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.6; ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(side * s * px, 0, pr * s * 0.2, pr * s * 0.7, 0, 0, Math.PI * 2);
        ctx.strokeStyle = rgba("#000000", 0.3); ctx.lineWidth = lw * 0.4; ctx.stroke();
      }
    }
    // chalk dust on lift
    if (lift > 0.4) {
      const rng = mulberry(hash("chalk") >>> 0);
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2;
        const r = s * (0.2 + rng() * 0.5) * lift;
        ctx.fillStyle = rgba("#ffffff", 0.25 * (1 - lift * 0.5));
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.5 - lift * s * 0.3, s * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  /** Book stack + open book with floating turning pages. */
  E.objBooks = function (ctx, x, y, s, t, pal) {
    ctx.save();
    ctx.translate(x, y);
    const lw = Math.max(2.5, s * 0.05);
    const cols = [pal.colors[0], pal.colors[1] || "#3a4a6b", pal.colors[0]];
    // stack of 3
    for (let i = 0; i < 3; i++) {
      const w = s * (1.0 - i * 0.08), h = s * 0.16;
      ctx.save();
      ctx.translate((i % 2 ? s * 0.03 : -s * 0.02), -i * h);
      roundRect(ctx, -w / 2, -h, w, h, s * 0.03);
      ctx.fillStyle = cols[i % cols.length]; ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.6; ctx.stroke();
      // pages edge
      ctx.fillStyle = "#efe9da";
      ctx.fillRect(-w / 2 + s * 0.05, -h * 0.5, w * 0.9, h * 0.18);
      ctx.restore();
    }
    // open book on top
    const oy = -3 * s * 0.16;
    ctx.save();
    ctx.translate(0, oy);
    const flap = Math.sin(t * 2.1);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(-0.12 - flap * 0.1 * side);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.1);
      ctx.quadraticCurveTo(s * 0.55, -s * 0.34, s * 0.6, -s * 0.06);
      ctx.quadraticCurveTo(s * 0.55, s * 0.18, 0, s * 0.12);
      ctx.closePath();
      ctx.fillStyle = "#f4efdd"; ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.6; ctx.stroke();
      ctx.strokeStyle = "rgba(40,45,60,0.5)"; ctx.lineWidth = lw * 0.3;
      for (let l = 0; l < 3; l++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.06 + l * s * 0.06);
        ctx.lineTo(s * 0.45, -s * 0.14 + l * s * 0.06);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    // floating page spiralling up
    const pr = (t * 0.55) % 1;
    const px = Math.sin(t * 1.7) * s * 0.55;
    const py = oy - s * (0.4 + pr * 1.6);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t * 2.3);
    ctx.globalAlpha = clamp(1 - pr * 1.3, 0, 1);
    roundRect(ctx, -s * 0.12, -s * 0.16, s * 0.24, s * 0.32, s * 0.02);
    ctx.fillStyle = "#f7f2e2"; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.35; ctx.stroke();
    ctx.restore();
    ctx.restore();
  };

  // ————————————————————————————————— sky & weather ———————————————————————

  /** Rising sun with rotating rays. o.rise 0 below horizon → 1 ascended. */
  E.objSun = function (ctx, x, y, s, t, pal, o = {}) {
    const rise = o.rise ?? 0.5;
    const cy = y + (1 - rise) * s * 1.4;
    ctx.save();
    // glow
    const g = ctx.createRadialGradient(x, cy, s * 0.1, x, cy, s * 1.5);
    g.addColorStop(0, rgba(pal.accent, 0.5));
    g.addColorStop(0.4, rgba(pal.accent, 0.18));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - s * 2, cy - s * 2, s * 4, s * 4);
    // rays (rotating, breathing length)
    ctx.translate(x, cy);
    ctx.rotate(t * 0.12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const len = s * (0.62 + 0.14 * Math.sin(t * 1.3 + i));
      ctx.strokeStyle = rgba(pal.accent, 0.32);
      ctx.lineWidth = s * 0.045;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.62, Math.sin(a) * s * 0.62);
      ctx.lineTo(Math.cos(a) * (s * 0.62 + len), Math.sin(a) * (s * 0.62 + len));
      ctx.stroke();
    }
    ctx.rotate(-t * 0.12);
    // disc
    ctx.beginPath(); ctx.arc(0, 0, s * 0.56, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = s * 0.03; ctx.stroke();
    // shimmer arc on the disc
    ctx.beginPath(); ctx.arc(0, 0, s * 0.4, Math.PI * 0.2 + t * 0.3, Math.PI * 0.8 + t * 0.3);
    ctx.strokeStyle = rgba("#ffffff", 0.5); ctx.lineWidth = s * 0.035; ctx.stroke();
    glint(ctx, s * 0.3, -s * 0.3, s * 0.3, 0.5 + 0.3 * Math.sin(t * 2));
    ctx.restore();
  };

  /** Moon with craters + halo + slow drift. */
  E.objMoon = function (ctx, x, y, s, t) {
    const dx = Math.sin(t * 0.07) * s * 0.1;
    ctx.save();
    ctx.translate(x + dx, y);
    const g = ctx.createRadialGradient(0, 0, s * 0.4, 0, 0, s * 1.2);
    g.addColorStop(0, "rgba(214,226,255,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "#dfe6f5"; ctx.fill();
    ctx.strokeStyle = "rgba(10,12,20,0.5)"; ctx.lineWidth = s * 0.03; ctx.stroke();
    // craters
    ctx.fillStyle = "rgba(150,165,195,0.5)";
    for (const [cx, cy, cr] of [[-0.18, -0.1, 0.11], [0.2, 0.12, 0.08], [0.05, -0.28, 0.06], [-0.3, 0.22, 0.05]]) {
      ctx.beginPath(); ctx.arc(cx * s, cy * s, cr * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /** Star field — twinkling, slight drift. */
  E.objStars = function (ctx, W, H, t, seed, density, maxY) {
    const rng = mulberry((hash("stars") ^ (seed || 1)) >>> 0);
    const n = density || 90;
    for (let i = 0; i < n; i++) {
      const sx = rng() * W;
      const sy = rng() * (maxY || H * 0.55);
      const sz = 1 + rng() * 2.4;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.7 + rng() * 1.8) + i * 2.4));
      ctx.fillStyle = rgba("#ffffff", tw * (0.25 + rng() * 0.5));
      ctx.fillRect(sx + Math.sin(t * 0.05 + i) * 3, sy, sz, sz);
    }
  };

  /** Flock of distant birds (flap cycles). */
  E.objBirds = function (ctx, x, y, t, n, s) {
    for (let i = 0; i < (n || 5); i++) {
      const ph = i * 1.7;
      const bx = x + i * s * 0.9 + Math.sin(t * 0.5 + ph) * s * 0.4;
      const by = y + Math.sin(t * 0.8 + ph * 1.3) * s * 0.28 - i * s * 0.14;
      const flap = Math.sin(t * 6.5 + ph);
      ctx.strokeStyle = "rgba(20,24,34,0.8)";
      ctx.lineWidth = Math.max(2, s * 0.06);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.22, by - flap * s * 0.12);
      ctx.quadraticCurveTo(bx, by + s * 0.08, bx + s * 0.22, by - flap * s * 0.12);
      ctx.stroke();
    }
  };

  /** Lightning bolt + branch. o.flash 0..1 brightness. */
  E.objLightning = function (ctx, x0, y0, x1, y1, t, pal, o = {}) {
    const flash = o.flash ?? 1;
    const rng = mulberry((hash("bolt") ^ Math.floor(t * 9)) >>> 0);
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const len = Math.hypot(x1 - x0, y1 - y0);
    // 1) soft electric halo
    ctx.strokeStyle = rgba(pal.accent, 0.35 * flash);
    ctx.lineWidth = Math.max(8, len * 0.02);
    strokeBolt(ctx, x0, y0, x1, y1, rng);
    // 2) hot core — sharp white zigzag
    ctx.strokeStyle = rgba("#ffffff", 0.98 * flash);
    ctx.lineWidth = Math.max(5, len * 0.011);
    strokeBolt(ctx, x0, y0, x1, y1, rng, true);
    ctx.restore();
  };
  function strokeBolt(ctx, x0, y0, x1, y1, rng, branch) {
    let px = x0, py = y0;
    ctx.beginPath(); ctx.moveTo(px, py);
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      px = lerp(x0, x1, f) + (rng() - 0.5) * 170 * (1 - Math.abs(f - 0.5) * 1.3);
      py = lerp(y0, y1, f) + (rng() - 0.5) * 40;
      ctx.lineTo(px, py);
      if (branch && i === 5) { // one side branch
        const dir = rng() > 0.5 ? 1 : -1;
        const bx = px + dir * (90 + rng() * 110), by = py + 140 * (0.4 + rng() * 0.5);
        ctx.moveTo(px, py);
        ctx.lineTo(lerp(px, bx, 0.45) + dir * 30, lerp(py, by, 0.45));
        ctx.lineTo(bx, by);
        ctx.moveTo(px, py);
      }
    }
    ctx.stroke();
  }

  /** Rain streaks (wind-angled), density & wind params. */
  E.objRain = function (ctx, W, H, t, pal, o = {}) {
    const density = o.density ?? 1;
    const wind = o.wind ?? 0.25;
    const rng = mulberry((hash("rain") ^ (o.seed || 1)) >>> 0);
    const n = Math.floor(120 * density);
    ctx.strokeStyle = rgba(pal.text, 0.32);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const sp = (0.9 + rng() * 1.6);
      const x = ((rng() + t * 0.32 * sp * wind) % 1) * (W + 300) - 150;
      const y = ((rng() + t * 0.55 * sp) % 1) * (H + 200) - 100;
      const len = 26 + rng() * 34;
      const ang = Math.PI / 2 + wind * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
  };

  /** Drifting fog bank (soft blobs). */
  E.objFog = function (ctx, W, H, y, t, seed, alpha, pal) {
    const noise = E.makeNoise((hash("fog") ^ (seed || 1)) >>> 0);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const cx = ((i / n) + Math.sin(t * 0.05 + i * 3.1) * 0.08 + t * 0.008 * (0.4 + (i % 3) * 0.3)) % 1 * (W * 1.3) - W * 0.15;
      const cy = y + Math.sin(t * 0.3 + i * 1.9) * H * 0.02;
      const r = W * (0.22 + 0.12 * noise(i * 5.1, t * 0.1));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(pal ? pal.text : "#c8d2e0", alpha * (0.5 + 0.3 * Math.sin(t * 0.6 + i))));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r * 0.5, r * 2, r);
    }
  };

  // ————————————————————————————————— journey props ——————————————————————

  /** Summit flag on a pole, cloth waving with wind — planted in a rock cairn. */
  E.objFlag = function (ctx, x, y, s, t, pal, o = {}) {
    const wind = o.wind ?? 0.4;
    ctx.save();
    ctx.translate(x, y);
    const lw = Math.max(3, s * 0.045);
    // rock cairn base (grounding)
    ctx.fillStyle = "#2c3242";
    ctx.strokeStyle = "rgba(10,12,18,0.9)";
    ctx.lineWidth = lw * 0.5;
    for (const [rx, rw] of [[-lw * 3.4, lw * 6.8], [-lw * 2.1, lw * 4.2], [-lw * 1.2, lw * 2.4]]) {
      ctx.beginPath();
      ctx.ellipse(rx + lw * 2, 0, rw, lw * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s); ctx.stroke();
    // cloth
    const waves = 4;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    const flen = s * 0.62, fdrop = s * 0.3;
    for (let i = 0; i <= waves; i++) {
      const f = i / waves;
      const wx = flen * f;
      const wy = -s + Math.sin(t * 6 * (0.6 + wind) + f * 5) * s * 0.07 * (0.3 + wind);
      ctx.lineTo(wx, wy + f * fdrop * 0.1);
    }
    for (let i = waves; i >= 0; i--) {
      const f = i / waves;
      const wx = flen * f;
      const wy = -s + fdrop + Math.sin(t * 6 * (0.6 + wind) + f * 5 + 1.4) * s * 0.07 * (0.3 + wind);
      ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    ctx.fillStyle = pal.accent; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = lw * 0.55; ctx.stroke();
    // pole knob
    ctx.beginPath(); ctx.arc(0, -s, lw * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = pal.accent; ctx.fill();
    ctx.restore();
  };

  /** Glowing "starting line" on the ground — the call to begin. */
  E.objStartLine = function (ctx, x, y, w, t, pal, o = {}) {
    const glow = o.glow ?? 1;
    ctx.save();
    const h = Math.max(8, w * 0.02);
    // ground glow pool under the line
    const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.6);
    g.addColorStop(0, rgba(pal.accent, 0.3 * glow));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.22); // squashed to the ground plane
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // the line itself: chalk-dash with breathing glow edge
    ctx.strokeStyle = rgba(pal.text, 0.9 * glow);
    ctx.lineWidth = h * 0.55;
    ctx.setLineDash([w * 0.055, w * 0.028]);
    ctx.lineDashOffset = -((t * 30) % 1e4);
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
    ctx.setLineDash([]);
    // energy shimmer travelling along the line
    const shim = (t * 0.5) % 1;
    const sx = x - w / 2 + shim * w;
    const sg = ctx.createRadialGradient(sx, y, 0, sx, y, w * 0.12);
    sg.addColorStop(0, rgba("#ffffff", 0.7 * glow));
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(sx - w * 0.12, y - h * 2, w * 0.24, h * 4);
    ctx.restore();
  };

  /** Mountain peak spark — the goal glinting far away: a small soft beacon,
   *  subtle enough to read as distant light, not a foreground scribble. */
  E.objPeakGlint = function (ctx, x, y, s, t) {
    const a = 0.3 + 0.5 * Math.abs(Math.sin(t * 1.4));
    // soft beacon glow
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.8);
    g.addColorStop(0, rgba("#ffe9b0", 0.5 * a));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - s, y - s, s * 2, s * 2);
    // tiny 4-point sparkle
    glint(ctx, x, y, s * 0.3, a * 0.6);
  };

  /** Dust motes / fireflies — floating particles that make air visible. */
  E.objMotes = function (ctx, W, H, t, seed, pal, o = {}) {
    const n = o.count || 36;
    const rng = mulberry((hash("motes") ^ (seed || 2)) >>> 0);
    for (let i = 0; i < n; i++) {
      const bx = rng(), by = rng(), spd = 0.02 + rng() * 0.05;
      const x = ((bx + Math.sin(t * spd * 4 + i) * 0.03 + t * spd * 0.5) % 1) * W;
      const y = ((by - t * spd * 0.8 + 1) % 1) * (o.maxY || H);
      const r = 1.5 + rng() * 3;
      const a = 0.25 + 0.55 * Math.abs(Math.sin(t * 1.2 + i * 2.1));
      ctx.fillStyle = rgba(pal.accent, a * (o.alpha ?? 1));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  };
})();
