import { useCallback, useId, useRef } from "react";
import type { HandId, HandMotionConfig, PhysicsConfig } from "@/physics/config";
import { leftX, rightX } from "@/physics/config";
import { handPosition, type HandMotionSchedules } from "@/physics/hands";
import { lenM, PALM_M } from "@/physics/sceneScale";
import { HAND_SEP } from "@/physics/twoHandThrowConfig";

interface HandSeparationLayerProps {
  t: number;
  cfg: PhysicsConfig;
  motion: HandMotionConfig;
  schedules?: HandMotionSchedules | null;
  handSepM: number;
  onHandSepChange: (sepM: number) => void;
}

function clampSep(sep: number): number {
  const min = HAND_SEP.minPalms * PALM_M;
  const max = HAND_SEP.maxPalms * PALM_M;
  return Math.min(max, Math.max(min, sep));
}

export function HandSeparationLayer({
  t,
  cfg,
  motion,
  schedules,
  handSepM,
  onHandSepChange,
}: HandSeparationLayerProps) {
  const uid = useId().replace(/:/g, "");
  const dragRef = useRef<{ hand: HandId; startSep: number; startX: number; pxPerM: number } | null>(
    null,
  );

  const lx = leftX(cfg);
  const rx = rightX(cfg);
  const leftPose = handPosition("left", t, cfg, motion, schedules);
  const rightPose = handPosition("right", t, cfg, motion, schedules);

  const onPointerDown = useCallback(
    (hand: HandId, e: React.PointerEvent<SVGCircleElement>) => {
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const pxPerM = rect.width / vb.width;
      dragRef.current = { hand, startSep: handSepM, startX: e.clientX, pxPerM };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [handSepM],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxPx = e.clientX - d.startX;
      const dxM = dxPx / d.pxPerM;
      const delta = d.hand === "left" ? -dxM * 2 : dxM * 2;
      onHandSepChange(clampSep(d.startSep + delta));
    },
    [onHandSepChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const hitR = lenM(0.75);
  const groundY = 0;
  const dimY = -lenM(2.55);
  const labelSize = lenM(0.54);
  const labelBelowArrow = lenM(0.38);
  const arrowId = `hand-sep-arrow-${uid}`;

  return (
    <g
      className="hand-sep-layer"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <marker
          id={arrowId}
          markerWidth={6}
          markerHeight={6}
          refX={3}
          refY={3}
          orient="auto-start-reverse"
          markerUnits="strokeWidth"
        >
          <path d="M 0.5 0.5 L 5.5 3 L 0.5 5.5 Z" className="hand-sep-arrowhead" />
        </marker>
      </defs>

      <line className="hand-sep-projection" x1={lx} y1={groundY} x2={lx} y2={leftPose.y} />
      <line className="hand-sep-projection" x1={rx} y1={groundY} x2={rx} y2={rightPose.y} />

      <line className="hand-sep-tick" x1={lx} y1={groundY} x2={lx} y2={dimY} />
      <line className="hand-sep-tick" x1={rx} y1={groundY} x2={rx} y2={dimY} />

      <line
        className="hand-sep-dimension"
        x1={lx}
        y1={dimY}
        x2={rx}
        y2={dimY}
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />

      <g transform={`translate(${(lx + rx) / 2}, ${dimY - labelBelowArrow}) scale(1, -1)`}>
        <text className="hand-sep-label" y={0} fontSize={labelSize} textAnchor="middle" dominantBaseline="middle">
          {handSepM.toFixed(2)} m
        </text>
      </g>

      <circle
        className="hand-sep-handle hand-sep-handle--left"
        cx={leftPose.x}
        cy={leftPose.y}
        r={hitR}
        onPointerDown={(e) => onPointerDown("left", e)}
      />
      <circle
        className="hand-sep-handle hand-sep-handle--right"
        cx={rightPose.x}
        cy={rightPose.y}
        r={hitR}
        onPointerDown={(e) => onPointerDown("right", e)}
      />
    </g>
  );
}
