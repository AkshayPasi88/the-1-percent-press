// Scene camera: keyed arrays [t, x, y, zoom, rot], interpolated with an easing.
// Same grammar the lemo-opuscar films use — a camera is data, not code.
import type { CameraKey } from "../theme";
import { EASINGS } from "./easing";
import { lerp } from "./rand";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rot: number;
}

const EASE_DEFAULT = "inOutCubic";

export function cameraAt(keys: CameraKey[], t: number): CameraState {
  if (keys.length === 0) return { x: 0, y: 0, zoom: 1, rot: 0 };
  if (keys.length === 1) {
    const k = keys[0];
    return { x: k.x, y: k.y, zoom: k.zoom, rot: k.rot };
  }
  if (t <= keys[0].t) {
    const k = keys[0];
    return { x: k.x, y: k.y, zoom: k.zoom, rot: k.rot };
  }
  const last = keys[keys.length - 1];
  if (t >= last.t) {
    return { x: last.x, y: last.y, zoom: last.zoom, rot: last.rot };
  }
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = Math.max(1e-4, b.t - a.t);
  const raw = (t - a.t) / span;
  // smooth over the whole scene with the segment easing
  const e = (EASINGS[EASE_DEFAULT] ?? EASINGS.linear)(raw);
  return {
    x: lerp(a.x, b.x, e),
    y: lerp(a.y, b.y, e),
    zoom: lerp(a.zoom, b.zoom, e),
    rot: lerp(a.rot, b.rot, e),
  };
}

export function cameraTransform(s: CameraState): string {
  return `translate(${-s.x}px, ${-s.y}px) scale(${s.zoom}) rotate(${s.rot}deg)`;
}
