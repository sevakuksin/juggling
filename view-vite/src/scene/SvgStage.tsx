import type { ReactNode } from "react";
import type { StageBounds } from "@/physics/throwBounds";
import { lenM, SceneUnits } from "@/physics/sceneScale";
import { MeterScale } from "@/scene/MeterScale";

interface SvgStageProps {
  bounds: StageBounds;
  children: ReactNode;
  className?: string;
  /** Extra margin around content as a fraction of span (default 8%). */
  pad?: number;
  showScale?: boolean;
  /** Extend the horizontal axis this many metres left of physics x = 0 (hands unchanged). */
  extendOriginLeftM?: number;
}

/** Physics coords: x right, y up from ground at y = 0. */
export function padBounds(
  bounds: StageBounds,
  pad = 0.08,
  options?: { extendOriginLeftM?: number },
): StageBounds {
  const w = bounds.xMax - bounds.xMin;
  const h = bounds.yMax - bounds.yMin;
  const mx = w * pad;
  const my = h * pad;
  let xMin = bounds.xMin - mx - SceneUnits.scaleGutterM;
  if (options?.extendOriginLeftM != null && options.extendOriginLeftM > 0) {
    xMin = Math.min(xMin, -options.extendOriginLeftM);
  }

  return {
    xMin,
    xMax: bounds.xMax + mx,
    yMin: bounds.yMin,
    yMax: bounds.yMax + my,
  };
}

/** Extra metres below ground (y=0) kept visible in the viewBox. */
export function stageBottomPadM(bounds: StageBounds, pad = 0.08): number {
  const h = bounds.yMax - bounds.yMin;
  return Math.max(h * pad * 2.75, lenM(3.05));
}

export function scaleAxisX(paddedBounds: StageBounds): number {
  return paddedBounds.xMin + SceneUnits.palm * 0.35;
}

export function SvgStage({
  bounds,
  children,
  className,
  pad = 0.08,
  showScale = true,
  extendOriginLeftM,
}: SvgStageProps) {
  const b = padBounds(bounds, pad, { extendOriginLeftM });
  const bottomPad = stageBottomPadM(bounds, pad);
  const width = b.xMax - b.xMin;
  const contentHeight = b.yMax - b.yMin;
  const viewHeight = contentHeight + bottomPad;
  const axisX = scaleAxisX(b);
  const groundY = viewHeight - bottomPad;

  return (
    <svg
      className={`svg-stage${className ? ` ${className}` : ""}`}
      viewBox={`${b.xMin} 0 ${width} ${viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* Map physics (y up) → SVG (y down); ground sits above bottom pad */}
      <g transform={`translate(0, ${groundY}) scale(1, -1)`}>
        {showScale && (
          <MeterScale x={axisX} xMin={b.xMin} yMin={b.yMin} yMax={b.yMax} xMax={b.xMax} />
        )}
        {children}
      </g>
    </svg>
  );
}
