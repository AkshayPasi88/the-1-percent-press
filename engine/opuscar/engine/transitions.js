// transitions.js — scene-entry effects: flash, bars, wipe, streak, glitch.
// Overlay drawn AFTER the new scene appears, for ~0.12–0.4 s.
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, rgba, mulberry, hash } = E;

  /**
   * tt = t - scene.t0 (seconds since the new scene began).
   * type: flash | bars | wipe | streak | cut (none)
   */
  E.drawTransition = function (ctx, W, H, tt, type, pal, scene) {
    if (type === "cut" || tt < 0) return;
    switch (type) {
      case "flash": {
        const a = clamp(1 - tt / 0.12, 0, 1);
        if (a <= 0) return;
        ctx.fillStyle = rgba(pal.accent, a * 0.9);
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = rgba("#ffffff", a * 0.35);
        ctx.fillRect(0, 0, W, H);
        break;
      }
      case "bars": {
        const p = clamp(tt / 0.34, 0, 1);
        if (p >= 1) return;
        const K = 6;
        for (let i = 0; i < K; i++) {
          const dir = i % 2 ? 1 : -1;
          const bw = W / K;
          const slide = (1 - p) * bw * dir;
          ctx.fillStyle = rgba(i % 3 === 0 ? pal.accent : pal.colors[i % pal.colors.length], 0.9);
          if (dir === 1) ctx.fillRect(slide, (i / K) * H, bw, H / K + 2);
          else ctx.fillRect(slide, (i / K) * H, bw, H / K + 2);
        }
        break;
      }
      case "wipe": {
        const p = clamp(tt / 0.3, 0, 1);
        if (p >= 1) return;
        // diagonal wedge shrinking away
        const span = W * 1.5 * (1 - p);
        ctx.beginPath();
        ctx.moveTo(-span, 0);
        ctx.lineTo(W + span * 0.2, 0);
        ctx.lineTo(W + span * 0.2 - span, H);
        ctx.lineTo(-span * 2 + span, H);
        ctx.closePath();
        ctx.fillStyle = rgba(pal.colors[0], 0.85);
        ctx.fill();
        ctx.strokeStyle = rgba(pal.accent, 0.9);
        ctx.lineWidth = 8;
        ctx.stroke();
        break;
      }
      case "streak": {
        const p = clamp(tt / 0.28, 0, 1);
        if (p >= 1) return;
        const r = mulberry((hash("streak" + scene.id)) >>> 0);
        ctx.lineCap = "round";
        for (let i = 0; i < 26; i++) {
          const a0 = r() * Math.PI * 2;
          const len = (0.25 + r() * 0.75) * W * (1 - p);
          const rr = W * (0.1 + p * 0.9);
          const x0 = W / 2 + Math.cos(a0) * rr;
          const y0 = H / 2 + Math.sin(a0) * rr * 1.4;
          const x1 = W / 2 + Math.cos(a0) * (rr + len);
          const y1 = H / 2 + Math.sin(a0) * (rr + len) * 1.4;
          ctx.strokeStyle = rgba(i % 5 === 0 ? pal.accent : pal.colors[i % pal.colors.length], 0.55 * (1 - p));
          ctx.lineWidth = 4 + r() * 8;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        break;
      }
      case "glitchBurst": {
        if (tt > 0.2) return;
        const r = mulberry((hash("gb" + scene.id) ^ Math.floor(tt * 30)) >>> 0);
        const K = 4 + Math.floor(r() * 6);
        for (let k = 0; k < K; k++) {
          const y = r() * H, h = 6 + r() * 70;
          const dx = (r() - 0.5) * 120;
          ctx.fillStyle = rgba(pal.accent, 0.2 * (1 - tt / 0.2));
          ctx.fillRect(dx, y, W, h * 0.5);
          ctx.fillStyle = rgba(pal.colors[k % pal.colors.length], 0.22 * (1 - tt / 0.2));
          ctx.fillRect(-dx, y + h * 0.5, W, h * 0.5);
        }
        break;
      }
      case "ink": {
        // medium-native ink bleed: a dark wedge sweeping off with a glowing
        // ragged edge — story scenes wipe like ink pulled across the page
        const p = clamp(tt / 0.42, 0, 1);
        if (p >= 1) return;
        const r = mulberry((hash("ink" + scene.id)) >>> 0);
        const ease = 1 - Math.pow(1 - p, 2.6);
        const edge = W * (1.35) * (1 - ease) + W * 0.1;
        ctx.beginPath();
        ctx.moveTo(-40, -40);
        ctx.lineTo(edge, -40);
        // ragged leading edge down the screen
        let ex = edge;
        for (let y = 0; y <= H + 40; y += H / 14) {
          ex = edge + (r() - 0.5) * W * 0.16 * (1 - ease);
          ctx.lineTo(ex, y);
        }
        ctx.lineTo(-40, H + 40);
        ctx.closePath();
        ctx.fillStyle = "rgba(6,7,12,0.96)";
        ctx.fill();
        // glowing ink lip
        ctx.strokeStyle = rgba(pal.accent, 0.85 * (1 - ease));
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(edge + W * 0.02, -40);
        ctx.quadraticCurveTo(ex + W * 0.05, H / 2, edge + W * 0.02, H + 40);
        ctx.stroke();
        break;
      }
    }
  };
})();
