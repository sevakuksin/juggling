import type { HandMotionConfig, HandId, PhysicsConfig } from "./config";
import { leftX, rightX } from "./config";
import { lenM } from "./sceneScale";
import {
  handInsideTheta,
  handOutsideTheta,
  handThetaAt,
  type HandMotionSchedules,
} from "./handSchedule";
import { NORMAL_THROW_MOTION, orientedHandTheta, type ThrowMotionSpec } from "./throwMotion";

export { buildHandSchedules, buildShowerHandSchedules, type HandMotionSchedules } from "./handSchedule";
export type { HandMotionSchedule, HandMotionSegment } from "./handSchedule";

export interface HandPose {
  x: number;
  y: number;
}

export function handOmega(cfg: PhysicsConfig): number {
  return Math.PI / cfg.beatPeriodS;
}

function motionSpecForHand(hand: HandId, schedules: HandMotionSchedules): ThrowMotionSpec {
  return schedules.handMotionSpec?.[hand] ?? schedules.motionSpec;
}

function throwBeatAtOrBefore(hand: HandId, beat: number): number | null {
  if (beat < 0) return null;
  if (throwBeatForHand(hand, beat)) return beat;
  return throwBeatAtOrBefore(hand, beat - 1);
}

function effectiveMotionSpec(
  hand: HandId,
  tAbs: number,
  cfg: PhysicsConfig,
  schedules: HandMotionSchedules,
): ThrowMotionSpec {
  if (schedules.motionSpecAtBeat) {
    const beat = Math.floor(tAbs / cfg.beatPeriodS + 1e-9);
    const specBeat = throwBeatAtOrBefore(hand, beat);
    if (specBeat != null) {
      return schedules.motionSpecAtBeat(hand, specBeat);
    }
    return NORMAL_THROW_MOTION;
  }
  return motionSpecForHand(hand, schedules);
}

/** θ from this hand's schedule (normal functional mapping). */
function handThetaNormal(
  hand: HandId,
  tAbs: number,
  schedules: HandMotionSchedules,
): number {
  const sched = schedules[hand];
  const raw = handThetaAt(tAbs, sched);
  return orientedHandTheta(hand, raw, NORMAL_THROW_MOTION);
}

/**
 * Reversed hand motion: same absolute (vx, vy), inside↔outside swapped (θ → π − θ).
 * Uses this hand's own schedule phase.
 */
function reverseHandTheta(hand: HandId, tAbs: number, schedules: HandMotionSchedules): number {
  const selfTheta = handThetaNormal(hand, tAbs, schedules);
  return Math.PI - selfTheta;
}

/** Uniform fallback: full ellipse, θ increasing (right from 0, left from π). */
export function handPhaseRad(
  hand: HandId,
  tAbs: number,
  cfg: PhysicsConfig,
  schedules?: HandMotionSchedules | null,
): number {
  if (!schedules) {
    return handOmega(cfg) * tAbs;
  }

  if (schedules.useVisualTheta) {
    return handThetaAt(tAbs, schedules[hand]);
  }

  const spec = effectiveMotionSpec(hand, tAbs, cfg, schedules);
  if (spec.reversedHandMotion) {
    return reverseHandTheta(hand, tAbs, schedules);
  }

  const raw = handThetaAt(tAbs, schedules[hand]);
  return orientedHandTheta(hand, raw, spec);
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
  if (!schedules) {
    const theta = handOmega(cfg) * tAbs;
    const [x, y] = handXyFromTheta(hand, theta, cfg, motion);
    return { x, y };
  }

  if (schedules.useVisualTheta) {
    const theta = handThetaAt(tAbs, schedules[hand]);
    const [x, y] = handXyFromTheta(hand, theta, cfg, motion);
    return { x, y };
  }

  const spec = effectiveMotionSpec(hand, tAbs, cfg, schedules);
  if (spec.reversedHandMotion) {
    const theta = reverseHandTheta(hand, tAbs, schedules);
    const [x, y] = handXyFromTheta(hand, theta, cfg, motion);
    return { x, y };
  }

  const theta = handPhaseRad(hand, tAbs, cfg, schedules);
  const [x, y] = handXyFromTheta(hand, theta, cfg, motion);
  return { x, y };
}

/** Geometric inside point on the hand ellipse. */
export function handXyInside(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  return handXyFromTheta(hand, handInsideTheta(hand), cfg, motion);
}

/** Geometric outside point on the hand ellipse. */
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

/** Ball position at a geometric inside/outside point (lifted above the hand). */
export function geometricBallSlot(
  hand: HandId,
  side: "inside" | "outside",
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  return side === "inside"
    ? insideBallSlot(hand, cfg, motion)
    : outsideBallSlot(hand, cfg, motion);
}

/** Geometric inside ball slot. */
export function insideBallSlot(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  const [x, y] = handXyInside(hand, cfg, motion);
  return [x, y + ballLiftM(cfg)];
}

/** Geometric outside ball slot. */
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

export function handNearInside(
  hand: HandId,
  t: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
  epsM = lenM(0.35),
): boolean {
  const [ix, iy] = handXyInside(hand, cfg, motion);
  const pose = handPosition(hand, t, cfg, motion, schedules);
  return Math.hypot(pose.x - ix, pose.y - iy) <= epsM;
}

/** True if the hand is near geometric outside at any sample in [t0, t1]. */
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

/** True if the hand is near geometric inside at any sample in [t0, t1]. */
export function handNearInsideBetween(
  hand: HandId,
  t0: number,
  t1: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  schedules?: HandMotionSchedules | null,
  samples = 6,
): boolean {
  if (t1 <= t0) return handNearInside(hand, t0, cfg, motion, schedules);
  for (let i = 0; i <= samples; i++) {
    const t = t0 + (i / samples) * (t1 - t0);
    if (handNearInside(hand, t, cfg, motion, schedules)) return true;
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
