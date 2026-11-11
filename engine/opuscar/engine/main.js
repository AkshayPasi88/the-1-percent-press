// main.js — film composition: consumes plan.json, exposes the opuscar page
// contract (DUR, render(t), EV, TEXTS, READY). Deterministic: same plan +
// same t → same pixels.
(function () {
  const E = window.ENGINE;

  const W = 1080, H = 1920;
  let plan = null;
  let ctx = null;

  // scene runtime decor: attach noise fn + phase + palette at load (kept off the wire)
  function decorate(scenes) {
    for (const s of scenes) {
      s.noise = E.makeNoise((s.seed ^ E.hash(s.type)) >>> 0);
      s.phase = (E.hash(s.id) % 628) / 100;
      s.palette = plan.palette;
    }
  }

  /** Find the scene live at t. */
  function sceneAt(t) {
    const list = plan.scenes;
    let lo = 0, hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (t < list[mid].t1) hi = mid; else lo = mid + 1;
    }
    return list[lo];
  }

  // ——— audio cue events (exported via EV → events.json → mix.py) ———
  function buildEV() {
    const ev = [];
    // hook slam impacts (one per word)
    for (const w of plan.hook.words) ev.push({ t: +w.t0.toFixed(3), type: "impact", gain: 0.9 });
    ev.push({ t: +plan.hook.t0.toFixed(3), type: "subdrop", gain: 0.8 });
    // scene cuts: whoosh (and impact when the camera punches or the scene is "hard")
    for (const s of plan.scenes) {
      if (s.t0 < plan.hook.t0 + 0.05) continue; // hook slams already carry it
      ev.push({ t: +s.t0.toFixed(3), type: "whoosh", gain: 0.5 + (s.cam === "punch" || s.cam === "shake" ? 0.3 : 0) });
      if (s.cam === "punch" || s.cam === "shake") ev.push({ t: +(s.t0 + 0.02).toFixed(3), type: "impact", gain: 0.55 });
    }
    // keyword word-hits → sharp ticks (cap the density)
    for (const segm of plan.segments) {
      let ticks = 0;
      for (const w of segm.words) {
        if (!w.key || ticks >= 6) continue;
        if (w.t0 < plan.hook.t1) continue;
        ev.push({ t: +w.t0.toFixed(3), type: "tick", gain: 0.5 });
        ticks++;
      }
    }
    // CTA: riser then card impact
    ev.push({ t: +(plan.cta.t0 - 1.1).toFixed(3), type: "riser", gain: 0.65 });
    ev.push({ t: +(plan.cta.t0 + 0.02).toFixed(3), type: "impact", gain: 1.0 });
    ev.push({ t: +plan.cta.t0.toFixed(3), type: "drumsOut", gain: 1 });
    // music meta for mix.py
    ev.push({ t: 0, type: "music", bpm: plan.bpm, root: plan.root, energy: plan.energyMap });
    ev.sort((a, b) => a.t - b.t);
    return ev;
  }

  function frame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pal = plan.palette;
    const sc = sceneAt(t);
    const cam = E.camera(t, sc, W, H);

    // 1. animated background under the scene camera
    ctx.save();
    E.applyCamera(ctx, W, H, cam);
    E.drawBackground(ctx, W, H, t, sc);
    ctx.restore();

    // 2. vignette + caption shelf (keeps type readable over busy scenes)
    const vg = ctx.createRadialGradient(W / 2, H * 0.42, W * 0.3, W / 2, H * 0.5, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 3. typography (steady; slight camera echo for depth)
    if (t < plan.hook.t1 + 0.05) {
      E.drawHook(ctx, W, H, t, plan.hook, pal);
    } else if (t >= plan.cta.t0) {
      E.drawCta(ctx, W, H, t, plan.cta, pal, plan.brand);
    } else {
      for (const segm of plan.segments) {
        if (t >= segm.t0 - 0.05 && t <= segm.t1 + 0.35) E.drawWords(ctx, W, H, t, segm, pal);
      }
    }

    // 4. scene-entry transition overlay
    const tt = t - sc.t0;
    E.drawTransition(ctx, W, H, tt, sc.trans, pal, sc);

    // 5. progress line + brand handle (subtle, always alive)
    const prog = clamp(t / plan.DUR, 0, 1);
    ctx.fillStyle = E.rgba(pal.accent, 0.85);
    ctx.fillRect(0, 0, W * prog, 7);
    ctx.fillStyle = E.rgba(pal.accent, 0.25);
    ctx.fillRect(W * prog, 0, W * (1 - prog), 7);
    ctx.font = "600 30px 'Source Sans 3', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = E.rgba(pal.text, 0.55 + 0.2 * Math.sin(t * 2.2));
    ctx.fillText(plan.brand.handle, W / 2, 64);
  }

  async function boot() {
    const res = await fetch("plan.json");
    plan = await res.json();
    decorate(plan.scenes);
    ctx = document.getElementById("c").getContext("2d");
    // fonts must be real before measuring text
    await Promise.all([
      document.fonts.load("400 100px Anton"),
      document.fonts.load("400 100px 'Archivo Black'"),
      document.fonts.load("600 30px 'Source Sans 3'"),
    ]).catch(() => {});
    window.DUR = plan.DUR;
    window.EV = buildEV();
    window.render = (t) => frame(t);
    window.TEXTS = () => E.takeTexts();
    window.READY = true;
    // draw frame 0 once so even a still preview shows a real composition
    frame(0);
  }

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  boot().catch((e) => {
    console.error(e);
    // page.mjs turns console errors into exit — make the failure legible
    window.__bootError = String(e && e.message);
  });
})();
