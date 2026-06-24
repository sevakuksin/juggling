import type { HandId } from "@/physics/config";
import leftHandRaw from "@assets/left_hand.svg?raw";
import { stripHandSvg } from "./stripHandSvg";

export const HAND_ART_SIZE = 1254;
/** Anchor at canvas center, shifted 15% lower in art (SVG y-down). */
export const HAND_GRIP = { x: HAND_ART_SIZE / 2, y: (HAND_ART_SIZE / 2) * 1.15 };

const HAND_PATHS_HTML = { __html: stripHandSvg(leftHandRaw) };

interface HandSpriteProps {
  hand: HandId;
  x: number;
  y: number;
  sizeM?: number;
  className?: string;
}

/** Original left-hand art, anchored at canvas center on (x, y). Right = vertical mirror. */
export function HandSprite({ hand, x, y, sizeM = 0.52, className }: HandSpriteProps) {
  const scale = sizeM / HAND_ART_SIZE;
  const ox = -HAND_GRIP.x * scale;
  // Art paths use SVG y-down; scene uses physics y-up — negate y scale only (not a hand flip).
  const oy = HAND_GRIP.y * scale;

  const art = (
    <g transform={`translate(${ox}, ${oy}) scale(${scale}, ${-scale})`}>
      <g className="hand-sprite__art" dangerouslySetInnerHTML={HAND_PATHS_HTML} />
    </g>
  );

  return (
    <g
      className={`hand-sprite hand-sprite--${hand}${className ? ` ${className}` : ""}`}
      transform={`translate(${x}, ${y})`}
    >
      {hand === "right" ? <g transform="scale(-1, 1)">{art}</g> : art}
    </g>
  );
}
