# Juggling

Interactive juggling physics & siteswap visualizer, built with React + Vite.

**Live site:** https://sevakuksin.github.io/juggling/

The product lives in [`view-vite/`](view-vite/). Everything else from earlier
experiments (notebooks, the old `web/` prototype, Python scripts) is kept in
[`archive/`](archive/) and is not part of the build — it can be deleted or
revived later.

## Develop

```bash
cd view-vite
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
cd view-vite
npm run build    # outputs view-vite/dist
npm run preview  # serve the production build locally
```

## Deployment (GitHub Pages)

Pushing to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds `view-vite` and publishes `view-vite/dist` to GitHub Pages.

One-time setup: in the repository, go to **Settings → Pages → Build and
deployment → Source** and select **GitHub Actions**.

Notes:
- Vite `base` is set to `/juggling/` in production (project page path).
- The router uses `import.meta.env.BASE_URL` as its basename.
- The workflow copies `index.html` to `404.html` so client-side deep links
  resolve on refresh.

## Repo layout

```
.
├── view-vite/   # the app (React + Vite)
├── archive/     # old prototypes/notebooks — not built or deployed
└── .github/     # Pages deploy workflow
```
