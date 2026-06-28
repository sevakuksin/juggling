import { lenM, PALM_M } from "@/physics/sceneScale";

/** Vertical meter scale on the far left + horizontal ground axis. */
export function MeterScale({
  yMin,
  yMax,
  x,
  xMin,
  xMax,
}: {
  yMin: number;
  yMax: number;
  x: number;
  xMin?: number;
  xMax: number;
}) {
  const span = yMax - yMin;
  const step = span > 2.5 ? 0.5 : span > 1.2 ? 0.25 : 0.2;
  const ticks: number[] = [];
  for (let y = 0; y <= yMax + step * 0.01; y += step) {
    ticks.push(Math.round(y * 100) / 100);
  }

  const tickLen = lenM(0.35);
  const labelOffset = lenM(0.55);
  const fontSize = lenM(0.52);
  const xLeft = xMin ?? x;
  const xSpan = xMax - xLeft;
  const xStep = xSpan > 2.5 ? 0.5 : xSpan > 1.2 ? 0.25 : 0.2;
  const xTickStart = Math.floor(xLeft / xStep) * xStep;
  const xTicks: number[] = [];
  for (let wx = xTickStart; wx <= xMax + xStep * 0.01; wx += xStep) {
    xTicks.push(Math.round(wx * 100) / 100);
  }

  return (
    <g className="meter-scale" aria-hidden>
      <line className="meter-scale-axis" x1={x} y1={yMin} x2={x} y2={yMax} />
      {ticks.map((y) => (
        <g key={y}>
          <line className="meter-scale-tick" x1={x} y1={y} x2={x + tickLen} y2={y} />
          <g transform={`translate(${x + labelOffset}, ${y}) scale(1, -1)`}>
            <text className="meter-scale-label" y={0} fontSize={fontSize}>
              {y.toFixed(step >= 0.5 ? 1 : 2)}
            </text>
          </g>
        </g>
      ))}
      <g transform={`translate(${x + labelOffset}, ${yMax + lenM(0.5)}) scale(1, -1)`}>
        <text className="meter-scale-unit" y={0} fontSize={fontSize * 1.05}>
          m
        </text>
      </g>
      <g transform={`translate(${x + tickLen + lenM(0.15)}, ${yMin + lenM(0.45)}) scale(1, -1)`}>
        <line className="meter-scale-palm" x1={0} y1={0} x2={PALM_M} y2={0} />
        <text className="meter-scale-palm-label" x={PALM_M / 2} y={lenM(0.35)} fontSize={fontSize * 0.85}>
          palm
        </text>
      </g>

      {/* Horizontal axis at ground (y=0) */}
      <line className="meter-scale-x-axis" x1={xLeft} y1={0} x2={xMax} y2={0} />
      {xTicks.map((wx) => {
        if (wx > xMax + 1e-6) return null;
        const showLabel = Math.abs(wx) > 0.01;
        return (
          <g key={`x-${wx}`}>
            <line className="meter-scale-x-tick" x1={wx} y1={0} x2={wx} y2={tickLen * 0.85} />
            {showLabel && (
              <g transform={`translate(${wx}, ${tickLen * 1.15}) scale(1, -1)`}>
                <text className="meter-scale-x-label" y={0} fontSize={fontSize * 0.88} textAnchor="middle">
                  {wx.toFixed(xStep >= 0.5 ? 1 : 2)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

export function HeightScale({ yMax, x }: { yMax: number; x: number }) {
  return <MeterScale x={x} xMax={x + lenM(3)} yMin={0} yMax={yMax} />;
}
