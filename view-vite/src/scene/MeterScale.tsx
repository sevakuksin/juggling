import { lenM, PALM_M } from "@/physics/sceneScale";

/** Vertical meter scale on the far left of the stage. */
export function MeterScale({ yMin, yMax, x }: { yMin: number; yMax: number; x: number }) {
  const span = yMax - yMin;
  const step = span > 2.5 ? 0.5 : span > 1.2 ? 0.25 : 0.2;
  const ticks: number[] = [];
  for (let y = 0; y <= yMax + step * 0.01; y += step) {
    ticks.push(Math.round(y * 100) / 100);
  }

  const tickLen = lenM(0.35);
  const labelOffset = lenM(0.55);
  const fontSize = lenM(0.52);

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
    </g>
  );
}

export function HeightScale({ yMax, x }: { yMax: number; x: number }) {
  return <MeterScale x={x} yMin={0} yMax={yMax} />;
}
