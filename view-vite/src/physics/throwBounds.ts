import { STAGE_X_PAD_M } from "./twoHandThrowConfig";

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
  widthZoom = 1,
): StageBounds {
  const pad = (rxM + STAGE_X_PAD_M) / widthZoom;
  return {
    xMin: -handSepM / 2 - pad,
    xMax: handSepM / 2 + pad,
    yMin: 0,
    yMax: Math.max(yMax, handHeightM + 0.5),
  };
}
