export interface StageBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const VERTICAL_BOUNDS: StageBounds = {
  xMin: -0.45,
  xMax: 0.45,
  yMin: -0.06,
  yMax: 5.0,
};

export const SCALE_GUTTER_PX = 56;

export function twoHandBounds(
  handSep: number,
  rx = 0.1,
  yMax = 3.8,
  handHeight = 1.05,
): StageBounds {
  const half = handSep / 2;
  return {
    xMin: -half - rx - 0.25,
    xMax: half + rx + 0.25,
    yMin: 0,
    yMax: Math.max(yMax, handHeight + 0.5),
  };
}

export interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
}

export interface TransformOptions {
  padding?: number;
  paddingBottom?: number;
  scaleGutterPx?: number;
}

export function makeTransform(
  canvas: HTMLCanvasElement,
  bounds: StageBounds,
  options: TransformOptions = {},
): ViewTransform {
  const { padding = 20, paddingBottom = 20, scaleGutterPx = SCALE_GUTTER_PX } = options;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.round(w * devicePixelRatio);
  canvas.height = Math.round(h * devicePixelRatio);

  const innerW = w - padding * 2 - scaleGutterPx;
  const innerH = h - padding - paddingBottom;
  const worldW = bounds.xMax - bounds.xMin;
  const worldH = bounds.yMax - bounds.yMin;
  const scale = Math.min(innerW / worldW, innerH / worldH);

  const plotWidth = worldW * scale;
  const plotHeight = worldH * scale;
  const plotLeft = padding + scaleGutterPx + (innerW - plotWidth) / 2;
  const plotTop = padding + (innerH - plotHeight) / 2;

  const offsetX = plotLeft - bounds.xMin * scale;
  const offsetY = plotTop + bounds.yMax * scale;

  return {
    scale,
    offsetX,
    offsetY,
    width: w,
    height: h,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
  };
}

export function toScreen(tx: ViewTransform, x: number, y: number): [number, number] {
  return [tx.offsetX + x * tx.scale, tx.offsetY - y * tx.scale];
}

export function applyTransform(ctx: CanvasRenderingContext2D, tx: ViewTransform): void {
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, tx.width, tx.height);
}

/** Pick a nice tick step for the height ruler (meters). */
export function heightTickStep(yMax: number): number {
  if (yMax <= 1.5) return 0.25;
  if (yMax <= 3) return 0.5;
  if (yMax <= 6) return 1;
  if (yMax <= 12) return 2;
  return 5;
}

export function drawHeightScale(
  ctx: CanvasRenderingContext2D,
  tx: ViewTransform,
  bounds: StageBounds,
): void {
  const step = heightTickStep(bounds.yMax);
  const axisX = tx.plotLeft - 8;

  ctx.save();
  ctx.strokeStyle = "#8896a8";
  ctx.fillStyle = "#5c6570";
  ctx.lineWidth = 1.5;
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const [y0s] = toScreen(tx, bounds.xMin, bounds.yMin);
  const [yTopS] = toScreen(tx, bounds.xMin, bounds.yMax);
  ctx.beginPath();
  ctx.moveTo(axisX, yTopS);
  ctx.lineTo(axisX, y0s);
  ctx.stroke();

  for (let y = 0; y <= bounds.yMax + 1e-9; y += step) {
    const [, sy] = toScreen(tx, bounds.xMin, y);
    ctx.strokeStyle = "#8896a8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisX - 4, sy);
    ctx.lineTo(axisX, sy);
    ctx.stroke();
    ctx.fillStyle = "#5c6570";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(y.toFixed(step < 1 ? 1 : 0), axisX - 6, sy);
  }

  ctx.font = "600 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("m", axisX, y0s + 4);
  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  tx: ViewTransform,
  bounds: StageBounds,
): void {
  ctx.save();
  ctx.strokeStyle = "#dde1e8";
  ctx.lineWidth = 1;
  const step = heightTickStep(bounds.yMax);
  for (let x = Math.ceil(bounds.xMin / step) * step; x <= bounds.xMax; x += step) {
    const [sx0, sy0] = toScreen(tx, x, bounds.yMin);
    const [, sy1] = toScreen(tx, x, bounds.yMax);
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx0, sy1);
    ctx.stroke();
  }
  for (let y = 0; y <= bounds.yMax; y += step) {
    const [sx0, sy0] = toScreen(tx, bounds.xMin, y);
    const [sx1] = toScreen(tx, bounds.xMax, y);
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy0);
    ctx.stroke();
  }
  const [gx0, gy] = toScreen(tx, bounds.xMin, 0);
  const [gx1] = toScreen(tx, bounds.xMax, 0);
  ctx.strokeStyle = "#8896a8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(gx0, gy);
  ctx.lineTo(gx1, gy);
  ctx.stroke();
  ctx.restore();
}
