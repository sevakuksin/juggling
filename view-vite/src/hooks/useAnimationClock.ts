import { useCallback, useEffect, useRef, useState } from "react";

export interface AnimationClock {
  simTime: number;
  playing: boolean;
  speed: number;
  togglePlay: () => void;
  setSimTime: (t: number) => void;
  setSpeed: (s: number) => void;
  reset: () => void;
}

export function useAnimationClock(
  maxTime: number,
  options: { loop?: boolean; initialTime?: number } = {},
): AnimationClock {
  const { loop = false, initialTime = 0 } = options;
  const [simTime, setSimTimeState] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const simRef = useRef(simTime);
  simRef.current = simTime;

  const setSimTime = useCallback(
    (t: number) => {
      setPlaying(false);
      setSimTimeState(Math.max(0, Math.min(maxTime, t)));
    },
    [maxTime],
  );

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  const reset = useCallback(() => {
    setPlaying(false);
    setSimTimeState(0);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastRef.current === null) lastRef.current = now;
      const dt = ((now - lastRef.current) / 1000) * speed;
      lastRef.current = now;
      let next = simRef.current + dt;
      if (next >= maxTime) {
        next = loop ? next % maxTime : maxTime;
        if (!loop) setPlaying(false);
      }
      setSimTimeState(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, maxTime, loop]);

  useEffect(() => {
    if (simTime > maxTime) setSimTimeState(maxTime);
  }, [maxTime, simTime]);

  return { simTime, playing, speed, togglePlay, setSimTime, setSpeed, reset };
}

export function useFreeAnimationClock(initialTime = 0): AnimationClock {
  const [simTime, setSimTimeState] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const simRef = useRef(simTime);
  simRef.current = simTime;

  const setSimTime = useCallback((t: number) => {
    setPlaying(false);
    setSimTimeState(Math.max(0, t));
  }, []);

  const togglePlay = useCallback(() => setPlaying((p) => !p), []);
  const reset = useCallback(() => {
    setPlaying(false);
    setSimTimeState(0);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
      return;
    }
    const tick = (now: number) => {
      if (lastRef.current === null) lastRef.current = now;
      const dt = ((now - lastRef.current) / 1000) * speed;
      lastRef.current = now;
      setSimTimeState(simRef.current + dt);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed]);

  return { simTime, playing, speed, togglePlay, setSimTime, setSpeed, reset };
}
