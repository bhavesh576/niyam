# Deploying this prototype on Render (static site)

`npm run build` writes the whole application to `dist/`: HTML, CSS, JS and the self-hosted fonts.
There is no server, no API, no database and no environment variable — Render only serves files.

1. Push this repository to GitHub.
2. Render → **New +** → **Blueprint** → connect the repository: `render.yaml` carries the build
   command (`npm ci && npm run build`), the publish directory (`dist`), the rewrite and the header.
   Or **New +** → **Static Site** → connect the repository and type those same two values.
3. Deploy. The site is served over HTTPS at the `*.onrender.com` address Render assigns.

`public/_redirects` is the same rewrite for hosts that read that file. Building needs Node ≥ 20.19
(`.nvmrc`, `engines`); `NIYAM_workbench.html` is the same app as one self-contained file.

Prototype evaluation record — it does not issue legal certificates.
