import { useId } from "react";

interface BallSpriteProps {
  x: number;
  y: number;
  radius: number;
  label?: number | string;
  className?: string;
}

export function BallSprite({ x, y, radius, label, className }: BallSpriteProps) {
  const gradId = useId().replace(/:/g, "");
  const r = radius;
  const showLabel = label !== undefined && label !== "";

  return (
    <g
      className={`ball-sprite${className ? ` ${className}` : ""}`}
      transform={`translate(${x}, ${y})`}
    >
      <defs>
        <radialGradient id={`ball-grad-${gradId}`} cx="35%" cy="32%" r="65%">
          <stop offset="0%" className="ball-grad-light" />
          <stop offset="45%" className="ball-grad-mid" />
          <stop offset="100%" className="ball-grad-dark" />
        </radialGradient>
      </defs>
      <circle className="ball-shadow" cx={0} cy={-r * 0.12} r={r * 0.55} />
      <circle className="ball-body" r={r} fill={`url(#ball-grad-${gradId})`} />
      <circle className="ball-highlight" cx={-r * 0.28} cy={r * 0.32} r={r * 0.22} />
      {showLabel && (
        <g transform="scale(1, -1)">
          <text
            className="ball-label"
            textAnchor="middle"
            dominantBaseline="central"
            y={0}
            fontSize={typeof label === "number" && label >= 10 ? r * 1.1 : r * 1.25}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
}

export function BallPreview({ value, size = 36 }: { value: number; size?: number }) {
  const gradId = useId().replace(/:/g, "");
  const r = size / 2 - 2;
  return (
    <svg className="ball-preview" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <radialGradient id={`ball-prev-${gradId}`} cx="35%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#ff9a8b" />
          <stop offset="45%" stopColor="#e8564a" />
          <stop offset="100%" stopColor="#922b21" />
        </radialGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2 + 2} r={r * 0.85} fill="rgba(26,35,50,0.1)" />
      <circle cx={size / 2} cy={size / 2} r={r - 1} fill={`url(#ball-prev-${gradId})`} stroke="#b83a32" strokeWidth={1} />
      <circle cx={size * 0.68} cy={size * 0.62} r={r * 0.22} fill="rgba(255,255,255,0.45)" />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={value >= 10 ? r * 0.75 : r * 0.85}
        fontWeight={700}
        fontFamily="system-ui, sans-serif"
      >
        {value}
      </text>
    </svg>
  );
}

/** Display radius — slightly larger than physics for visibility on SVG stage. */
export const BALL_DISPLAY_RADIUS = 0.055;
