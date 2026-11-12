// characters.js — "The Seeker": an original parametric toon character drawn
// entirely in code (2.5D side-view rig: pelvis → torso → hooded head → two
// arms → two legs, solved per frame). Adapted from lemo-opuscar's
// characters-drawn-in-code technique (MIT, lemomo-ai/lemo-opuscar): constant
// screen-space line weight, line boil cycling 3 drawings at 12 fps, flat
// fills with one hard-edged shadow side, squash & stretch, breathing idle.
//
// Everything is a pure function of (t, pose): deterministic, any frame alone.
(function () {
  const E = (window.ENGINE = window.ENGINE || {});
  const { clamp, lerp, rgba, mulberry, hash, makeNoise } = E;

  // ————————————————————————————————— boil helpers ——————————————————————————
  // Resample a polyline in screen space every ~7 px, displace along the normal
  // with low-frequency noise; the drawing cycles 3 boil states at 12 fps so a
  // held pose still breathes like hand-drawn animation.
  function boiledPoly(ctx, pts, closed, seed, boilAmp, lw, stroke, fill) {
    if (pts.length < 2) return;
    const rp = [];
    const n = pts.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.max(1, Math.round(d / 7));
      for (let j = 0; j < k; j++) {
        const f = j / k;
        rp.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
      }
    }
    if (!closed) rp.push(pts[n - 1].slice());
    const boil = Math.floor((E.__t || 0) * 12 + 1e-6) % 3;
    const noise = makeNoise((seed * 2654435761 ^ boil * 911) >>> 0);
    const out = rp.map((p, i) => {
      const prev = rp[Math.max(0, i - 1)], next = rp[Math.min(rp.length - 1, i + 1)];
      const dx = next[0] - prev[0], dy = next[1] - prev[1];
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      const amp = boilAmp * (noise(i * 0.13, seed % 97) - 0.5) * 2;
      return [p[0] + nx * amp, p[1] + ny * amp];
    });
    ctx.beginPath();
    ctx.moveTo(out[0][0], out[0][1]);
    for (let i = 1; i < out.length; i++) ctx.lineTo(out[i][0], out[i][1]);
    if (closed) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke && lw > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
  }

  // rounded blob from control points (vertex-midpoint quadratic smoothing)
  function blobPath(ctx, pts, closed) {
    ctx.beginPath();
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let m0 = closed ? mid(pts[n - 1], pts[0]) : pts[0];
    ctx.moveTo(m0[0], m0[1]);
    const count = closed ? n : n - 1;
    for (let i = 0; i < count; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const m = mid(p, q);
      ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
    }
    if (!closed) ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    else ctx.closePath();
  }

  // ————————————————————————————————— pose library ————————————————————————
  // Angles in radians, measured from straight-down (0) for limbs;
  // torsoLean pitches the whole upper body forward (+) or back (−).
  // phase = distance travelled / stride → feet cycle by distance (rolling
  // object turns by distance ÷ radius — same continuity principle).

  function poseStand(t, ph) {
    const br = Math.sin(t * 2.1) * 0.02; // breathing sway
    return {
      hipY: 0.50, torsoLean: 0.02 + br, headPitch: -0.04,
      armF: [0.10 + br, 0.22], armN: [-0.08 - br, 0.30],
      legF: [0.10, 0.05], legN: [-0.10, 0.03],
      squash: 1,
    };
  }
  function poseKneel(t, ph) {
    // heavy breathing + slow head hover so a held kneel never looks frozen
    const br = Math.sin(t * 1.5) * 0.045;
    const hover = Math.sin(t * 0.85 + 1.2) * 0.05;
    return {
      hipY: 0.30 + br * 0.06, torsoLean: 0.34 + br * 0.5, headPitch: 0.55 + hover,
      armF: [0.55 + br * 0.3, 0.9], armN: [0.35 - br * 0.3, 1.0],
      legF: [1.35, 1.7], legN: [-0.5, 2.0], // front knee up, rear knee down
      squash: 0.97 + br * 0.05,
    };
  }
  function poseWalk(t, ph) {
    const s = Math.sin(ph), c = Math.cos(ph);
    const bob = Math.abs(Math.cos(ph)) * 0.03;
    return {
      hipY: 0.50 - bob, torsoLean: 0.10 + s * 0.03, headPitch: -0.02,
      armF: [0.55 * -s, 0.45 + Math.abs(s) * 0.2],
      armN: [0.55 * s, 0.45 + Math.abs(c) * 0.2],
      legF: [0.62 * s, 0.55 * (1 - Math.cos(ph)) ],
      legN: [0.62 * -s, 0.55 * (1 - Math.cos(ph + Math.PI))],
      squash: 1,
    };
  }
  function poseRun(t, ph) {
    const s = Math.sin(ph);
    return {
      hipY: 0.46, torsoLean: 0.34, headPitch: -0.06,
      armF: [0.95 * -s, 1.15], armN: [0.95 * s, 1.15],
      legF: [0.95 * s, 1.15 * (1 - Math.max(0, Math.cos(ph)))],
      legN: [0.95 * -s, 1.15 * (1 - Math.max(0, Math.cos(ph + Math.PI)))],
      squash: 1.03,
    };
  }
  function poseClimb(t, ph) {
    const s = Math.sin(ph * 0.9);
    return {
      hipY: 0.44, torsoLean: 0.55, headPitch: -0.25, // facing into the slope, eyes up
      armF: [2.3 - 0.7 * s, 0.3], armN: [2.3 + 0.7 * s, 0.3], // alternating high reach
      legF: [0.9 - 0.35 * s, 1.2], legN: [0.9 + 0.35 * s, 1.2],
      squash: 1.02,
    };
  }
  function poseLean(t, ph) { // leaning into storm wind
    const w = Math.sin(t * 7.3) * 0.03 + Math.sin(t * 3.1) * 0.05;
    return {
      hipY: 0.47, torsoLean: 0.30 + w, headPitch: 0.18,
      armF: [1.85, 0.75], armN: [0.6 + w, 0.9], // near arm bracing, far arm shielding face
      legF: [0.42, 0.35], legN: [-0.38, 0.6],
      squash: 0.98,
    };
  }
  function poseTriumph(t, ph) {
    const br = Math.sin(t * 2.4) * 0.03;
    return {
      hipY: 0.52, torsoLean: -0.1 + br * 0.4, headPitch: -0.3,
      armF: [-1.95 + br * 0.2, 0.18], armN: [2.35 - br * 0.2, 0.1], // V overhead: far arm near-vertical, near arm up-forward
      legF: [0.12, 0.08], legN: [-0.14, 0.25],
      squash: 1.02 + br * 0.3,
    };
  }
  const POSES = { stand: poseStand, kneel: poseKneel, walk: poseWalk, run: poseRun, climb: poseClimb, lean: poseLean, triumph: poseTriumph };

  function blendPose(a, b, f) {
    const mix = (x, y) => lerp(x, y, f);
    return {
      hipY: mix(a.hipY, b.hipY), torsoLean: mix(a.torsoLean, b.torsoLean), headPitch: mix(a.headPitch, b.headPitch),
      armF: [mix(a.armF[0], b.armF[0]), mix(a.armF[1], b.armF[1])],
      armN: [mix(a.armN[0], b.armN[0]), mix(a.armN[1], b.armN[1])],
      legF: [mix(a.legF[0], b.legF[0]), mix(a.legF[1], b.legF[1])],
      legN: [mix(a.legN[0], b.legN[0]), mix(a.legN[1], b.legN[1])],
      squash: mix(a.squash, b.squash),
    };
  }

  // ————————————————————————————————— the rig ————————————————————————————

  /**
   * Draw the Seeker. All arguments in world/screen pixels.
   *   x, y   = feet centre
   *   h      = character height (px)
   *   act    = { action: kneel|stand|walk|run|climb|lean|triumph|rise,
   *             phase: stride phase (dist/stride), speed, from:'kneel' (for rise),
   *             tt: seconds since action start }
   *   card  = { hood, hoodShade, pants, pantsShade, boot, skin, rim, outline }
   *   opts  = { rim:0..1 rimlight strength, dir:+1|-1 facing, wind:0..1 flutter,
   *             shadow:0..1 ground shadow alpha, stepFlare:0..1 footstep flash }
   */
  E.drawSeeker = function (ctx, x, y, h, t, act, card, opts = {}) {
    E.__t = t;
    const dir = opts.dir || 1;
    const lw = Math.max(3, h * 0.022);            // constant screen-space weight
    const boilAmp = Math.min(1.6, h * 0.0045);    // boil scales with size, capped
    const rim = opts.rim || 0;
    const wind = opts.wind || 0;
    const seed = hash("seeker") & 0xffff;

    let pose;
    if (act.action === "rise" && act.from) {
      const k = E.ss(clamp((act.tt || 0) / 1.1, 0, 1));
      // anticipation: dip a touch before rising (ease-in-back)
      const anticip = k < 0.22 ? Math.sin(k / 0.22 * Math.PI) * 0.05 : 0;
      pose = blendPose(POSES[act.from](t, 0), POSES.stand(t, 0), clamp(k - 0.05, 0, 1));
      pose.hipY -= anticip;
      pose.squash *= 1 - 0.08 * (k < 0.22 ? 1 : 0); // squash on the dip
    } else {
      pose = (POSES[act.action] || poseStand)(t, act.phase || 0);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1); // everything below drawn facing +x
    ctx.scale(pose.squash * (2 - pose.squash), pose.squash); // volume-ish preserve
    const U = h / 7.4; // head-ish unit

    // —— ground shadow (drawn unsquashed-ish, at feet) ——
    if ((opts.shadow ?? 1) > 0) {
      ctx.save();
      ctx.setTransform(ctx.getTransform());
      ctx.beginPath();
      ctx.ellipse(0, 6, h * 0.21, h * 0.045, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba("#000000", 0.32 * (opts.shadow ?? 1));
      ctx.fill();
      ctx.restore();
    }

    const hip = [0, -pose.hipY * h];
    const torsoLen = h * 0.34;
    const shoulder = [
      hip[0] + Math.sin(pose.torsoLean) * torsoLen,
      hip[1] - Math.cos(pose.torsoLean) * torsoLen,
    ];
    const headR = U * 1.55;

    // two-segment limb: from root, given absolute angles from straight-down
    // (ang=0 → straight DOWN in canvas coords)
    const limb = (root, ang1, ang2, l1, l2) => {
      const dirx = Math.sin(ang1), diry = Math.cos(ang1);
      const mid = [root[0] + dirx * l1, root[1] + diry * l1];
      const a2 = ang1 + ang2;
      const dirx2 = Math.sin(a2), diry2 = Math.cos(a2);
      const end = [mid[0] + dirx2 * l2, mid[1] + diry2 * l2];
      return [mid, end];
    };

    const armLen = h * 0.30, legLen = h * 0.46;
    // separate attachment points so near/far limbs never overlap into a
    // "peg leg": two hips ±0.035h, two shoulders ±0.5U
    const hipL = [hip[0] - h * 0.035, hip[1]], hipR = [hip[0] + h * 0.035, hip[1]];
    const shoL = [shoulder[0] - U * 0.5, shoulder[1]], shoR = [shoulder[0] + U * 0.5, shoulder[1]];
    const armF = limb(shoL, pose.armF[0], pose.armF[1], armLen * 0.52, armLen * 0.48);
    const armN = limb(shoR, pose.armN[0], pose.armN[1], armLen * 0.52, armLen * 0.48);
    const legF = limb(hipL, pose.legF[0], pose.legF[1], legLen * 0.5, legLen * 0.5);
    const legN = limb(hipR, pose.legN[0], pose.legN[1], legLen * 0.5, legLen * 0.5);

    // stroke a limb as a boiled CAPSULE: thick outline pass + inset colour
    // pass — limbs read as solid cartoon limbs, not hairlines
    const limbStroke = (mid, end, root, thick, color) => {
      const pts = [root, mid, end];
      // outline capsule (dark)
      boiledPoly(ctx, pts, false, seed, boilAmp, thick, card.outline, null);
      // colour capsule inset — leaves the outline as a rim on both edges
      const inset = Math.max(1, thick - lw * 2.4);
      boiledPoly(ctx, pts, false, seed, boilAmp, inset, null, color);
    };

    // —— draw order: far limbs → torso/backpack → head → near limbs ——
    // far arm (behind)
    limbStroke(armF[0], armF[1], shoulder, h * 0.052, card.pantsShade);
    hand(ctx, armF[1], card, lw, boilAmp, seed, true);

    // far leg
    limbStroke(legF[0], legF[1], hip, h * 0.066, card.pantsShade);
    boot(ctx, legF[1], pose.legF[1], card, lw, boilAmp, seed + 7, true);

    // backpack hump (behind torso)
    ctx.save();
    const bp = [
      [shoulder[0] - U * 1.5, shoulder[1] + U * 0.1],
      [shoulder[0] - U * 1.15, hip[1] + U * 0.6],
      [shoulder[0] - U * 0.2, hip[1] + U * 0.5],
      [shoulder[0] - U * 0.35, shoulder[1] - U * 0.15],
    ];
    blobPath(ctx, bp, true);
    ctx.fillStyle = card.pants; ctx.fill();
    ctx.strokeStyle = card.outline; ctx.lineWidth = lw * 0.9; ctx.stroke();
    ctx.restore();

    // torso: hoodie wedge hip→shoulders with hem flare (wind flutter)
    const flut = wind * Math.sin(t * 9.1) * 0.5 + wind * Math.sin(t * 5.3) * 0.5;
    const hemW = U * (1.35 + flut * 0.35);
    const torsoPts = [
      [hip[0] - hemW * 0.8, hip[1] + U * 0.35],
      [shoulder[0] - U * 1.28, shoulder[1] + U * 0.42],
      [shoulder[0] - U * 1.18, shoulder[1] - U * 0.28],
      [shoulder[0] + U * 1.22, shoulder[1] - U * 0.28],
      [shoulder[0] + U * 1.34, shoulder[1] + U * 0.42],
      [hip[0] + hemW * 0.8, hip[1] + U * 0.35],
    ];
    boiledPoly(ctx, torsoPts, true, seed + 3, boilAmp, lw, card.outline, card.hood);
    // hoodie shadow side (hard edge, away from light = viewer-left)
    ctx.save();
    ctx.beginPath();
    const sh = [
      torsoPts[0], torsoPts[1], torsoPts[2],
      [shoulder[0] - U * 0.55, shoulder[1] - U * 0.2],
      [hip[0] - U * 0.55, hip[1] + U * 0.2],
    ];
    blobPath(ctx, sh, true);
    ctx.clip();
    ctx.fillStyle = card.hoodShade;
    ctx.fillRect(-h, -h, h * 2, h * 2);
    ctx.restore();
    // rim light along the front (light-facing) edge
    if (rim > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(torsoPts[4][0], torsoPts[4][1]);
      ctx.lineTo(torsoPts[5][0], torsoPts[5][1]);
      ctx.lineTo(hip[0], hip[1] + U * 0.4);
      ctx.strokeStyle = rgba(card.rim, 0.55 * rim);
      ctx.lineWidth = lw * 0.85;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
    }

    // hooded head + face shadow + eye glint
    const hx = shoulder[0] + Math.sin(pose.torsoLean) * U * 0.9;
    const hy = shoulder[1] - Math.cos(pose.torsoLean) * U * 0.55 - headR * 0.55;
    const hp = pose.headPitch;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(hp * 0.4);
    // hood: teardrop around the head, tip flicking with wind
    const tip = Math.sin(t * 6.3) * (0.05 + wind * 0.22);
    const hoodPts = [
      [-headR * 0.95, headR * 0.45],
      [-headR * 1.05, -headR * 0.25],
      [-headR * 0.45 - tip * headR, -headR * 1.25],
      [headR * 0.75 + tip * headR * 0.4, -headR * 0.95],
      [headR * 1.0, headR * 0.1],
      [headR * 0.85, headR * 0.55],
      [0, headR * 0.72],
    ];
    boiledPoly(ctx, hoodPts, true, seed + 11, boilAmp, lw, card.outline, card.hood);
    // face void
    ctx.beginPath();
    ctx.ellipse(headR * 0.22, headR * 0.08, headR * 0.62, headR * 0.66, -0.18, 0, Math.PI * 2);
    ctx.fillStyle = card.outline;
    ctx.fill();
    // eye glint(s) — resolve + rim moods
    const blink = (Math.sin(t * 1.3 + seed) > 0.97) ? 0.2 : 1;
    ctx.beginPath();
    ctx.ellipse(headR * 0.38, headR * 0.02, headR * 0.13 * blink, headR * 0.075 * blink, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(card.rim, 0.9);
    ctx.fill();
    if (rim > 0.35) { // determination: second glint (far eye)
      ctx.beginPath();
      ctx.ellipse(headR * 0.02, headR * 0.0, headR * 0.08, headR * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgba(card.rim, 0.55 * rim);
      ctx.fill();
    }
    ctx.restore();

    // near leg + boot
    limbStroke(legN[0], legN[1], hip, h * 0.07, card.pants);
    boot(ctx, legN[1], pose.legN[1], card, lw, boilAmp, seed + 17, false);

    // near arm + hand (skin visible)
    limbStroke(armN[0], armN[1], shoulder, h * 0.056, card.hood);
    hand(ctx, armN[1], card, lw, boilAmp, seed + 23, false);

    // footstep flare: tiny dust ring at the planted foot on step hits
    if ((opts.stepFlare || 0) > 0.02) {
      ctx.beginPath();
      ctx.ellipse(0, 4, h * (0.16 + 0.3 * (1 - opts.stepFlare)), h * 0.03, 0, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(card.rim, 0.5 * opts.stepFlare);
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
    }

    ctx.restore();
  };

  function hand(ctx, end, card, lw, boilAmp, seed, far) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(end[0], end[1], lw * 1.35, lw * 1.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = far ? card.hoodShade : card.skin;
    ctx.fill();
    ctx.strokeStyle = card.outline;
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
    ctx.restore();
  }
  function boot(ctx, end, kneeAng, card, lw, boilAmp, seed, far) {
    // chunky rounded boot with toe forward (+x), size matched to leg thickness
    ctx.save();
    ctx.translate(end[0], end[1]);
    const bw = lw * 4.6, bh = lw * 3.4;
    ctx.beginPath();
    ctx.roundRect(-bw * 0.55, -bh * 0.55, bw * 1.08, bh, bh * 0.42);
    ctx.fillStyle = far ? card.outline : card.boot;
    ctx.fill();
    ctx.strokeStyle = card.outline;
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
    ctx.restore();
  }

  // ————————————————————————————————— character cards ————————————————————
  // Reusable, consistent across every scene of a film (character consistency).
  E.seekerCard = function (palette) {
    return {
      hood: palette.colors[0], hoodShade: shade(palette.colors[0], 0.62),
      pants: palette.colors[1] || "#232833", pantsShade: shade(palette.colors[1] || "#232833", 0.6),
      boot: "#1b1d24",
      skin: "#e7b98c",
      rim: palette.accent,
      outline: "rgba(10,11,16,0.96)",
    };
  };

  function shade(hex, f) {
    const [r, g, b] = E.hex2rgb(hex);
    return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
  }
})();
