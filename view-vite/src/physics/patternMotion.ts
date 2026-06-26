import type { HandId, HandMotionConfig, PhysicsConfig } from "./config";
import { landingHand, oppositeHand } from "./config";
import type { PatternDefinition } from "./patternCatalog";
import {
  ballLiftM,
  handXyInside,
  handXyOutside,
  insideBallSlot,
  outsideBallSlot,
} from "./hands";

export interface PatternMotionFlags {
  invertInsideOutside: boolean;
  reverseHighThrow?: number;
}

export function motionFlagsForPattern(pattern: PatternDefinition): PatternMotionFlags {
  return {
    invertInsideOutside: pattern.family === "reverseCascade",
    reverseHighThrow: pattern.reverseHighThrow,
  };
}

export function landingHandForPattern(
  fromHand: HandId,
  throwValue: number,
  flags: PatternMotionFlags,
): HandId {
  let target = landingHand(fromHand, throwValue);
  if (flags.reverseHighThrow != null && throwValue === flags.reverseHighThrow) {
    target = target === fromHand ? oppositeHand(fromHand) : fromHand;
  }
  return target;
}

export function throwSlot(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  flags: PatternMotionFlags,
): [number, number] {
  if (flags.invertInsideOutside) {
    return outsideBallSlot(hand, cfg, motion);
  }
  return insideBallSlot(hand, cfg, motion);
}

export function catchSlot(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  flags: PatternMotionFlags,
): [number, number] {
  if (flags.invertInsideOutside) {
    return insideBallSlot(hand, cfg, motion);
  }
  return outsideBallSlot(hand, cfg, motion);
}

export function catchPose(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  flags: PatternMotionFlags,
): [number, number] {
  if (flags.invertInsideOutside) {
    const [x, y] = handXyInside(hand, cfg, motion);
    return [x, y + ballLiftM(cfg)];
  }
  const [x, y] = handXyOutside(hand, cfg, motion);
  return [x, y + ballLiftM(cfg)];
}
