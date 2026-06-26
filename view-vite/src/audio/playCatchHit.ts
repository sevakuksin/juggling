let sharedCtx: AudioContext | null = null;

function audioContext(): AudioContext {
  if (!sharedCtx) sharedCtx = new AudioContext();
  return sharedCtx;
}

/** Short percussive hit for a ball landing in the hand. */
export function playCatchHit(): void {
  const ctx = audioContext();
  if (ctx.state === "suspended") void ctx.resume();

  const t0 = ctx.currentTime;

  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.07);
  oscGain.gain.setValueAtTime(0.0001, t0);
  oscGain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.004);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.11);

  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 900;
  noiseFilter.Q.value = 0.6;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(t0);
  noise.stop(t0 + 0.06);
}
