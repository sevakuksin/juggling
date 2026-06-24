import type { HandMotionConfig, HandId, PhysicsConfig } from "./config";
import { leftX, rightX } from "./config";

export interface HandPose {
  x: number;
  y: number;
}

export function handOmega(cfg: PhysicsConfig): number {
  return Math.PI / cfg.beatPeriodS;
}

export function handPhaseRad(hand: HandId, tAbs: number, cfg: PhysicsConfig): number {
  const omega = handOmega(cfg);
  return hand === "left" ? omega * tAbs + Math.PI : omega * tAbs;
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
): HandPose {
  const theta = handPhaseRad(hand, tAbs, cfg);
  const [x, y] = handXyFromTheta(hand, theta, cfg, motion);
  return { x, y };
}

function throwPhaseTime(hand: HandId, cfg: PhysicsConfig): number {
  return hand === "left" ? cfg.beatPeriodS : 0;
}

function catchPhaseTime(hand: HandId, cfg: PhysicsConfig): number {
  return hand === "left" ? 0 : cfg.beatPeriodS;
}

export function handXyInside(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  const t = throwPhaseTime(hand, cfg);
  const { x, y } = handPosition(hand, t, cfg, motion);
  return [x, y];
}

export function handXyOutside(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): [number, number] {
  const t = catchPhaseTime(hand, cfg);
  const { x, y } = handPosition(hand, t, cfg, motion);
  return [x, y];
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
  epsM = 0.025,
): boolean {
  const [ox, oy] = handXyOutside(hand, cfg, motion);
  const pose = handPosition(hand, t, cfg, motion);
  return Math.hypot(pose.x - ox, pose.y - oy) <= epsM;
}

export function ellipsePoints(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  n = 80,
): [number, number][] {
  const pts: [number, number][] = [];
  const period = 2 * cfg.beatPeriodS;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * period;
    const { x, y } = handPosition(hand, t, cfg, motion);
    pts.push([x, y]);
  }
  return pts;
}

export function firstThrowBeat(startHand: HandId): number {
  return startHand === "right" ? 0 : 1;
}
