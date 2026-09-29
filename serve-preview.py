#!/usr/bin/env python3
"""Serve the built NIYAM workbench for the live preview.

Why this exists: the sandbox the workspace runs in is reset between turns, which kills background
processes and wipes `node_modules`. A Vite dev server therefore has to win a race every time —
restore 100+ packages over the network, then keep a node process alive — and the preview ends up
blank when it is looked at. This server needs nothing but the Python that is already in the image
and the static build in `preview/`, so it starts in well under a second and cannot fail on the
network.

    python3 serve-preview.py            # http://0.0.0.0:5173 from ./preview
    python3 serve-preview.py 8080 dir   # or another port / directory

It is a preview of the built application, not a development server: there is no hot reload. Edit
sources, rebuild with `npx vite build --outDir preview --emptyOutDir`, and refresh.
"""

from __future__ import annotations

import functools
import pathlib
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Browsers refuse a webfont whose MIME type is not a font type, and Python's table does not know the
# modern formats — the app ships Inter and JetBrains Mono as woff2, so these matter.
EXTRA_TYPES = {
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
}


class PreviewHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **EXTRA_TYPES}

    def end_headers(self) -> None:
        # The build is replaced wholesale, so a cached copy must never win: always revalidate.
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        # The preview is framed by the workspace UI; nothing here needs to opt out of that.
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stdout.write('[preview] %s\n' % (fmt % args))
        sys.stdout.flush()


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    directory = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'preview').resolve()

    if not (directory / 'index.html').is_file():
        sys.stderr.write(
            f'[preview] no build at {directory}\n'
            '          build it first: npm ci && npx vite build --outDir preview --emptyOutDir\n'
        )
        return 1

    handler = functools.partial(PreviewHandler, directory=str(directory))
    with ThreadingHTTPServer(('0.0.0.0', port), handler) as httpd:
        sys.stdout.write(f'[preview] serving {directory} on http://0.0.0.0:{port}\n')
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
