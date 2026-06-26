import type { ReactNode } from "react";
import type { StageBounds } from "@/physics/throwBounds";
import { SceneUnits } from "@/physics/sceneScale";
import { MeterScale } from "@/scene/MeterScale";

interface SvgStageProps {
  bounds: StageBounds;
  children: ReactNode;
  className?: string;
  /** Extra margin around content as a fraction of span (default 8%). */
  pad?: number;
  showScale?: boolean;
}

/** Physics coords: x right, y up from ground at y = 0. */
export function padBounds(bounds: StageBounds, pad = 0.08): StageBounds {
  const w = bounds.xMax - bounds.xMin;
  const h = bounds.yMax - bounds.yMin;
  const mx = w * pad;
  const my = h * pad;
  return {
    xMin: bounds.xMin - mx - SceneUnits.scaleGutterM,
    xMax: bounds.xMax + mx,
    yMin: bounds.yMin,
    yMax: bounds.yMax + my,
  };
}

export function scaleAxisX(paddedBounds: StageBounds): number {
  return paddedBounds.xMin + SceneUnits.palm * 0.35;
}

export function SvgStage({ bounds, children, className, pad = 0.08, showScale = true }: SvgStageProps) {
  const b = padBounds(bounds, pad);
  const width = b.xMax - b.xMin;
  const height = b.yMax - b.yMin;

  return (
    <svg
      className={`svg-stage${className ? ` ${className}` : ""}`}
      viewBox={`${b.xMin} 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* Map physics (y up) → SVG (y down): bottom of stage = ground */}
      <g transform={`translate(0, ${height}) scale(1, -1)`}>
        {showScale && <MeterScale x={scaleAxisX(b)} yMin={b.yMin} yMax={b.yMax} />}
        {children}
      </g>
    </svg>
  );
}
