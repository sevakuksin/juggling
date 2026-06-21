export function verticalVelocityFromTof(tofS: number, g = 9.81): number {
  return (g * tofS) / 2;
}

export function tofFromVerticalVelocity(vy0: number, g = 9.81): number {
  return (2 * vy0) / g;
}

export function verticalEnergyFromTof(massKg: number, tofS: number, g = 9.81): number {
  const vy0 = verticalVelocityFromTof(tofS, g);
  return 0.5 * massKg * vy0 * vy0;
}

export function tofFromVerticalEnergy(massKg: number, energyJ: number, g = 9.81): number {
  if (energyJ < 0) throw new Error("Energy must be non-negative.");
  const vy0 = Math.sqrt((2 * energyJ) / massKg);
  return tofFromVerticalVelocity(vy0, g);
}

export function apexHeightFromTof(tofS: number, g = 9.81): number {
  const vy0 = verticalVelocityFromTof(tofS, g);
  return (vy0 * vy0) / (2 * g);
}
