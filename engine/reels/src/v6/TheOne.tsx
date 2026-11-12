// TheOne — the protagonist. ONE identity across every reel and every scene:
// charcoal hoodie, gold trim, cap, faceless (stylized shadow), gold soles.
// Parametric rig, pure function of time — walk / run / climb / lift /
// meditate / levitate / victory / point. Rim-light takes the reel accent so
// the character always sits inside the film's palette without losing identity.
import React from "react";
import { clamp01 } from "./rand";

export type Action =
  | "idle"
  | "walk"
  | "run"
  | "climb"
  | "lift"
  | "meditate"
  | "levitate"
  | "victory"
  | "point";

const PAL = {
  hoodie: "#262731",
  hoodieDark: "#17181F",
  pants: "#1B1C26",
  trim: "#E8B84B",
  shoe: "#202128",
  outline: "#0D0E13",
};

const TAU = Math.PI * 2;

function swing(t: number, freq: number): number {
  return Math.sin(t * freq * TAU);
}

export const TheOne: React.FC<{
  action: Action;
  t: number; // scene-local seconds
  facing?: number; // 1 right, -1 left
  accent: string;
  pulse?: number; // audio envelope 0..1 — micro squash
  opacity?: number;
}> = ({ action, t, facing = 1, accent, pulse = 0, opacity = 1 }) => {
  const squash = 1 + 0.035 * pulse;

  // ---------- pose defaults ----------
  let legL = 0;
  let legR = 0;
  let armL = 6;
  let armR = -6;
  let armLbend = 0;
  let armRbend = 0;
  let bodyY = 0;
  let bodyRot = 0;
  let bodyScaleY = 1;
  let seated = false;
  let headRot = 0;
  let breath = Math.sin(t * 0.9 * TAU) * 1.5; // slow living breath
  let barbell = false;

  switch (action) {
    case "idle":
      armL = 5 + Math.sin(t * 0.9 * TAU) * 3;
      armR = -5 - Math.sin(t * 0.9 * TAU) * 3;
      bodyY = Math.sin(t * 0.9 * TAU) * 1.2;
      break;
    case "walk": {
      const s = swing(t, 1.5);
      legL = s * 24;
      legR = -s * 24;
      armL = -s * 16;
      armR = s * 16;
      bodyY = Math.abs(Math.sin(t * 1.5 * TAU * 2)) * -4;
      bodyRot = s * 2;
      break;
    }
    case "run": {
      const s = swing(t, 2.6);
      legL = s * 40;
      legR = -s * 40;
      armL = -s * 34;
      armR = s * 34;
      armLbend = 34;
      armRbend = 34;
      bodyRot = -9;
      bodyY = Math.abs(Math.sin(t * 2.6 * TAU * 2)) * -7;
      headRot = -3;
      break;
    }
    case "climb": {
      const s = swing(t, 0.9);
      armL = 150 + s * 26;
      armR = 150 - s * 26;
      armLbend = 10;
      armRbend = 10;
      legL = 28 + s * 16;
      legR = 28 - s * 16;
      bodyRot = 44;
      bodyY = s * 3;
      break;
    }
    case "lift": {
      const c = (1 + Math.sin(t * 0.55 * TAU - Math.PI / 2)) / 2; // press cycle
      const press = 0.25 + c * 0.55;
      armL = 168 - press * 120;
      armR = -(168 - press * 120);
      armLbend = 8;
      armRbend = 8;
      bodyY = (1 - c) * 5;
      bodyScaleY = 1 - (1 - c) * 0.02;
      barbell = true;
      break;
    }
    case "meditate":
      seated = true;
      armL = 38;
      armR = -38;
      armLbend = 30;
      armRbend = -30;
      bodyY = Math.sin(t * 0.5 * TAU) * 1.4;
      bodyScaleY = 1 + Math.sin(t * 0.5 * TAU) * 0.008;
      break;
    case "levitate":
      seated = true;
      bodyY = -14 + Math.sin(t * 0.45 * TAU) * 9;
      armL = 62;
      armR = -62;
      armLbend = 12;
      armRbend = -12;
      break;
    case "victory": {
      armL = 158 + Math.sin(t * 1.1 * TAU) * 4;
      armR = -158 - Math.sin(t * 1.1 * TAU) * 4;
      const hop = Math.max(0, Math.sin(t * 1.4 * TAU));
      bodyY = -hop * 12;
      break;
    }
    case "point":
      armL = -46;
      armR = -46;
      armLbend = 0;
      armRbend = 0;
      headRot = 4;
      break;
  }

  // ---------- rig geometry (local units; feet at y=0, up is -y) ----------
  const HIP = -96;
  const SHOULDER = -158;
  const f = facing;

  const leg = (rot: number) => (
    <g transform={`rotate(${rot * f})`}>
      <rect x={-11} y={-90} width={22} height={90} rx={10} fill={PAL.pants} stroke={PAL.outline} strokeWidth={3} />
      {/* gold side stripe */}
      <rect x={f > 0 ? 5 : -11} y={-88} width={4} height={40} rx={2} fill={PAL.trim} opacity={0.85} />
      {/* shoe with gold sole */}
      <g transform={`translate(${5 * f}, -6)`}>
        <rect x={-17} y={-13} width={40} height={15} rx={7} fill={PAL.shoe} stroke={PAL.outline} strokeWidth={3} />
        <rect x={-17} y={-2} width={40} height={4} rx={2} fill={PAL.trim} />
      </g>
    </g>
  );

  const arm = (side: number, rot: number, bend: number) => (
    <g transform={`rotate(${rot * f})`}>
      <rect
        x={-10}
        y={-70}
        width={20}
        height={70}
        rx={9}
        fill={PAL.hoodie}
        stroke={PAL.outline}
        strokeWidth={3}
      />
      <rect x={-10} y={-70} width={20} height={7} rx={3.5} fill={PAL.trim} opacity={0.9} />
      <g transform={`rotate(${bend})`}>
        <rect x={-8} y={-15} width={16} height={18} rx={8} fill={PAL.hoodieDark} stroke={PAL.outline} strokeWidth={3} />
      </g>
    </g>
  );

  return (
    <g opacity={opacity}>
      {/* separation halo — accent glow so the figure never sinks into dark worlds */}
      <ellipse cx={0} cy={-110} rx={130} ry={190} fill={accent} opacity={0.07 + 0.07 * pulse} />
      {/* ground shadow */}
      <ellipse
        cx={0}
        cy={4}
        rx={62}
        ry={12}
        fill="#000"
        opacity={0.4}
        transform={seated ? `translate(0 ${-bodyY})` : ""}
      />
      <g
        transform={`translate(0 ${bodyY}) scale(${f} 1) scale(1 ${clamp01(squash) === squash ? squash : 1})`}
      >
        <g transform={`rotate(${bodyRot}) scale(1 ${bodyScaleY})`}>
          {/* legs / seated legs */}
          {seated ? (
            <>
              {/* crossed legs */}
              <path
                d={`M ${-HIP * 0} ${HIP} q -34 -20 -52 6 q 26 16 52 10 z`}
                fill={PAL.pants}
              />
              <path
                d={`M 0 ${HIP} q 34 -20 52 6 q -26 16 -52 10 z`}
                fill={PAL.hoodieDark}
              />
              {/* shoe fronts */}
              <ellipse cx={-44} cy={HIP + 10} rx={12} ry={7} fill={PAL.shoe} />
              <ellipse cx={44} cy={HIP + 10} rx={12} ry={7} fill={PAL.shoe} />
              <ellipse cx={-44} cy={HIP + 14} rx={12} ry={3} fill={PAL.trim} opacity={0.85} />
              <ellipse cx={44} cy={HIP + 14} rx={12} ry={3} fill={PAL.trim} opacity={0.85} />
            </>
          ) : (
            <>
              <g transform={`translate(-16 ${HIP})`}>{leg(legL)}</g>
              <g transform={`translate(16 ${HIP})`}>{leg(legR)}</g>
            </>
          )}

          {/* torso: hoodie */}
          <g transform={`translate(0 ${SHOULDER})`}>
            <path
              d={`M -38 62 q -6 -60 6 -62 l 64 0 q 12 2 6 62 q -38 10 -76 0 z`}
              fill={PAL.hoodie}
              stroke={PAL.outline}
              strokeWidth={3.5}
            />
            {/* pocket */}
            <path d={`M -24 40 q 24 8 48 0`} stroke={PAL.hoodieDark} strokeWidth={3} fill="none" />
            {/* drawstrings */}
            <path d={`M -8 -58 q -2 14 -4 18`} stroke={PAL.trim} strokeWidth={3} fill="none" />
            <path d={`M 8 -58 q 2 14 4 18`} stroke={PAL.trim} strokeWidth={3} fill="none" />
            {/* chest badge */}
            <circle cx={0} cy={16} r={7} fill={PAL.trim} opacity={0.95} />
            <circle cx={0} cy={16} r={7} fill="none" stroke={PAL.hoodieDark} strokeWidth={2} />
          </g>

          {/* arms */}
          <g transform={`translate(-34 ${SHOULDER + 4})`}>{arm(-1, armL, armLbend)}</g>
          <g transform={`translate(34 ${SHOULDER + 4})`}>{arm(1, armR, armRbend)}</g>

          {/* barbell (lift action) */}
          {barbell && (
            <g transform={`translate(0 ${SHOULDER + 8})`}>
              <rect x={-120} y={-6} width={240} height={9} rx={4} fill="#3A3D47" />
              <circle cx={-112} cy={0} r={26} fill="#14151C" stroke={accent} strokeWidth={4} />
              <circle cx={112} cy={0} r={26} fill="#14151C" stroke={accent} strokeWidth={4} />
              <circle cx={-112} cy={0} r={10} fill="#0B0C10" />
              <circle cx={112} cy={0} r={10} fill="#0B0C10" />
            </g>
          )}

          {/* head + cap */}
          <g transform={`translate(0 ${SHOULDER - 4}) rotate(${headRot})`}>
            <ellipse cx={0} cy={-32} rx={33} ry={33} fill={PAL.hoodieDark} stroke={PAL.outline} strokeWidth={3.5} />
            {/* face shadow */}
            <ellipse cx={8} cy={-27} rx={21} ry={18} fill="#0B0C10" opacity={0.9} />
            {/* cap */}
            <path d={`M -33 -36 q 33 -38 66 0 z`} fill={PAL.hoodie} stroke={PAL.outline} strokeWidth={3} />
            <rect x={5} y={-38} width={42} height={10} rx={5} fill={PAL.hoodieDark} stroke={PAL.outline} strokeWidth={3} />
            <path d={`M -33 -36 q 33 -38 66 0`} fill="none" stroke={PAL.trim} strokeWidth={3} />
            {/* cap badge */}
            <circle cx={-2} cy={-46} r={5.5} fill={PAL.trim} />
          </g>

          {/* rim light — takes the reel accent, consistent identity stays */}
          <path
            d={`M -38 ${SHOULDER + 62} q -6 -60 6 -62 l 64 0 q 12 2 6 62`}
            fill="none"
            stroke={accent}
            strokeWidth={4}
            opacity={0.55 + 0.3 * pulse}
          />
          <line x1={-30} y1={HIP - 10} x2={-30} y2={HIP - 70} stroke={accent} strokeWidth={3} opacity={0.5 + 0.3 * pulse} />
        </g>
      </g>
      {/* living breath note (unused var guard) */}
      <g opacity={0}>{`breath:${breath.toFixed(2)}`}</g>
    </g>
  );
};
