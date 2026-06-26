import { useEffect, useRef } from "react";
import { playCatchHit } from "@/audio/playCatchHit";
import type { BallPhase } from "@/physics/ballSimulator";

function isCaughtTransition(prev: BallPhase, next: BallPhase): boolean {
  if (prev === "airborne" && (next === "catching" || next === "dwell" || next === "inHand")) {
    return true;
  }
  if (prev === "catching" && (next === "dwell" || next === "inHand")) {
    return true;
  }
  return false;
}

/** Play a hit sound when the simulator records a successful catch. */
export function useCatchHitSound(phase: BallPhase): void {
  const prev = useRef<BallPhase | null>(null);

  useEffect(() => {
    const p = prev.current;
    if (p !== null && isCaughtTransition(p, phase)) {
      playCatchHit();
    }
    prev.current = phase;
  }, [phase]);
}
