import { useEffect, useRef } from "react";

interface CanvasStageProps {
  width?: string;
  onDraw: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void;
  deps?: unknown[];
  animating?: boolean;
}

export function CanvasStage({
  width = "100%",
  onDraw,
  deps = [],
  animating = false,
}: CanvasStageProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const onDrawRef = useRef(onDraw);
  onDrawRef.current = onDraw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => onDrawRef.current(ctx, canvas);

    const ro = new ResizeObserver(draw);
    ro.observe(canvas.parentElement ?? canvas);
    draw();

    let raf = 0;
    if (animating) {
      const loop = () => {
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, animating]);

  return (
    <canvas
      ref={ref}
      className="canvas-stage"
      style={{ width, display: "block" }}
    />
  );
}
