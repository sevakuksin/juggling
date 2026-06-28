import { useCallback, useEffect, useRef, useState } from "react";

/** Avoid a full 360° SVG wedge — breaks rendering. */
const ARC_CAP = 0.995;

interface DraggableDwellPieProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Beats represented by 100% on the label. */
  beatRef: number;
  /**
   * throw-1: max value sits at this fraction of the ring clockwise from 12 o'clock (0.6 = 60%).
   * Other pies: set circleMaxPct instead.
   */
  arcSpanFrac?: number;
  /** Dial % scale when arcSpanFrac unset (≥3 → 99, throw-2 → 200). */
  circleMaxPct?: number;
  color?: "blue" | "green" | "coral";
}

function valueToPct(value: number, beatRef: number): number {
  return beatRef > 0 ? (value / beatRef) * 100 : 0;
}

/** Client coords → SVG viewBox coords (handles CSS scaling). */
function clientToSvg(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): { x: number; y: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/** Clockwise fraction [0, 1) from 12 o'clock. */
function fracFromSvgPoint(x: number, y: number, cx: number, cy: number): number | null {
  const dx = x - cx;
  const dy = y - cy;
  if (Math.hypot(dx, dy) < 3) return null;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;
  let a = angle + Math.PI / 2;
  if (a >= Math.PI * 2) a -= Math.PI * 2;
  return a / (Math.PI * 2);
}

/** Snap angle fraction to arc; dead zone snaps to nearer endpoint. */
function snapFracToArc(f: number, arcStart: number, arcEnd: number): number {
  if (f >= arcStart && f <= arcEnd) return f;
  if (f > arcEnd) {
    const toEnd = f - arcEnd;
    const toStart = 1 - f + arcStart;
    return toEnd <= toStart ? arcEnd : arcStart;
  }
  return arcStart;
}

function fracToAngle(f: number): number {
  return -Math.PI / 2 + f * Math.PI * 2;
}

export function DraggableDwellPie({
  label,
  value,
  min,
  max,
  onChange,
  beatRef,
  arcSpanFrac,
  circleMaxPct = 99,
  color = "blue",
}: DraggableDwellPieProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const minPct = valueToPct(min, beatRef);
  const maxPct = valueToPct(max, beatRef);
  const valuePct = valueToPct(value, beatRef);

  const useArcSpan = arcSpanFrac != null && arcSpanFrac > 0;
  const arcStart = useArcSpan ? 0 : (minPct / circleMaxPct) * ARC_CAP;
  const arcEnd = useArcSpan ? arcSpanFrac * ARC_CAP : (maxPct / circleMaxPct) * ARC_CAP;

  const valueFrac = useArcSpan
    ? max <= min
      ? arcStart
      : arcStart + ((value - min) / (max - min)) * (arcEnd - arcStart)
    : maxPct <= minPct
      ? arcStart
      : arcStart + ((valuePct - minPct) / (maxPct - minPct)) * (arcEnd - arcStart);

  const size = 102;
  const cx = size / 2;
  const cy = size / 2;
  const r = 40;
  const startAngle = fracToAngle(arcStart);
  const endAngle = fracToAngle(arcEnd);
  const handleAngle = fracToAngle(valueFrac);
  const hx = cx + r * Math.cos(handleAngle);
  const hy = cy + r * Math.sin(handleAngle);

  const bgArc = describeWedge(cx, cy, r, startAngle, endAngle);
  const fillArc =
    valueFrac > arcStart + 0.001
      ? describeWedge(cx, cy, r, startAngle, handleAngle)
      : "";

  const applyPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const pt = clientToSvg(clientX, clientY, svg);
      if (!pt) return;
      let f = fracFromSvgPoint(pt.x, pt.y, cx, cy);
      if (f == null) return;
      f = snapFracToArc(f, arcStart, arcEnd);
      const span = arcEnd - arcStart;
      if (span < 1e-9) return;
      const t = (f - arcStart) / span;
      const next = min + t * (max - min);
      onChange(Math.round(Math.min(max, Math.max(min, next)) * 100) / 100);
    },
    [min, max, arcStart, arcEnd, onChange, cx, cy],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      applyPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
      setDragging(false);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, applyPointer]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    applyPointer(e.clientX, e.clientY);
  };

  return (
    <div className={`dwell-pie dwell-pie--${color}${dragging ? " dwell-pie--dragging" : ""}`}>
      <svg
        ref={svgRef}
        className="dwell-pie-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={`${label} dwell`}
      >
        <circle cx={cx} cy={cy} r={r} className="dwell-pie-ring" fill="none" pointerEvents="none" />
        <path d={bgArc} className="dwell-pie-bg" pointerEvents="none" />
        {fillArc && <path d={fillArc} className="dwell-pie-fill" pointerEvents="none" />}
        <BorderTick cx={cx} cy={cy} r={r} angle={startAngle} />
        <BorderTick cx={cx} cy={cy} r={r} angle={endAngle} />
        <circle cx={hx} cy={hy} r={10} className="dwell-pie-handle" pointerEvents="none" />
        <circle cx={cx} cy={cy} r={22} className="dwell-pie-center" pointerEvents="none" />
        <text x={cx} y={cy + 5} className="dwell-pie-pct" textAnchor="middle" pointerEvents="none">
          {Math.round(valuePct)}%
        </text>
        <rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill="transparent"
          style={{ touchAction: "none", cursor: "grab" }}
          onPointerDown={onPointerDown}
        />
      </svg>
      <div className="dwell-pie-meta">
        <span className="dwell-pie-label">{label}</span>
        <span className="dwell-pie-value">D={value.toFixed(2)}</span>
      </div>
    </div>
  );
}

function BorderTick({ cx, cy, r, angle }: { cx: number; cy: number; r: number; angle: number }) {
  const inner = r - 12;
  const outer = r + 3;
  return (
    <line
      className="dwell-pie-border"
      x1={cx + inner * Math.cos(angle)}
      y1={cy + inner * Math.sin(angle)}
      x2={cx + outer * Math.cos(angle)}
      y2={cy + outer * Math.sin(angle)}
      pointerEvents="none"
    />
  );
}

function describeWedge(cx: number, cy: number, r: number, start: number, end: number): string {
  if (end - start < 1e-6) return "";
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export { valueToPct };
