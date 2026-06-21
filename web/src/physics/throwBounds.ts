import type { HandId, PhysicsConfig } from "../physics/config";
import { landingHand } from "../physics/config";
import type { HandMotionConfig } from "../physics/config";
import { airTimeS } from "./airTime";
import { handXyInside, handXyOutside } from "../physics/hands";
import { apexHeightM, type ProjectileThrow } from "../physics/projectile";

/** Estimate apex using inside→outside geometry and actual air time (h−d)·T_b. */
export function apexForThrowValue(
  throwValue: number,
  dwellBeats: number,
  fromHand: HandId,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
): number {
  if (throwValue <= 0) return 0;
  const toHand = landingHand(fromHand, throwValue);
  const tofS = airTimeS(throwValue, dwellBeats, cfg.beatPeriodS);
  if (tofS <= 0) return cfg.handHeightM;
  const th: ProjectileThrow = {
    startXy: handXyInside(fromHand, cfg, motion),
    endXy: handXyOutside(toHand, cfg, motion),
    tofS,
    massKg: cfg.massKg,
    g: cfg.g,
    startTimeS: 0,
    label: String(throwValue),
  };
  return apexHeightM(th);
}

/** yMax for stage bounds: fits throw apex with margin; zoomOut > 1 shows more height. */
export function yMaxForThrow(
  throwValue: number,
  dwellBeats: number,
  cfg: PhysicsConfig,
  motion: HandMotionConfig,
  zoomOut: number,
  fromHand: HandId = "right",
): number {
  const floor = cfg.handHeightM;
  if (throwValue <= 0) return Math.max(floor + 0.8, (floor + 0.8) * zoomOut);
  const crossRight = apexForThrowValue(throwValue, dwellBeats, "right", cfg, motion);
  const crossLeft = apexForThrowValue(throwValue, dwellBeats, "left", cfg, motion);
  const same = apexForThrowValue(throwValue, dwellBeats, fromHand, cfg, motion);
  const maxApex = Math.max(crossRight, crossLeft, same);
  return Math.max(floor + 0.6, (maxApex + 0.4) * zoomOut);
}
