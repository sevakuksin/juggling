import type { ReactNode } from "react";

interface DemoLayoutProps {
  animation: ReactNode;
  legend?: ReactNode;
  controls: ReactNode;
}

/** 50/50 layout: left = animation (fixed), right = scrollable controls. */
export function DemoLayout({ animation, legend, controls }: DemoLayoutProps) {
  return (
    <div className="demo-layout">
      <div className="demo-animation">
        <div className="demo-animation-canvas">{animation}</div>
        {legend && <div className="demo-animation-legend">{legend}</div>}
      </div>
      <div className="demo-controls">{controls}</div>
    </div>
  );
}
