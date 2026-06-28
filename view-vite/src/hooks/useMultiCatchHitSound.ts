import { useEffect, useRef } from "react";
import { playCatchHit } from "@/audio/playCatchHit";
import type { CustomBallPhase } from "@/physics/customPatternSimulator";

function isCaughtTransition(prev: CustomBallPhase, next: CustomBallPhase): boolean {
  if (prev === "airborne" && (next === "catching" || next === "dwell" || next === "inHand")) {
    return true;
  }
  if (prev === "catching" && (next === "dwell" || next === "inHand")) {
    return true;
  }
  return false;
}

/** Play catch sound when any ball completes a catch. */
export function useMultiCatchHitSound(
  balls: { id: number; phase: CustomBallPhase }[],
): void {
  const prevPhases = useRef<Map<number, CustomBallPhase>>(new Map());

  useEffect(() => {
    const prev = prevPhases.current;
    for (const ball of balls) {
      const p = prev.get(ball.id);
      if (p !== undefined && isCaughtTransition(p, ball.phase)) {
        playCatchHit();
      }
      prev.set(ball.id, ball.phase);
    }
    for (const id of [...prev.keys()]) {
      if (!balls.some((b) => b.id === id)) prev.delete(id);
    }
  }, [balls]);
}
