import type { ReactNode } from "react";

interface DemoLayoutProps {
  animation: ReactNode;
  legend?: ReactNode;
  controls?: ReactNode;
  /** Fraction of width for controls column (default 0.5). Omit controls for full-width animation. */
  controlsFraction?: number;
}

/** Animation left, optional scrollable controls right. */
export function DemoLayout({
  animation,
  legend,
  controls,
  controlsFraction = 0.5,
}: DemoLayoutProps) {
  if (!controls) {
    return (
      <div className="demo-layout demo-layout--full">
        <div className="demo-animation">
          <div className="demo-animation-canvas">{animation}</div>
          {legend && <div className="demo-animation-legend">{legend}</div>}
        </div>
      </div>
    );
  }

  const animFraction = 1 - controlsFraction;
  return (
    <div
      className={`demo-layout${controlsFraction < 0.35 ? " demo-layout--wide" : ""}`}
      style={{
        gridTemplateColumns: `${animFraction}fr ${controlsFraction}fr`,
      }}
    >
      <div className="demo-animation">
        <div className="demo-animation-canvas">{animation}</div>
        {legend && <div className="demo-animation-legend">{legend}</div>}
      </div>
      <div className="demo-controls">{controls}</div>
    </div>
  );
}
