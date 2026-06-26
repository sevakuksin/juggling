import type { HandMotionConfig, HandId, PhysicsConfig } from "./config";
import { leftX, rightX } from "./config";
import { lenM } from "./sceneScale";
import {
  handInsideTheta,
  handOutsideTheta,
  handThetaAt,
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
  return omega * tAbs;
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

/** True if the hand is near outside at any sample in [t0, t1]. */
export function handNearOutsideBetween(
  hand: HandId,
  t0: number,
  t1: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
  samples = 6,
): boolean {
  if (t1 <= t0) return handNearOutside(hand, t0, cfg, motion, schedules);
  for (let i = 0; i <= samples; i++) {
    const t = t0 + (i / samples) * (t1 - t0);
    if (handNearOutside(hand, t, cfg, motion, schedules)) return true;
  }
  return false;
}

/** Geometric lower half of the hand ellipse (θ = π … 2π, y ≤ hand height). */
export function ellipseLowerHalfPath(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  _schedules?: HandMotionSchedules | null,
  n = 80,
): string {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const theta = Math.PI + (i / n) * Math.PI;
    const [x, y] = handXyFromTheta(hand, theta, cfg, motion);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  return d;
}

export function firstThrowBeat(startHand: HandId): number {
  return startHand === "right" ? 0 : 1;
}
