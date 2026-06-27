import type { HandId, HandMotionConfig, PhysicsConfig } from "./config";
import { landingHand } from "./config";
import type { PatternDefinition } from "./patternCatalog";
import {
  ballLiftM,
  geometricBallSlot,
  handXyInside,
  handXyOutside,
} from "./hands";
import {
  catchProbeGeometricInside,
  landGeometric,
  releaseGeometric,
  type ThrowMotionSpec,
} from "./throwMotion";

export type { ThrowMotionSpec, GeometricSide } from "./throwMotion";
export {
  NORMAL_THROW_MOTION,
  throwMotionSpec,
  usesInvertedArc,
  usesReverseHandPath,
  usesReversedHandMotion,
  usesReversedThrow,
  usesSwapHandMotion,
} from "./throwMotion";

export interface PatternMotionFlags {
  reverseHighThrow?: number;
}

export function motionFlagsForPattern(pattern: PatternDefinition): PatternMotionFlags {
  return { reverseHighThrow: pattern.reverseHighThrow };
}

export function landingHandForPattern(
  fromHand: HandId,
  throwValue: number,
  _flags: PatternMotionFlags,
): HandId {
  return landingHand(fromHand, throwValue);
}

export function throwSlot(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  spec: ThrowMotionSpec,
): [number, number] {
  return geometricBallSlot(hand, releaseGeometric(spec), cfg, motion);
}

export function catchSlot(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  spec: ThrowMotionSpec,
): [number, number] {
  return geometricBallSlot(hand, landGeometric(spec), cfg, motion);
}

export function catchPose(
  hand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  spec: ThrowMotionSpec,
): [number, number] {
  const side = landGeometric(spec);
  const [x, y] = side === "inside" ? handXyInside(hand, cfg, motion) : handXyOutside(hand, cfg, motion);
  return [x, y + ballLiftM(cfg)];
}

export { catchProbeGeometricInside };
