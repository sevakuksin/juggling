# Juggling Physics — SVG View

Standalone Vite + React app that renders juggling demos with **SVG sprites** (hand + ball), no canvas.

## Run locally

```bash
cd view-vite
npm install
npm run dev
```

Open the URL shown (typically http://localhost:5173).

## Routes

| Demo | URL |
|------|-----|
| Home | `/` |
| Vertical throw | `/demo/vertical` |
| Two hands | `/demo/two-hands` |
| Patterns | `/demo/patterns` |
| Pattern (placeholder) | `/demo/pattern` |
| Validator | `/demo/validator` |

## Assets

- Hand sprite: `public/sprites/left_hand.svg` (copied from `../assets/left_hand.svg`; right hand is mirrored)
- Ball sprite: `src/sprites/BallSprite.tsx` — CSS-customizable fill + optional throw number label

## Physics

Copied into `src/physics/` (standalone from `web/`). Air time:

**T_air = T_b × (n − D)**

where `n` is throw number and `D` is dwell beats (D ≤ n).

See [**Hand trajectories & scheduling**](#hand-trajectories--scheduling) below for a full
conceptual walkthrough of how hands move and how the schedule is built.

## Build

```bash
npm run build
npm run preview
```

---

# Hand trajectories & scheduling

This section documents, conceptually, how the simulation decides **where each hand is at
any moment**, how that is kept in sync with the **balls**, and the exact algorithm used to
generate the hand paths. It is the source-of-truth narrative for the code in
`src/physics/` — primarily `handSchedule.ts`, `hands.ts`, `customPattern.ts`,
`throwMotion.ts`, `siteswap.ts`, and the tunables in `twoHandThrowConfig.ts`.

## 1. The hand ellipse and its angle θ

Each hand moves around a fixed **ellipse** centred on that hand's rest point. A single
angle `θ` (radians) parametrises the position; `hands.ts → handXyFromTheta` maps it to
screen coordinates:

```
x = centerX ∓ rxM · cos(θ)      (− for the right hand, + for the left → mirrored)
y = centerY + ryM · sin(θ)
```

Two reference points are fixed for every hand (`HAND_POSE_THETA` in
`twoHandThrowConfig.ts`):

| Name              | θ   | Location                          |
|-------------------|-----|-----------------------------------|
| geometric **inside**  | `0`   | toward the body / centre line  |
| geometric **outside** | `π`   | away from the body             |

Because `y = centerY + ryM·sin(θ)`:

- **Upper arc** = `sin θ > 0` → `θ ∈ (0, π)` (the half *between* inside and outside, going over the top).
- **Lower arc** = `sin θ < 0` → `θ ∈ (π, 2π)` (the half going under the bottom).

So which arc a hand uses is purely a function of how θ travels between the inside (0) and
outside (π) points — increasing θ from 0→π goes over the top; continuing π→2π comes back
under the bottom. A **full rotation** is one lap of `2π` and necessarily uses both arcs.

## 2. Geometric vs functional sides; normal vs reversed throws

Two vocabularies (`throwMotion.ts`):

- **Geometric** inside/outside — fixed points on the ellipse (above).
- **Functional** throw/catch — *which* geometric point is used to release or receive a ball.

Mapping:

| Throw type        | Release (throw) | Receive (catch) |
|-------------------|-----------------|-----------------|
| **normal**        | geometric inside  | geometric outside |
| **reversed** (`-`)| geometric outside | geometric inside  |

A `ThrowMotionSpec` carries `reversed` (functional ends swapped), the geometric
`releaseGeometric`/`landGeometric` slots, and `reversedHandMotion` (whether the hand's
*path* is mirrored — see §7). The release slot comes from the current throw; the landing
slot comes from the throw scheduled at `beat + height` (the throw that will be made with
that same ball next), via `throwMotionSpecFromThrows`.

## 3. Siteswap parsing

`siteswap.ts → parseSiteswapWithReversal` turns a string into `ParsedThrow[]`:

- Digits `0–9` and letters `a–z` are heights (`a = 10`, …).
- A trailing `-` marks the previous throw **reversed** (e.g. `42-3` = `4`, reversed `2`, `3`).
- `period` = number of throws; `heights` = numeric heights; average ball count and
  landing-residue validity are also computed.

## 4. Timing model

- **Beat** — the siteswap clock unit; one throw happens every beat, **alternating hands**
  (`throwBeatForHand`: right on even beats, left on odd).
- **T_b** (`beatPeriodS`) — seconds per beat.
- **Dwell `D`** — beats a ball is held after a catch before the next throw
  (`twoHandThrowConfig.ts`, per-height bands; small throws use small dwell).
- **Air time** — `T_air = (n − D) · T_b` (`airTime.ts`). A ball thrown at beat `b` lands at
  beat `b + (n − D)` in the hand given by `landingHand(thrower, n)` (same hand if `n` is
  even, opposite if odd).

## 5. Scheduling: events → periodic schedule

For each hand we build a list of timed **events** (`HandEvent`): `throw` or `catch`, each
tagged with its functional side and reversal flags. A schedule (`HandMotionSchedule`) is a
list of θ **segments** over one period, plus an optional `phaseOffsetS`.

**Period (how long until everything repeats):**

- *Uniform / single-throw* (`buildHandSchedules`): `periodBeats = 2 · max(2, n)` — enough
  for both hands to complete throw→catch cycles.
- *Mixed custom* (`buildCustomPatternHandSchedules`): a period-`P` siteswap sampled every
  other beat (one hand) repeats every **`2·P / gcd(P, 2)`** beats. Using the uniform sizing
  here would mis-close the loop and create spurious extra laps — this was the original
  "double loop" bug.

**Left hand** reuses the right hand's pattern shifted by one beat
(`phaseOffsetS = T_b`) for uniform patterns; custom patterns build each hand explicitly.
The left ellipse is the mirror of the right (the `∓cos θ` in `handXyFromTheta`), so equal θ
on both hands looks symmetric.

**Catch events** are placed at the landing time of every throw that lands in this hand, and
wrapped into `[start, start + periodBeats)` with modular arithmetic so they fall inside the
loop.

## 6. The hand-trajectory algorithm (full rotations)

The guiding principle — and what makes **every** pattern look consistent — is:

> A hand always traces a **continuous full ellipse**. It releases at its throw point
> (inside for a normal throw, outside for a reversed one), travels **over the top** to the
> catch point, then **under the bottom** back to the next throw point. θ moves
> **monotonically in one direction** for runs of the same throw type; it only changes
> direction when the throw *type* changes.

There are two builders, both producing this same full-rotation motion:

### 6a. `buildSegments` — uniform cascade, reverse cascade, shower

Walks the hand's merged events and emits one segment per gap. The end angle of each
transit is chosen by `segmentEndTheta`, which **unwraps forward** (monotonically increasing
θ) to the next functional point:

- throw → catch (`toCatch`): `θ : 0 → π` (over the top to outside).
- catch → throw (`toThrow`): `θ : π → 2π` (under the bottom back to inside).

Successive laps keep accumulating (`2π → 3π → 4π …`), so the hand spins continuously rather
than swinging back and forth. (Before this was made consistent, simple patterns used a
lower-arc-only *pendulum*; now they do full rotations like everything else.) Easing
(`HAND_SPEED`) shapes acceleration into/out of each point. The **shower** low hand uses a
`windBetweenThrows` lap between its quick throws, and shower hands carry per-hand
`ThrowMotionSpec`s because the two hands throw different heights (`1` vs the high throw).

### 6b. `buildThrowTypeSegments` — mixed custom patterns (e.g. `42-3`)

Used when a hand mixes normal and reversed throws. Algorithm:

1. **Direction per throw** — normal ⇒ forward (`+`, increasing θ, throw point `0`);
   reversed ⇒ backward (`−`, decreasing θ, throw point `π`).
2. **Continuous angle at each throw boundary** (`thetaAt[]`) — between two throws of the
   **same** type, advance a full lap (`±2π`); across a **type change (reversal)**, advance a
   half turn (`±π`) so the hand ends up oriented for the opposite direction.
3. **Slow points** — a throw boundary where the upcoming interval reverses is marked
   `slow` (velocity ≈ 0): the hand decelerates, turns around, then accelerates the other
   way. Easing between keyframes is chosen from the endpoints' slow flags
   (`smooth`/`accel`/`decel`/`linear`).
4. **Catches on the way** — each catch that falls inside an interval becomes a keyframe at
   the correct geometric side. When a catch coincides with a turnaround point, an
   **overshoot apex** keyframe is inserted (`HAND_SCHEDULE.catchOvershootRad`, default 40°):
   the hand overshoots *past* the point, then crosses back **through it exactly when the
   ball lands**, continuing into the reversal. This is the "catch on the way back" behaviour.
5. Keyframes are emitted as `kf` segments (`theta0 → theta1` with the chosen easing).

The result for a run of same-type throws is identical in spirit to §6a (continuous laps);
the extra machinery only activates at normal↔reversed boundaries.

## 7. Reading the schedule at render/sim time

`hands.ts → handPosition` / `handPhaseRad` evaluate θ at an absolute time, then call
`handXyFromTheta`. Two paths:

- **`useVisualTheta`** (custom patterns): the schedule already stores the final geometric θ
  (including direction). Read it straight from `handThetaAt` — no remap.
- **`reversedHandMotion` remap** (uniform reverse, shower high hand): the schedule stores a
  *normal* forward θ, and reverse motion is produced at read time by the mirror
  **`θ → π − θ`**. Increasing forward θ becomes decreasing rendered θ, i.e. a backward full
  rotation that still catches inside / throws outside. This is why reverse patterns reuse
  the normal schedule and just flip it.

`handThetaAt` wraps the query time into one period and linearly walks the segment list,
returning the interpolated angle (segments may straddle the period boundary).

## 8. Ball ↔ hand coupling

Balls are simulated independently (`ballSimulator.ts`, `customPatternSimulator.ts`) from the
same siteswap timing, then **reconciled with hand geometry**:

- A held/dwelling ball sits at the hand's current ball slot (`insideBallSlot` /
  `outsideBallSlot` — the geometric point lifted by `ballLiftM`).
- A flight is released at the thrower's release slot and aimed at the catcher's landing slot.
- A catch is *committed* only when the hand is actually near the expected geometric point
  (`handNearOutside` / `handNearInside`, sampled around the landing time). Because the
  schedule guarantees the hand is at its inside/outside point exactly at throw/catch beats,
  the path *between* events can be any full rotation without breaking catches — which is what
  let us unify the motion safely.

## 9. Tunable constants (`twoHandThrowConfig.ts`)

| Constant | Meaning |
|----------|---------|
| `BEAT_PERIOD` | seconds per beat `T_b` (slider range/default) |
| `DWELL`, `DWELL_THROW_1`, `DWELL_THROW_2` | dwell bands per throw height |
| `HAND_POSE_THETA` | geometric inside (`0`) / outside (`π`) |
| `HAND_SPEED` | easing (linear blend + power) into/out of inside |
| `HAND_SCHEDULE.minPeriodBeatsMultiplier` / `minThrowForPeriod` | uniform period sizing |
| `HAND_SCHEDULE.catchOvershootRad` | overshoot past a reversal catch (default 40°) |
| `HAND_SCHEDULE.sameSideOvershootRad` / `sameSideOutFrac` / `sameSideHoldFrac` | same-side wiggle shape |
| `HAND_SCHEDULE.showerCatchThenThrowFrac` | shower low-hand catch→throw delay |
| `BALL_SIM.catchProbeBeats` / `catchTimeoutBeats` | catch detection window |

## 10. Worked examples

- **`3` (cascade)** — every throw normal. Each hand does one forward full rotation per
  throw: release inside → over the top → catch outside → under the bottom → next throw.
- **`3-` (reverse cascade)** — every throw reversed. Same schedule as `3`, rendered through
  `θ → π − θ`, so each hand spins the *other* way: release outside → catch inside.
- **`42-3`** — mixed. The hand with the `2-` decelerates approaching the reversal, turns
  around with a small overshoot, catches the incoming `4` on the way back, and continues into
  the next (normal) throw; runs of normal throws are ordinary forward laps.
- **`5-1` (shower)** — high hand throws reversed `5`s (backward full rotations); low hand
  makes quick `1` throws and catches the high ball, looping forward between its throws.

> Verification used during development: sampling each hand over a full period confirms every
> pattern (`3`, `3-`, `333`, `42-3`, `423`, `531`, `51`, `5-1`) traverses **both arcs**
> (full rotation), reverses direction **only** at type boundaries, and the ball simulator
> reports no drops.
