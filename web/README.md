# Juggling Physics — Web Demo

Interactive juggling physics demos (React + Canvas), companion to `juggling_0.ipynb`.

## Run locally

```bash
cd web
npm install
npm run dev
```

Open the URL shown (typically http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

Static output goes to `dist/`.

## Demos

1. **Vertical throw** — time of flight ↔ launch energy (linked sliders, smooth play/scrub)
2. **Two hands** — elliptical hand motion, throw numbers 0–13, pending throw applied at catch
3. **Pattern juggling** — placeholder
4. **Pattern validator** — siteswap validity with landing-graph visualization

## Stack

- Vite + React + TypeScript
- Canvas 2D rendering
- KaTeX for live formulas

Physics logic lives in `src/physics/` and mirrors the notebook.
