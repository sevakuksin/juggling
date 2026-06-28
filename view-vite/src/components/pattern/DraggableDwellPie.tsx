import { useCallback, useRef } from "react";

interface DraggableDwellPieProps {
  label: string;
  /** Current value in beats (within min–max). */
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Reference beat length for % display (usually 1). */
  beatRef?: number;
}

function fractionFromValue(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return (value - min) / (max - min);
}

function valueFromFraction(f: number, min: number, max: number): number {
  return min + f * (max - min);
}

function polarToFraction(clientX: number, clientY: number, cx: number, cy: number): number {
  const dx = clientX - cx;
  const dy = clientY - cy;
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;
  const start = -Math.PI / 2;
  let a = angle - start;
  if (a < 0) a += Math.PI * 2;
  return Math.min(1, Math.max(0, a / (Math.PI * 2)));
}

export function DraggableDwellPie({
  label,
  value,
  min,
  max,
  onChange,
  beatRef = 1,
}: DraggableDwellPieProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const fraction = fractionFromValue(value, min, max);
  const pctOfBeat = beatRef > 0 ? (value / beatRef) * 100 : 0;

  const size = 102;
  const cx = size / 2;
  const cy = size / 2;
  const r = 40;
  const handleAngle = -Math.PI / 2 + fraction * Math.PI * 2;
  const hx = cx + r * Math.cos(handleAngle);
  const hy = cy + r * Math.sin(handleAngle);

  const bgArc = describeArc(cx, cy, r, 0, Math.PI * 2);
  const fillEnd = -Math.PI / 2 + fraction * Math.PI * 2;
  const fillArc = fraction > 0.001 ? describeArc(cx, cy, r, -Math.PI / 2, fillEnd) : "";

  const updateFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const f = polarToFraction(clientX, clientY, rect.left + cx, rect.top + cy);
      onChange(Math.round(valueFromFraction(f, min, max) * 100) / 100);
    },
    [min, max, onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture(e.pointerId);
    updateFromEvent(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromEvent(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div className="dwell-pie">
      <svg
        ref={svgRef}
        className="dwell-pie-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={`${label} dwell`}
      >
        <circle cx={cx} cy={cy} r={r} className="dwell-pie-ring" fill="none" />
        <path d={bgArc} className="dwell-pie-bg" />
        {fillArc && <path d={fillArc} className="dwell-pie-fill" />}
        <circle cx={hx} cy={hy} r={8} className="dwell-pie-handle" />
        <text x={cx} y={cy + 4} className="dwell-pie-pct" textAnchor="middle">
          {Math.round(pctOfBeat)}%
        </text>
      </svg>
      <div className="dwell-pie-meta">
        <span className="dwell-pie-label">{label}</span>
        <span className="dwell-pie-value">D={value.toFixed(2)}</span>
      </div>
    </div>
  );
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number): string {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export { fractionFromValue, valueFromFraction };
