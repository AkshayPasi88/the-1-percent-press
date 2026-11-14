// v7 scene-kit — shared browser runtime inlined into every scene by build.mjs.
// Camera creep, audio-envelope proxy (--pulse CSS var), hook slam, karaoke
// captions, counters, brand tag, onset fx, flood wipe-in, grade veil.
// Everything is a pure function of the paused GSAP timeline (deterministic).
/* global v7 */
(function () {
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // ---- audio envelope proxy: one tween drives the --pulse CSS var -------
  v7.envProxy = function (tl, p, rootId, env, dur) {
    if (!env || env.length === 0 || dur <= 0.02) return;
    const root = document.getElementById(rootId);
    if (!root) return;
    const prox = { t: 0 };
    tl.to(prox, {
      t: dur,
      duration: dur,
      ease: "none",
      onUpdate: function () {
        const f = Math.min(env.length - 1, Math.max(0, Math.round(prox.t * 30)));
        root.style.setProperty("--pulse", env[f].toFixed(3));
      },
    }, 0);
  };

  // ---- camera: keyed [t,x,y,zoom,rot] -> sequential fromTo on #camera ----
  v7.camera = function (tl, p, keys, dur) {
    if (!keys || keys.length === 0) return;
    const cam = "#" + p + "camera";
    if (keys.length === 1) {
      const k = keys[0];
      tl.set(cam, { x: -k.x, y: -k.y, scale: k.zoom, rotation: k.rot }, 0.001);
      return;
    }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      const span = Math.max(0.05, b.t - a.t);
      tl.fromTo(cam,
        { x: -a.x, y: -a.y, scale: a.zoom, rotation: a.rot },
        { x: -b.x, y: -b.y, scale: b.zoom, rotation: b.rot, duration: span, ease: "power2.inOut" },
        Math.max(0, a.t));
    }
  };

  // ---- hook type: per-character spring slam --------------------------------
  v7.hook = function (tl, p, lines, th, dur) {
    const box = "#" + p + "hook";
    tl.set(box, { opacity: 0 }, 0.001);
    tl.fromTo(box, { opacity: 0 }, { opacity: 1, duration: 0.01 }, 0.05);
    let delay = 0.05;
    lines.forEach((line, li) => {
      const chars = line.split("");
      chars.forEach((ch, ci) => {
        const sel = `#${p}hk-${li}-${ci}`;
        if (ch === " ") return;
        tl.fromTo(sel,
          { opacity: 0, scale: 0.6, y: 26 },
          { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(2.2)" },
          delay + ci * 0.035);
      });
      delay += 0.14 + Math.min(0.5, chars.length * 0.035);
    });
    // hold, then shrink away just before scene end
    tl.to(box, { scale: 0.94, duration: 0.3, ease: "power2.in" }, Math.max(0.1, dur - 0.32));
  };

  // ---- karaoke captions: word-level color/scale sync -----------------------
  v7.captions = function (tl, p, words, th, sceneDur, sceneStart) {
    const box = "#" + p + "cap";
    tl.set(box, { opacity: 0 }, 0.001);
    tl.fromTo(box, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.35, ease: "back.out(1.6)" }, 0.02);
    words.forEach((w, i) => {
      const sel = `#${p}cw-${i}`;
      const ws = Math.max(0, w.start - sceneStart);
      const we = Math.min(sceneDur - 0.05, w.end - sceneStart);
      if (we <= ws) return;
      // upcoming -> active (white, pop)
      tl.fromTo(sel,
        { color: th.inkSoft, scale: 1 },
        { color: "#FFFFFF", scale: 1.1, duration: 0.09, ease: "power2.out" },
        ws);
      // active -> spoken (accent, settle)
      tl.to(sel, { color: th.accent, scale: 1, duration: 0.12, ease: "power2.out" }, we);
    });
  };

  // ---- animated counter ------------------------------------------------------
  v7.counter = function (tl, p, counter, dur) {
    const box = "#" + p + "ctr";
    const numEl = document.getElementById(p + "ctr-num");
    tl.set(box, { opacity: 0 }, 0.001);
    tl.fromTo(box, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, 0.05);
    const dec = counter.decimals || 0;
    const prox = { v: counter.from };
    tl.fromTo(prox,
      { v: counter.from },
      { v: counter.to, duration: dur * 0.7, ease: "power3.out",
        onUpdate: function () {
          numEl.textContent = (counter.prefix || "") + prox.v.toFixed(dec) + (counter.suffix || "");
        } },
      0.08);
  };

  // ---- brand tag: settle-in + tiny bob ---------------------------------------
  v7.brand = function (tl, p, dur) {
    const tag = "#" + p + "brand";
    tl.set(tag, { opacity: 0 }, 0.001);
    tl.fromTo(tag, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.1);
    tl.fromTo(tag, { y: 0 }, { y: -4, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.ceil(dur / 1.6)) - 1 }, 0.5);
  };

  // ---- onset fx ---------------------------------------------------------------
  // shockwave ring + speed lines + flash, placed at scene-local onset times
  v7.onsetFx = function (tl, p, th, onsets, fxKeys, dur) {
    const has = (k) => fxKeys && fxKeys.indexOf(k) >= 0;
    onsets.forEach((t0) => {
      if (t0 <= 0.05 || t0 >= dur - 0.05) return;
      if (has("shockwave")) {
        const ring = "#" + p + "fx-ring";
        tl.set(ring, { attr: { r: 60, opacity: 0 } }, t0 - 0.001);
        tl.fromTo(ring,
          { attr: { r: 60, opacity: 0.5 } },
          { attr: { r: 700, opacity: 0 }, duration: 0.55, ease: "power2.out" },
          t0);
      }
      if (has("speedlines")) {
        const g = "#" + p + "fx-speed";
        tl.set(g, { opacity: 0 }, t0 - 0.001);
        tl.fromTo(g,
          { opacity: 0.55, scale: 1.15 },
          { opacity: 0, scale: 1, duration: 0.4, ease: "power2.out", transformOrigin: "50% 51%" },
          t0);
      }
      if (has("flash")) {
        const f = "#" + p + "fx-flash";
        tl.set(f, { opacity: 0 }, t0 - 0.001);
        tl.fromTo(f, { opacity: 0.16 }, { opacity: 0, duration: 0.22, ease: "power2.out" }, t0);
      }
    });
  };

  // ---- flood wipe-in at scene start -------------------------------------------
  v7.wipe = function (tl, p, isFirst, dur) {
    const panel = "#" + p + "wipe";
    if (isFirst) {
      const fade = "#" + p + "fade";
      tl.set(fade, { opacity: 1 }, 0.001);
      tl.fromTo(fade, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power1.out" }, 0.02);
      tl.set(panel, { opacity: 0 }, 0.001);
      return;
    }
    tl.set(panel, { opacity: 1 }, 0.001);
    tl.fromTo(panel,
      { yPercent: 0 },
      { yPercent: 106, duration: 0.46, ease: "power3.inOut" },
      0.02);
    // trailing edge accent line
    const edge = "#" + p + "wipe-edge";
    tl.fromTo(edge,
      { yPercent: 0 },
      { yPercent: 106, duration: 0.5, ease: "power3.inOut" },
      0.02);
  };

  // ---- character: place rig wrapper (static) and run action ------------------
  v7.placeCharacter = function (p, pos, scale, facing) {
    const el = document.getElementById(p + "char");
    if (!el) return;
    el.setAttribute("transform",
      `translate(${pos[0]} ${pos[1]}) scale(${(scale * (facing || 1)).toFixed(3)} ${scale.toFixed(3)})`);
  };
})();
