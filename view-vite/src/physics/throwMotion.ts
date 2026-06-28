import type { HandId } from "./config";
import type { PatternDefinition } from "./patternCatalog";
import type { ParsedThrow } from "./siteswap";

/**
 * Terminology:
 * - **Geometric inside/outside** — fixed points on the hand ellipse.
 * - **Functional throw/catch** — which geometric point is used for release or reception.
 *
 * Normal throw: functional throw = geometric inside, functional catch = geometric outside.
 * Reversed throw: functional throw = geometric outside, functional catch = geometric inside.
 *
 * Each throw: release from this throw (reversed → outside). Landing follows the throw
 * scheduled at beat + height (reversed there → inside, normal → outside).
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
  releaseGeometric: "inside",
  landGeometric: "outside",
};

export function releaseGeometric(spec: ThrowMotionSpec): GeometricSide {
  return spec.releaseGeometric ?? (spec.reversed ? "outside" : "inside");
}

export function landGeometric(spec: ThrowMotionSpec): GeometricSide {
  return spec.landGeometric ?? (spec.reversed ? "inside" : "outside");
}

/** Release / landing slots from this throw and the throw scheduled at landing beat. */
export function throwGeometricEndpoints(
  cur: Pick<ParsedThrow, "reversed">,
  landRef: Pick<ParsedThrow, "reversed">,
): { release: GeometricSide; land: GeometricSide } {
  return {
    release: cur.reversed ? "outside" : "inside",
    land: landRef.reversed ? "inside" : "outside",
  };
}

export function throwMotionSpecFromThrows(
  cur: ParsedThrow,
  landRef: ParsedThrow,
): ThrowMotionSpec {
  const { release, land } = throwGeometricEndpoints(cur, landRef);
  return {
    reversed: cur.reversed,
    reversedHandMotion: false,
    releaseGeometric: release,
    landGeometric: land,
  };
}

export function throwMotionSpec(
  pattern: PatternDefinition,
  throwValue: number,
  _beat?: number,
  _startHand?: HandId,
): ThrowMotionSpec {
  if (pattern.family === "reverseCascade") {
    const { release, land } = throwGeometricEndpoints(
      { reversed: true },
      { reversed: true },
    );
    return {
      reversed: true,
      reversedHandMotion: true,
      releaseGeometric: release,
      landGeometric: land,
    };
  }

  if (pattern.family === "shower" && throwValue === 1) {
    const { release, land } = throwGeometricEndpoints(
      { reversed: false },
      { reversed: true },
    );
    return {
      reversed: false,
      reversedHandMotion: false,
      releaseGeometric: release,
      landGeometric: land,
    };
  }

  if (pattern.reverseHighThrow != null && throwValue === pattern.reverseHighThrow) {
    const { release, land } = throwGeometricEndpoints(
      { reversed: true },
      { reversed: false },
    );
    return {
      reversed: true,
      reversedHandMotion: true,
      releaseGeometric: release,
      landGeometric: land,
    };
  }

  return NORMAL_THROW_MOTION;
}

/** Per-throw motion when landing throw is not known (fallback: next in period). */
export function throwMotionSpecForParsed(
  throws: ParsedThrow[],
  throwIndex: number,
): ThrowMotionSpec {
  const period = throws.length;
  const cur = throws[((throwIndex % period) + period) % period];
  const next = throws[((throwIndex + 1) % period + period) % period];
  return throwMotionSpecFromThrows(cur, next);
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
