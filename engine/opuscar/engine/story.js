// story.js — story-scene composition: world + character + props + lighting,
// reacting to the narration. This is the layer that makes a reel a film:
// the environment MEANS the sentence being spoken (PRD §3/§5/§8).
// Lighting overlays grade the mood; keyword hits pulse the world; lightning
// flashes share the same event clock as the thunder in the mix (audio/visual
// sync via plan.fxs).
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, lerp, rgba, seg, ss } = E;

  /** scene runtime decor for story scenes (called from main.js decorate). */
  function decorStory(scene, plan) {
    scene.card = E.seekerCard(plan.palette);
    // timeline of word-hits inside this scene (for pulses)
    scene.wordHits = [];
    for (const segm of plan.segments) {
      for (const w of segm.words || []) {
        if (w.key && w.t0 >= scene.t0 && w.t0 < scene.t1) scene.wordHits.push(w.t0);
      }
    }
    // lightning/fx events scheduled by the director (shared with the mix)
    scene.fxs = (plan.fxs || []).filter((f) => f.t >= scene.t0 && f.t < scene.t1);
  }

  /** progress of t through the scene, eased 0..1 */
  const prog = (t, sc) => clamp((t - sc.t0) / Math.max(0.2, sc.t1 - sc.t0), 0, 1);

  /** decay envelope around the nearest word-hit ≤ 0.5 s away (narration pulse) */
  function wordPulse(t, sc) {
    let p = 0;
    for (const wt of sc.wordHits) {
      const d = t - wt;
      if (d >= 0 && d < 0.5) p = Math.max(p, Math.exp(-d * 9));
      else if (d < 0 && d > -0.12) p = Math.max(p, 1 + d * 8); // pre-hit shimmer
    }
    return p;
  }

  /** lightning flash envelope at scene time */
  function flashEnv(t, sc) {
    let f = 0;
    for (const fx of sc.fxs) {
      if (fx.type !== "lightning") continue;
      const d = t - fx.t;
      if (d >= 0 && d < 0.4) f = Math.max(f, Math.exp(-d * 10) * (0.55 + 0.45 * Math.abs(Math.sin(d * 60))));
    }
    return f;
  }

  /**
   * Draw one story scene. Assumes the camera transform is NOT applied yet —
   * the world is drawn under the camera (parallax feel), the character rides
   * the camera (subject steady, world moves — the classic travel shot).
   */
  E.drawStory = function (ctx, W, H, t, sc, plan) {
    const pal = sc.palette;
    const p = prog(t, sc);
    const pulse = wordPulse(t, sc);
    const flash = flashEnv(t, sc);

    // ——— 1. environment under camera ———
    ctx.save();
    const cam = E.camera(t, sc, W, H);
    // cinematic creep: the world camera never sits dead still — constant slow
    // drift + the move. The actor rides the camera, so the SUBJECT stays
    // steady while the WORLD slides (classic dolly feel), and every frame
    // measurably differs from the previous one.
    cam.dx += Math.min((t - sc.t0) * W * 0.011, W * 0.022) + Math.sin(t * 0.5 + sc.phase) * W * 0.004;
    cam.dy += Math.sin(t * 0.37 + sc.phase * 2) * H * 0.0015;
    cam.scale = Math.max(cam.scale, 1.05); // keep ≥5% overscan for the creep
    E.applyCamera(ctx, W, H, cam);
    const worldFn = E.WORLDS[sc.world] || E.worldDarkMountain;
    const wspec = Object.assign({}, sc, {
      rise: sc.rise !== undefined ? lerp(sc.rise0 ?? 0, sc.rise1 ?? 1, p) : undefined,
      prog: sc.prog0 !== undefined ? lerp(sc.prog0, sc.prog1 ?? 1, p) : sc.prog,
    });
    if (wspec.rise === undefined) delete wspec.rise;
    worldFn(ctx, W, H, t, wspec);
    ctx.restore();

    // ——— 2. the Seeker (rides the camera: steady subject, moving world) ———
    if (sc.actor) {
      const a = sc.actor;
      const ax = W * lerp(a.x0 ?? a.x, a.x1 ?? a.x ?? 0.5, p);
      const ay = H * lerp(a.y0 ?? a.y, a.y1 ?? a.y ?? 0.8, p);
      const ah = W * (a.h ?? 0.34);
      const tt = t - sc.t0;
      // stride phase advances by distance-equivalent speed
      const phase = (t - sc.t0) * (a.stride ?? 2.4) * Math.PI;
      const stepFlare = a.action === "walk" || a.action === "run"
        ? Math.pow(Math.max(0, Math.cos(phase * 1.0)), 6) : 0;
      const rim = clamp((sc.light?.rim ?? 0.5) + pulse * 0.4 + flash * 0.3, 0, 1);
      E.drawSeeker(ctx, ax, ay, ah, t, {
        action: a.action, phase, tt, from: a.from,
      }, sc.card, {
        dir: a.dir ?? 1,
        wind: (sc.world === "storm" ? 0.9 : 0.12) + flash * 0.4,
        rim,
        shadow: sc.light?.shadow ?? 0.8,
        stepFlare: stepFlare * 0.9,
      });
      // narration pulse: a soft glow ring behind the character on key words
      if (pulse > 0.15) {
        ctx.beginPath();
        ctx.arc(ax, ay - ah * 0.45, ah * (0.72 + 0.55 * (1 - pulse)), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(pal.accent, 0.13 * pulse);
        ctx.lineWidth = 5 * pulse + 1.5;
        ctx.stroke();
      }
    }

    // ——— 3. props placed by the director (world-space, with the camera) ———
    if (sc.props) {
      ctx.save();
      const cam2 = E.camera(t, sc, W, H);
      cam2.dx += Math.min((t - sc.t0) * W * 0.011, W * 0.022) + Math.sin(t * 0.5 + sc.phase) * W * 0.004;
      cam2.dy += Math.sin(t * 0.37 + sc.phase * 2) * H * 0.0015;
      cam2.scale = Math.max(cam2.scale, 1.05);
      E.applyCamera(ctx, W, H, cam2);
      for (const pr of sc.props) {
        const px = W * (pr.x ?? 0.5), py = H * (pr.y ?? 0.5), ps = W * (pr.s ?? 0.2);
        const o = Object.assign({}, pr.o || {}, { pulse });
        drawProp(ctx, pr.obj, px, py, ps, t, pal, o, W, H);
      }
      ctx.restore();
    }

    // ——— 4. lightning bolts (screen-space, above everything but the grade) ———
    for (const fx of sc.fxs) {
      if (fx.type !== "lightning") continue;
      const d = t - fx.t;
      if (d >= 0 && d < 0.45) {
        E.objLightning(ctx, W * (fx.x ?? 0.3), -40, W * ((fx.x ?? 0.3) + (fx.dx ?? 0.15)), H * (fx.y ?? 0.5), t, pal, { flash: Math.exp(-d * 7) });
      }
    }

    // ——— 5. lighting grade (mood wash + vignette + flash lift) ———
    grade(ctx, W, H, sc, t, flash, pulse, pal);

    // ——— 6. breath life: the frame itself breathes (atmospheric tint) ———
    // a global slow accent pulse guarantees visible per-frame change even in
    // the calmest story beat, without breaking the mood.
    ctx.fillStyle = rgba(pal.accent, 0.018 + 0.02 * Math.sin(t * 3.1 + sc.phase));
    ctx.fillRect(0, 0, W, H);
  };

  function grade(ctx, W, H, sc, t, flash, pulse, pal) {
    const mood = sc.light?.mood || "dark";
    // top/bottom cinematic bars-feel via strong vignette (not literal bars)
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.36, W / 2, H * 0.5, H * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, mood === "gold" || mood === "dawn" ? "rgba(8,6,2,0.34)" : "rgba(0,0,0,0.44)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    if (mood === "dawn" || mood === "gold") {
      const warm = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      warm.addColorStop(0, rgba(pal.accent, 0.0));
      warm.addColorStop(1, rgba(pal.accent, 0.1 + 0.06 * Math.sin(t * 0.8)));
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, W, H * 0.6);
    }
    if (mood === "storm") {
      // cold green-blue grade
      ctx.fillStyle = "rgba(14,30,40,0.16)";
      ctx.fillRect(0, 0, W, H);
    }
    if (flash > 0.01) {
      ctx.fillStyle = rgba("#eaf2ff", Math.min(0.85, flash * 0.8));
      ctx.fillRect(0, 0, W, H);
    }
    if (pulse > 0.05) {
      ctx.fillStyle = rgba(pal.accent, 0.04 * pulse);
      ctx.fillRect(0, 0, W, H);
    }
  }

  /** dispatch one prop by name. */
  function drawProp(ctx, name, x, y, s, t, pal, o, W, H) {
    switch (name) {
      case "flag": E.objFlag(ctx, x, y, s, t, pal, { wind: o.wind ?? 0.5 }); break;
      case "startline": E.objStartLine(ctx, x, y, (o.w ?? 0.6) * W, t, pal, { glow: o.pulse ? 0.7 + 0.6 * o.pulse : 1 }); break;
      case "alarm": E.objAlarmClock(ctx, x, y, s, t, pal, { shake: o.shake ?? 1 }); break;
      case "bigclock": E.objBigClock(ctx, x, y, s, t, pal, { urgency: o.urgency ?? 0.5 }); break;
      case "hourglass": E.objHourglass(ctx, x, y, s, t, pal, { progress: o.progress ?? ((t * 0.35) % 1) }); break;
      case "coins": E.objCoins(ctx, x, y, s, t, pal, o); break;
      case "books": E.objBooks(ctx, x, y, s, t, pal); break;
      case "barbell": E.objBarbell(ctx, x, y, s, t, pal, { lift: o.lift ?? 0 }); break;
      case "birds": E.objBirds(ctx, x, y, t, o.n ?? 5, s); break;
      default: break;
    }
  }

  E.decorStory = decorStory;
  E.wordPulse = wordPulse;
})();
