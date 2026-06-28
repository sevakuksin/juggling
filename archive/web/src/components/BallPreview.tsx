import { useId } from "react";

interface BallPreviewProps {
  value: number;
  size?: number;
}

/** Circular ball icon for controls (throw number preview). */
export function BallPreview({ value, size = 36 }: BallPreviewProps) {
  const gradId = useId();
  const r = size / 2;
  return (
    <svg
      className="ball-preview"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#ff9a8b" />
          <stop offset="45%" stopColor="#e8564a" />
          <stop offset="100%" stopColor="#922b21" />
        </radialGradient>
      </defs>
      <circle cx={r} cy={r + 2} r={r * 0.85} fill="rgba(26,35,50,0.1)" />
      <circle cx={r} cy={r} r={r - 1} fill={`url(#${gradId})`} stroke="#b83a32" strokeWidth="1" />
      <circle cx={r * 0.68} cy={r * 0.62} r={r * 0.22} fill="rgba(255,255,255,0.45)" />
      <text
        x={r}
        y={r + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={value >= 10 ? r * 0.75 : r * 0.85}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {value}
      </text>
    </svg>
  );
}
