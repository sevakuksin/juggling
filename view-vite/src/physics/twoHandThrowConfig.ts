/**
 * Two-hand throw demo — tunable rules and defaults.
 *
 * Edit values here to change juggling behaviour and UI limits; the scene reads
 * this file instead of scattering magic numbers across components.
 */

/** Visible stage height at height-zoom 1× (ground y=0 … y=stageHeightM). */
export const STAGE_HEIGHT_M = 2.5;

export const HEIGHT_ZOOM = {
  min: 0.6,
  max: 2.5,
  default: 1,
} as const;

export const WIDTH_ZOOM = {
  min: 0.6,
  max: 2.5,
  default: 1,
} as const;

/** Stage top in metres: STAGE_HEIGHT_M × heightZoom (only the slider changes this). */
export function stageYMaxM(heightZoom: number): number {
  return STAGE_HEIGHT_M * heightZoom;
}

/** Dwell D: beats the ball stays in hand after each catch, before the next throw. */
export const DWELL = {
  min: 0.8,
  max: 1,
  default: 0.8,
  /** Slider step (beats). */
  step: 0.01,
} as const;

/** For throw n=1, air time is tiny — use a lower dwell band so (n−D) stays reasonable. */
export const DWELL_THROW_1 = {
  min: 0.1,
  max: 0.4,
  default: 0.25,
} as const;

/** Throw n=2 dwell band (100% = max = full in-hand time before release). */
export const DWELL_THROW_2 = {
  min: 0,
  max: 2,
  default: 2,
} as const;

/** Independent dwell values per throw height (demo 4). */
export interface DwellProfile {
  /** Throws n ≥ 3. */
  general: number;
  /** Throw height 1. */
  throw1: number;
  /** Throw height 2. */
  throw2: number;
}

export function defaultDwellProfile(): DwellProfile {
  return {
    general: DWELL.default,
    throw1: DWELL_THROW_1.default,
    throw2: DWELL_THROW_2.default,
  };
}

export function dwellForThrowHeight(profile: DwellProfile, throwValue: number): number {
  if (throwValue <= 0) return 0;
  if (throwValue === 1) return clampDwell(profile.throw1, 1);
  if (throwValue === 2) return Math.min(2, Math.max(DWELL_THROW_2.min, profile.throw2));
  return Math.min(throwValue, clampDwell(profile.general, throwValue));
}

/** Max dwell across profile — conservative hand-schedule timing. */
export function dwellProfileMax(profile: DwellProfile): number {
  return Math.max(profile.general, profile.throw1, profile.throw2);
}

export function dwellRangeForThrow(throwValue: number): { min: number; max: number; default: number } {
  if (throwValue === 1) return DWELL_THROW_1;
  return DWELL;
}

export function clampDwell(d: number, throwValue: number): number {
  const { min, max } = dwellRangeForThrow(throwValue);
  return Math.min(max, Math.max(min, d));
}

/** Throw 1 uses half the slider dwell; other throws use min(n, dwell). */
export function dwellBeatsForThrow(dwell: number, throwValue: number): number {
  if (throwValue === 1) {
    return Math.min(1, Math.max(0, dwell * 0.5));
  }
  return Math.min(throwValue, dwell);
}

/** @deprecated alias — same as dwellBeatsForThrow */
export function showerDwellBeats(highDwell: number, throwValue: number): number {
  return dwellBeatsForThrow(highDwell, throwValue);
}

/** Beat period T_b (seconds per siteswap beat). */
export const BEAT_PERIOD = {
  min: 0.15,
  max: 0.4,
  default: 0.35,
} as const;

/** Hand separation slider range (metres). PALM_M imported at call sites. */
export const HAND_SEP = {
  minPalms: 4,
  maxPalms: 14,
  stepPalms: 0.25,
} as const;

/**
 * Air time (siteswap timing):
 *   T_air = (n − D) × T_b
 * Ball is released at throw beat; lands D beats before the matching throw would repeat.
 */
export const AIR_TIME = {
  /** T_air in beats = throw n minus dwell D (D clamped to [0, n]). */
  formula: "T_air = (n − D) × T_b",
} as const;

/**
 * Hand motion along the ellipse (θ from inside≈0 to outside≈π).
 * Easing blends linear motion with a power curve; higher power = sharper accel/decel.
 */
export const HAND_SPEED = {
  /** Inside → outside (throw segment leaving inner edge). */
  fromInside: { linear: 0.48, power: 1.95 },
  /** Outside → inside (accelerate into next throw). */
  toInside: { linear: 0.44, power: 2.3 },
} as const;

/** Geometric θ: inside = 0, outside = π (normal functional throw/catch on reference ellipse). */
export const HAND_POSE_THETA = {
  inside: 0,
  outside: Math.PI,
} as const;

/**
 * Steady-state hand schedule repeats every periodBeats beats.
 * periodBeats = 2 × max(2, n) so both hands complete throw/catch cycles.
 */
export const HAND_SCHEDULE = {
  minPeriodBeatsMultiplier: 2,
  minThrowForPeriod: 2,
  /** Low-hand shower: throw this fraction of a beat after a same-beat catch. */
  showerCatchThenThrowFrac: 0.42,
  /** Same-side return: overshoot past current θ by this much (radians). */
  sameSideOvershootRad: (60 * Math.PI) / 180,
  /** Fraction of segment: ease out to overshoot / hold / ease back. */
  sameSideOutFrac: 0.38,
  sameSideHoldFrac: 0.14,
} as const;

/** Ball simulator timing. */
export const BALL_SIM = {
  catchTimeoutBeats: 1.25,
  /** After landing, sample hand pose up to this many beats forward for a catch. */
  catchProbeBeats: 0.35,
  respawnS: 0.5,
  maxThrow: 13,
} as const;

/** Animation scrub window (seconds). */
export const SCRUB_WINDOW_S = 8;

/** Horizontal padding added around hands in stage bounds (metres). */
export const STAGE_X_PAD_M = 0.45;
