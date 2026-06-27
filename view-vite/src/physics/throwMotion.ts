import type { HandId } from "./config";
import type { PatternDefinition } from "./patternCatalog";

/**
 * Terminology:
 * - **Geometric inside/outside** — fixed points on the hand ellipse.
 * - **Functional throw/catch** — which geometric point is used for release or reception.
 *
 * Normal throw: functional throw = geometric inside, functional catch = geometric outside.
 * Reversed throw: functional throw = geometric outside, functional catch = geometric inside.
 *
 * Default ball endpoints follow `reversed`. Shower 1 and 5/7 override landing/release geometry.
 */
export type GeometricSide = "inside" | "outside";

export interface ThrowMotionSpec {
  /** Functional throw/catch ends swapped (outside throw, inside catch). */
  reversed: boolean;
  /** Hand path uses reversed motion (π − θ on this hand's beat phase). */
  reversedHandMotion: boolean;
  /** Geometric release; defaults from `reversed`. */
  releaseGeometric?: GeometricSide;
  /** Geometric landing; defaults from `reversed`. */
  landGeometric?: GeometricSide;
}

export const NORMAL_THROW_MOTION: ThrowMotionSpec = {
  reversed: false,
  reversedHandMotion: false,
};

export function releaseGeometric(spec: ThrowMotionSpec): GeometricSide {
  return spec.releaseGeometric ?? (spec.reversed ? "outside" : "inside");
}

export function landGeometric(spec: ThrowMotionSpec): GeometricSide {
  return spec.landGeometric ?? (spec.reversed ? "inside" : "outside");
}

export function throwMotionSpec(
  pattern: PatternDefinition,
  throwValue: number,
  _beat?: number,
  _startHand?: HandId,
): ThrowMotionSpec {
  if (pattern.family === "reverseCascade") {
    return { reversed: true, reversedHandMotion: true };
  }

  if (pattern.family === "shower" && throwValue === 1) {
    // Normal hand motion; ball inside→inside (feeds reversed 5/7 catch at geometric inside).
    return {
      reversed: false,
      reversedHandMotion: false,
      releaseGeometric: "inside",
      landGeometric: "inside",
    };
  }

  if (pattern.reverseHighThrow != null && throwValue === pattern.reverseHighThrow) {
    // Reversed hand motion; ball outside→outside (lands where normal 1 catches).
    return {
      reversed: true,
      reversedHandMotion: true,
      releaseGeometric: "outside",
      landGeometric: "outside",
    };
  }

  return NORMAL_THROW_MOTION;
}

export function usesReversedThrow(
  pattern: PatternDefinition,
  throwValue: number,
  beat?: number,
  startHand?: HandId,
): boolean {
  return throwMotionSpec(pattern, throwValue, beat, startHand).reversed;
}

export function usesReversedHandMotion(
  pattern: PatternDefinition,
  throwValue: number,
  beat?: number,
  startHand?: HandId,
): boolean {
  return throwMotionSpec(pattern, throwValue, beat, startHand).reversedHandMotion;
}

/** @deprecated Use usesReversedThrow */
export function usesInvertedArc(
  pattern: PatternDefinition,
  throwValue: number,
  beat?: number,
  startHand?: HandId,
): boolean {
  return usesReversedThrow(pattern, throwValue, beat, startHand);
}

/** @deprecated Use usesReversedHandMotion */
export function usesSwapHandMotion(
  pattern: PatternDefinition,
  throwValue: number,
  beat?: number,
  startHand?: HandId,
): boolean {
  return usesReversedHandMotion(pattern, throwValue, beat, startHand);
}

/** @deprecated Use usesReversedHandMotion */
export function usesReverseHandPath(
  pattern: PatternDefinition,
  throwValue: number,
): boolean {
  return throwMotionSpec(pattern, throwValue).reversedHandMotion;
}

/** Catch probe targets geometric inside when the ball lands there. */
export function catchProbeGeometricInside(spec: ThrowMotionSpec): boolean {
  return landGeometric(spec) === "inside";
}

/** Hand schedules always use normal segments; reversed motion is via θ remap. */
export function orientedHandTheta(_hand: HandId, theta: number, _spec: ThrowMotionSpec): number {
  return theta;
}
