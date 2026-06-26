import type { HandMotionConfig, HandId, PhysicsConfig } from "./config";
import { leftX, rightX } from "./config";
import { lenM } from "./sceneScale";
import {
  handInsideTheta,
  handOutsideTheta,
  handThetaAt,
  type HandMotionSchedule,
  type HandMotionSchedules,
} from "./handSchedule";

export type { HandMotionSchedule, HandMotionSchedules } from "./handSchedule";
export { buildHandSchedules, handInsideTheta, handOutsideTheta, handThetaAt } from "./handSchedule";

export interface HandPose {
  x: number;
  y: number;
}

export function handOmega(cfg: PhysicsConfig): number {
  return Math.PI / cfg.beatPeriodS;
}

/** Uniform fallback: full ellipse, θ increasing (right from 0, left from π). */
export function handPhaseRad(
  hand: HandId,
  tAbs: number,
  cfg: PhysicsConfig,
  schedules?: HandMotionSchedules | null,
): number {
  const sched = schedules?.[hand];
  if (sched) return handThetaAt(tAbs, sched);
  const omega = handOmega(cfg);
  return hand === "left" ? Math.PI + omega * tAbs : omega * tAbs;
}

export function handXyFromTheta(
  hand: HandId,
  theta: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  const centerX = hand === "left" ? leftX(cfg) : rightX(cfg);
  const centerY = cfg.handHeightM;
  const x =
    hand === "left"
      ? centerX + motion.rxM * Math.cos(theta)
      : centerX - motion.rxM * Math.cos(theta);
  const y = centerY + motion.ryM * Math.sin(theta);
  return [x, y];
}

export function handPosition(
  hand: HandId,
  tAbs: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
): HandPose {
  const theta = handPhaseRad(hand, tAbs, cfg, schedules);
  const [x, y] = handXyFromTheta(hand, theta, cfg, motion);
  return { x, y };
}

export function handXyInside(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  return handXyFromTheta(hand, handInsideTheta(hand), cfg, motion);
}

export function handXyOutside(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  return handXyFromTheta(hand, handOutsideTheta(hand), cfg, motion);
}

export function ballLiftM(cfg: PhysicsConfig): number {
  return cfg.ballRadiusM * 1.15;
}

export function insideBallSlot(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  const [x, y] = handXyInside(hand, cfg, motion);
  return [x, y + ballLiftM(cfg)];
}

export function outsideBallSlot(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  const [x, y] = handXyOutside(hand, cfg, motion);
  return [x, y + ballLiftM(cfg)];
}

export function throwBeatForHand(hand: HandId, beatIndex: number): boolean {
  return hand === "right" ? beatIndex % 2 === 0 : beatIndex % 2 === 1;
}

export function handNearOutside(
  hand: HandId,
  t: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
  epsM = lenM(0.35),
): boolean {
  const [ox, oy] = handXyOutside(hand, cfg, motion);
  const pose = handPosition(hand, t, cfg, motion, schedules);
  return Math.hypot(pose.x - ox, pose.y - oy) <= epsM;
}

export function ellipseLowerHalfPath(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
  n = 80,
): string {
  const centerY = cfg.handHeightM;
  const sched = schedules?.[hand];
  const period = sched?.periodS ?? 2 * cfg.beatPeriodS;
  let d = "";
  let penDown = false;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * period;
    const { x, y } = handPosition(hand, t, cfg, motion, schedules);
    if (y > centerY + 1e-6) {
      penDown = false;
      continue;
    }
    if (!penDown) {
      d += `${d ? " " : ""}M ${x} ${y}`;
      penDown = true;
    } else {
      d += ` L ${x} ${y}`;
    }
  }
  return d;
}

export function firstThrowBeat(startHand: HandId): number {
  return startHand === "right" ? 0 : 1;
}
