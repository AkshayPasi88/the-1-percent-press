// Closed-form easings & springs — pure functions of time (deterministic,
// seek(t)-safe, no CSS transitions — v6 determinism contract).

export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic: Easing = (t) => t * t * t;
export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutQuint: Easing = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutQuint: Easing = (t) =>
  t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
export const easeOutExpo: Easing = (t) =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
export const easeOutBack: Easing = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Critically-damped spring, closed form: 1 - (1 + w t) e^{-w t}
export const springCritical =
  (w = 9): Easing =>
  (t) => {
    const x = Math.max(0, t) * w;
    return 1 - (1 + x) * Math.exp(-x);
  };

// Under-damped punch: settles to 1 with a single overshoot.
export const springPunch =
  (w = 12, z = 0.55): Easing =>
  (t) => {
    if (t <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    const A = Math.exp(-z * w * t);
    return 1 - A * (Math.cos(wd * t) + (z * w) / wd * Math.sin(wd * t));
  };

// Small breathing oscillation, never settles — for living worlds.
export const breathe = (t: number, freq = 0.7, amp = 1) =>
  Math.sin(t * freq * Math.PI * 2) * amp;

export const EASINGS: Record<string, Easing> = {
  linear,
  outCubic: easeOutCubic,
  inCubic: easeInCubic,
  inOutCubic: easeInOutCubic,
  outQuint: easeOutQuint,
  inOutQuint: easeInOutQuint,
  outExpo: easeOutExpo,
  outBack: easeOutBack,
  spring: springCritical(9),
  punch: springPunch(12, 0.55),
};
