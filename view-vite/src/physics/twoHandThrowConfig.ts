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

export function dwellRangeForThrow(throwValue: number): { min: number; max: number; default: number } {
  if (throwValue === 1) return DWELL_THROW_1;
  return DWELL;
}

export function clampDwell(d: number, throwValue: number): number {
  const { min, max } = dwellRangeForThrow(throwValue);
  return Math.min(max, Math.max(min, d));
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

/** θ at throw (inside) and catch (outside) poses on the reference ellipse. */
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
