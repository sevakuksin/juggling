/**
 * Universal scene scale: one real-world reference (palm width) defines all spatial sizes.
 * SVG user units are meters; time is seconds (beat period is the temporal unit).
 */
export const PALM_M = 0.085;

export const SceneUnits = {
  palm: PALM_M,
  handSeparation: 9.5 * PALM_M,
  handHeight: 12.4 * PALM_M,
  ballRadius: 0.52 * PALM_M,
  ellipseRx: 1.15 * PALM_M,
  ellipseRy: 0.65 * PALM_M,
  /** Palm width ≈ 30% of imported hand SVG art width. */
  palmFractionOfHandArt: 0.3,
  beatPeriodS: 0.35,
  /** Left gutter reserved for the meter scale (m). */
  scaleGutterM: 1.6 * PALM_M,
} as const;

export function handArtExtentM(): number {
  return SceneUnits.palm / SceneUnits.palmFractionOfHandArt;
}

export function lenM(palmMult: number): number {
  return palmMult * PALM_M;
}

export function ballDisplayRadiusM(): number {
  return SceneUnits.ballRadius * 1.08;
}
