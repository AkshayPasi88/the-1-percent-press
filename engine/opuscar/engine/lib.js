// lib.js — deterministic helpers for the opuscar reel engine
// Seeded RNG + easing + value noise. Pure functions of (t, seed): any frame
// renders alone, in any order. No Date.now, no Math.random anywhere.
(function () {
  const ENGINE = (window.ENGINE = window.ENGINE || {});

  /** String → 32-bit hash (for seeds). */
  ENGINE.hash = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  /** mulberry32 seeded RNG. Returns () => float in [0,1). */
  ENGINE.mulberry = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /** RNG stream for a labeled thing (stable across frames). */
  ENGINE.rngFor = function (label, seed) {
    return ENGINE.mulberry((ENGINE.hash(label) ^ seed) >>> 0);
  };

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  /** 0→1 between t=a and t=b, clamped. */
  const seg = (t, a, b) => clamp((t - a) / (b - a || 1e-6), 0, 1);
  ENGINE.clamp = clamp;
  ENGINE.lerp = lerp;
  ENGINE.seg = seg;

  // easings on 0..1
  const ss = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  const eio = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const ei = (t) => (t = clamp(t, 0, 1), t * t);
  const eo = (t) => (t = clamp(t, 0, 1), 1 - (1 - t) * (1 - t));
  const back = (t, s = 1.9) => {
    t = clamp(t, 0, 1);
    const c = s + 1;
    return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  };
  const spring = (t, k = 170, z = 12) => {
    // damped spring toward 1; t in seconds since release
    if (t <= 0) return 0;
    const w = Math.sqrt(k), e = Math.exp(-z * t / 2);
    return 1 - e * Math.cos(w * t);
  };
  ENGINE.ss = ss; ENGINE.eio = eio; ENGINE.eo = eo;
  ENGINE.back = back; ENGINE.spring = spring;

  /** Seeded pick from array. */
  ENGINE.pick = function (rng, arr) {
    return arr[Math.floor(rng() * arr.length) % arr.length];
  };

  /** 2D value noise on a seeded lattice — smooth, deterministic. */
  function makeNoise(seed) {
    const r = ENGINE.mulberry(seed >>> 0);
    const N = 256;
    const perm = new Float32Array(N * N);
    for (let i = 0; i < perm.length; i++) perm[i] = r();
    const at = (x, y) => perm[((y & 255) * N + (x & 255)) >>> 0];
    const sm = (t) => t * t * (3 - 2 * t);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = sm(x - xi), yf = sm(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
    };
  }
  ENGINE.makeNoise = makeNoise;

  /** hex "#rrggbb" → [r,g,b] 0..255 */
  ENGINE.hex2rgb = function (hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  /** rgba string from hex + alpha */
  ENGINE.rgba = function (hex, a) {
    const [r, g, b] = ENGINE.hex2rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  /** Uppercase display word: keep apostrophes, strip punctuation edges. */
  ENGINE.word = function (w) {
    return String(w || "").toUpperCase().replace(/^[^A-Z0-9']+|[^A-Z0-9']+$/g, "");
  };

  /** Fit text to a max width; returns font size. ctx must have font family set. */
  ENGINE.fitSize = function (ctx, text, family, weight, maxW, start, min) {
    let size = start;
    while (size > min) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (ctx.measureText(text).width <= maxW) break;
      size -= 4;
    }
    return size;
  };
})();
