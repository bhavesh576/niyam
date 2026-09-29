#!/usr/bin/env bash
# Start the NIYAM preview.
#
# The sandbox this runs in is reset between turns: background processes are killed and node_modules
# (a generated directory, not part of the saved workspace) is wiped, while src/**, the stylesheet,
# preview/** and backups/** survive. A Vite dev server has to restore ~114 packages over the network
# and then keep a node process alive, which is why the preview kept showing up blank.
#
# So the default here serves the *built* application with the Python that is already in the image:
# no node_modules, no network, up in under a second. Use --dev only when hot reload is wanted.
#
#   bash start-preview.sh              # static build from preview/ on 0.0.0.0:5173
#   bash start-preview.sh --rebuild    # rebuild preview/ from src/ first, then serve it
#   bash start-preview.sh --dev        # Vite dev server with HMR (restores dependencies if needed)
#   PORT=8080 bash start-preview.sh    # another port
#
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-5173}"
MODE="static"
case "${1:-}" in
  --dev) MODE="dev" ;;
  --rebuild) MODE="rebuild" ;;
  '') ;;
  *) echo "unknown option: $1 (use --dev or --rebuild)" >&2; exit 2 ;;
esac

have_deps() { [ -d node_modules ] && [ -n "$(ls -A node_modules 2>/dev/null)" ]; }

restore_deps() {
  echo "[preview] node_modules missing — restoring dependencies with npm ci"
  npm ci --no-audit --no-fund
}

if [ "$MODE" = "dev" ]; then
  have_deps || restore_deps
  echo "[preview] Vite dev server with HMR on 0.0.0.0:$PORT"
  exec npm run dev -- --host 0.0.0.0 --port "$PORT"
fi

if [ "$MODE" = "rebuild" ] || [ ! -f preview/index.html ]; then
  have_deps || restore_deps
  echo "[preview] building src/ into preview/"
  npx vite build --outDir preview --emptyOutDir
fi

echo "[preview] serving the built application from preview/ — python3 only, no node_modules needed"
exec python3 serve-preview.py "$PORT" preview
