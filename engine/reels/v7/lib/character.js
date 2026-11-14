// TheOne character runtime — inlined into every scene by build.mjs.
// Applies GSAP tweens to the canonical rig. The rig markup is byte-identical
// in every scene (only ids get a scene prefix); these joint rotations are the
// ONLY per-scene variation, so identity and proportions cannot drift.
// Determinism: finite repeats only, absolute times, pure function of timeline.
/* global v7 */
(function () {
  // Joint oscillation around `base` between base+amp and base-amp.
  // yoyo with sine.inOut approximates sin(t) closely at joint scale.
  function swing(tl, sel, base, amp, cycleSec, dur, phase) {
    if (amp === 0 || dur <= 0.02) return;
    const half = cycleSec / 2;
    const reps = Math.max(1, Math.ceil(dur / half));
    const from = base + (phase >= 0 ? amp : -amp);
    tl.fromTo(
      sel,
      { attr: { transform: `rotate(${from.toFixed(2)})` } },
      { attr: { transform: `rotate(${(2 * base - from).toFixed(2)})` }, duration: half, ease: "sine.inOut", yoyo: true, repeat: reps - 1 },
      0,
    );
  }
  // Bounded bounce (0 -> -depth -> 0) on the bob wrapper.
  function bounce(tl, sel, depth, cycleSec, dur) {
    if (depth === 0 || dur <= 0.02) return;
    const half = cycleSec / 2;
    const reps = Math.max(1, Math.ceil(dur / half));
    tl.fromTo(
      sel,
      { attr: { transform: "translate(0 0)" } },
      { attr: { transform: `translate(0 ${(-depth).toFixed(2)})` }, duration: half, ease: "sine.inOut", yoyo: true, repeat: reps - 1 },
      0,
    );
  }

  // p = scene id prefix, e.g. "s01-" (rig ids are `${p}to-…`)
  v7.character = function (tl, p, action, dur) {
    const g = (n) => "#" + p + n;
    const seated = action === "meditate" || action === "levitate";

    tl.set(g("to-legsStand"), { attr: { opacity: seated ? 0 : 1 } }, 0.001);
    tl.set(g("to-legsSit"), { attr: { opacity: seated ? 1 : 0 } }, 0.001);

    const S = {
      idle:     { lean: 0,   head: 0,  fArmL: 0,   fArmR: 0,   barbell: 0 },
      walk:     { lean: 2,   head: 0,  fArmL: 0,   fArmR: 0,   barbell: 0 },
      run:      { lean: -9,  head: -3, fArmL: 42,  fArmR: 42,  barbell: 0 },
      climb:    { lean: 14,  head: -6, fArmL: 8,   fArmR: 8,   barbell: 0 },
      lift:     { lean: 0,   head: 0,  fArmL: 6,   fArmR: 6,   barbell: 1 },
      meditate: { lean: 0,   head: 2,  fArmL: 32,  fArmR: -32, barbell: 0 },
      levitate: { lean: 0,   head: -2, fArmL: 14,  fArmR: -14, barbell: 0 },
      victory:  { lean: 0,   head: -2, fArmL: 6,   fArmR: 6,   barbell: 0 },
      point:    { lean: 3,   head: 4,  fArmL: 0,   fArmR: 0,   barbell: 0 },
    }[action] || { lean: 0, head: 0, fArmL: 0, fArmR: 0, barbell: 0 };

    tl.set(g("to-lean"), { attr: { transform: `rotate(${S.lean})` } }, 0.001);
    tl.set(g("to-head"), { attr: { transform: `rotate(${S.head})` } }, 0.001);
    tl.set(g("to-forearmL"), { attr: { transform: `rotate(${S.fArmL})` } }, 0.001);
    tl.set(g("to-forearmR"), { attr: { transform: `rotate(${S.fArmR})` } }, 0.001);
    tl.set(g("to-barbell"), { attr: { opacity: S.barbell } }, 0.001);

    switch (action) {
      case "idle":
        swing(tl, g("to-armL"), 0, 4, 1.1, dur, 1);
        swing(tl, g("to-armR"), 0, 4, 1.1, dur, -1);
        bounce(tl, g("to-bob"), 1.6, 1.1, dur);
        break;
      case "walk":
        swing(tl, g("to-legL"), 0, 24, 0.667, dur, 1);
        swing(tl, g("to-legR"), 0, 24, 0.667, dur, -1);
        swing(tl, g("to-armL"), 0, 16, 0.667, dur, -1);
        swing(tl, g("to-armR"), 0, 16, 0.667, dur, 1);
        bounce(tl, g("to-bob"), 5, 0.333, dur);
        break;
      case "run":
        swing(tl, g("to-legL"), 0, 40, 0.385, dur, 1);
        swing(tl, g("to-legR"), 0, 40, 0.385, dur, -1);
        swing(tl, g("to-armL"), 0, 34, 0.385, dur, -1);
        swing(tl, g("to-armR"), 0, 34, 0.385, dur, 1);
        bounce(tl, g("to-bob"), 7, 0.192, dur);
        break;
      case "climb":
        // arms reach up alternately around 150°, knees step
        swing(tl, g("to-armL"), 150, 26, 1.11, dur, 1);
        swing(tl, g("to-armR"), 150, 26, 1.11, dur, -1);
        swing(tl, g("to-legL"), 28, 16, 1.11, dur, 1);
        swing(tl, g("to-legR"), 28, 16, 1.11, dur, -1);
        bounce(tl, g("to-bob"), 3, 1.11, dur);
        break;
      case "lift": {
        const cyc = 1.82;
        const reps = Math.max(1, Math.ceil(dur / cyc));
        for (let i = 0; i < reps; i++) {
          const t0 = i * cyc;
          tl.fromTo(g("to-armL"),
            { attr: { transform: "rotate(168)" } },
            { attr: { transform: "rotate(48)" }, duration: cyc * 0.55, ease: "sine.inOut" }, t0);
          tl.fromTo(g("to-armR"),
            { attr: { transform: "rotate(-168)" } },
            { attr: { transform: "rotate(-48)" }, duration: cyc * 0.55, ease: "sine.inOut" }, t0);
          tl.to(g("to-armL"), { attr: { transform: "rotate(168)" }, duration: cyc * 0.45, ease: "sine.inOut" }, t0 + cyc * 0.55);
          tl.to(g("to-armR"), { attr: { transform: "rotate(-168)" }, duration: cyc * 0.45, ease: "sine.inOut" }, t0 + cyc * 0.55);
          tl.fromTo(g("to-barbell"),
            { attr: { transform: "translate(0 -108)" } },
            { attr: { transform: "translate(0 -10)" }, duration: cyc * 0.55, ease: "sine.inOut" }, t0);
          tl.to(g("to-barbell"), { attr: { transform: "translate(0 -108)" }, duration: cyc * 0.45, ease: "sine.inOut" }, t0 + cyc * 0.55);
          tl.fromTo(g("to-bob"),
            { attr: { transform: "translate(0 0)" } },
            { attr: { transform: "translate(0 4)" }, duration: cyc * 0.55, ease: "sine.inOut" }, t0);
          tl.to(g("to-bob"), { attr: { transform: "translate(0 0)" }, duration: cyc * 0.45, ease: "sine.inOut" }, t0 + cyc * 0.55);
        }
        break;
      }
      case "meditate":
        tl.set(g("to-armL"), { attr: { transform: "rotate(38)" } }, 0.002);
        tl.set(g("to-armR"), { attr: { transform: "rotate(-38)" } }, 0.002);
        bounce(tl, g("to-bob"), 1.6, 2.0, dur);
        break;
      case "levitate":
        tl.set(g("to-armL"), { attr: { transform: "rotate(62)" } }, 0.002);
        tl.set(g("to-armR"), { attr: { transform: "rotate(-62)" } }, 0.002);
        tl.fromTo(g("to-bob"),
          { attr: { transform: "translate(0 -14)" } },
          { attr: { transform: "translate(0 -23)" }, duration: 1.11, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.ceil(dur / 1.11)) - 1 },
          0);
        break;
      case "victory":
        // arms held up (~160°) with a slight sway + one hop
        tl.fromTo(g("to-armL"),
          { attr: { transform: "rotate(158)" } },
          { attr: { transform: "rotate(163)" }, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.ceil(dur / 0.45)) - 1 },
          0);
        tl.fromTo(g("to-armR"),
          { attr: { transform: "rotate(-158)" } },
          { attr: { transform: "rotate(-163)" }, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: Math.max(1, Math.ceil(dur / 0.45)) - 1 },
          0);
        tl.fromTo(g("to-bob"),
          { attr: { transform: "translate(0 0)" } },
          { attr: { transform: "translate(0 -12)" }, duration: 0.36, ease: "sine.out" },
          0);
        tl.to(g("to-bob"), { attr: { transform: "translate(0 0)" }, duration: 0.36, ease: "bounce.in" }, 0.36);
        break;
      case "point":
        tl.set(g("to-armL"), { attr: { transform: "rotate(-46)" } }, 0.002);
        tl.set(g("to-armR"), { attr: { transform: "rotate(-46)" } }, 0.002);
        bounce(tl, g("to-bob"), 1.6, 1.4, dur);
        break;
      default:
        bounce(tl, g("to-bob"), 1.6, 1.1, dur);
    }
  };
})();
