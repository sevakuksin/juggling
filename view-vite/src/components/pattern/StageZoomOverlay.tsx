interface StageZoomOverlayProps {
  zoom: number;
  onZoomChange: (z: number) => void;
  min: number;
  max: number;
  step?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function ZoomIcon() {
  return (
    <svg
      className="stage-zoom-icon"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden
      focusable="false"
    >
      <circle cx={10} cy={10} r={6.5} fill="none" stroke="currentColor" strokeWidth={2} />
      <line x1={15} y1={15} x2={21} y2={21} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

export function StageZoomOverlay({
  zoom,
  onZoomChange,
  min,
  max,
  step = 0.05,
}: StageZoomOverlayProps) {
  return (
    <div className="stage-zoom-rail" aria-label="Stage zoom">
      <span className="stage-zoom-icon-wrap" aria-hidden>
        <ZoomIcon />
      </span>
      <button
        type="button"
        className="stage-zoom-btn"
        onClick={() => onZoomChange(clamp(zoom - step, min, max))}
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        type="button"
        className="stage-zoom-btn"
        onClick={() => onZoomChange(clamp(zoom + step, min, max))}
        aria-label="Zoom out"
      >
        −
      </button>
    </div>
  );
}
