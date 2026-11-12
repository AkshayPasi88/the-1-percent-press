// camera.js — per-scene camera moves. 2D has a camera too: push, pull, pan,
// punch, shake, tilt + a global breath so nothing is ever perfectly still.
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, lerp, seg, ss, spring, mulberry, hash } = E;

  /**
   * Returns {scale, dx, dy, rot} for the scene at time t.
   * cam = { type, seed, phase }
   */
  E.camera = function (t, scene, W, H) {
    const cam = scene.cam;
    const tt = Math.max(0, t - scene.t0); // time since scene start
    const dur = Math.max(0.2, scene.t1 - scene.t0);
    const p = clamp(tt / dur, 0, 1);
    let scale = 1, dx = 0, dy = 0, rot = 0;

    switch (cam) {
      case "push":
        scale = lerp(1.0, 1.16, p * p);
        break;
      case "pull":
        scale = lerp(1.18, 1.0, p);
        break;
      case "panL":
        scale = 1.1;
        dx = lerp(W * 0.05, -W * 0.05, p);
        break;
      case "panR":
        scale = 1.1;
        dx = lerp(-W * 0.05, W * 0.05, p);
        break;
      case "punch":
        scale = lerp(1.14, 1.0, clamp(spring(tt, 60, 10), 0, 1));
        break;
      case "shake": {
        const amp = Math.exp(-tt * 3.2);
        const r = mulberry((hash("shake" + scene.id) ^ Math.floor(t * 47)) >>> 0);
        scale = 1.04;
        dx = (r() - 0.5) * 46 * amp;
        dy = (r() - 0.5) * 46 * amp;
        rot = (r() - 0.5) * 0.03 * amp;
        break;
      }
      case "tilt":
        scale = 1.08;
        rot = lerp(-0.035, 0.035, p);
        break;
      case "crane": // slow vertical rise, slight push — the "get up" move
        scale = lerp(1.04, 1.14, p);
        dy = lerp(H * 0.035, -H * 0.05, ss(p));
        break;
      case "follow": // steady subject: world drifts around it
        scale = 1.08;
        dx = Math.sin(tt * 0.4 + scene.phase) * W * 0.012;
        dy = Math.cos(tt * 0.33 + scene.phase) * H * 0.01;
        break;
      case "drift":
      default:
        scale = 1.05;
        dx = Math.sin(tt * 0.8 + (cam === "drift" ? scene.phase : 0)) * W * 0.03;
        dy = Math.cos(tt * 0.6 + scene.phase) * H * 0.02;
    }
    // global breath — the frame is never 100% still
    scale *= 1 + 0.012 * Math.sin(t * 0.9 + scene.phase);
    return { scale, dx, dy, rot };
  };

  /** Apply camera to a drawing context. */
  E.applyCamera = function (ctx, W, H, cam) {
    ctx.translate(W / 2 + cam.dx, H / 2 + cam.dy);
    ctx.rotate(cam.rot);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-W / 2, -H / 2);
  };
})();
