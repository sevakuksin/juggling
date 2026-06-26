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

## Build

```bash
npm run build
npm run preview
```
