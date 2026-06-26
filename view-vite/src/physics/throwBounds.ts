import type { HandId, PhysicsConfig } from "./config";
import { landingHand } from "./config";
import type { HandMotionConfig } from "./config";
import { airTimeS } from "./airTime";
import { handXyInside, handXyOutside } from "./hands";
import { apexHeightM, type ProjectileThrow } from "./projectile";

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

export interface StageBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export function verticalBounds(tofS: number, handHeightM: number): StageBounds {
  const apex = handHeightM + ((9.81 * tofS) / 2) ** 2 / (2 * 9.81);
  return { xMin: -0.45, xMax: 0.45, yMin: 0, yMax: apex + 0.35 };
}

export function twoHandBounds(
  handSepM: number,
  rxM: number,
  yMax: number,
  handHeightM: number,
): StageBounds {
  const pad = rxM + 0.45;
  return {
    xMin: -handSepM / 2 - pad,
    xMax: handSepM / 2 + pad,
    yMin: 0,
    yMax: Math.max(yMax, handHeightM + 0.5),
  };
}
