#!/usr/bin/env python3
"""Make one self-contained HTML file out of the built workbench.

The preview server dies whenever the sandbox is reset or suspended between turns, which is not
something a script inside the sandbox can prevent. This produces the alternative: a single HTML file
with the application JavaScript, the stylesheet and every webfont inlined as a data URI, so it needs
no server, no `node_modules` and no network. It opens in the workspace file viewer (whose preview is a
sandboxed iframe with scripts allowed and no network) and in any browser tab, and it survives resets
because it is just a file in the workspace.

    python3 make-single-file.py                      # preview/ -> NIYAM_workbench.html
    python3 make-single-file.py build out.html       # other input / output

Only the standard library is used, so this also works right after a reset, when the dependencies that
produced `preview/` are gone. Rebuild the input with `bash start-preview.sh --rebuild` after editing
sources.
"""

from __future__ import annotations

import base64
import mimetypes
import pathlib
import re
import sys

# A webfont must be served as a font type or the browser refuses it; Python's table does not know the
# modern formats, so these are stated rather than guessed.
MIME = {
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.css': 'text/css',
}


def data_uri(path: pathlib.Path) -> str:
    mime = MIME.get(path.suffix) or mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode("ascii")}'


def resolve(src: pathlib.Path, ref: str) -> pathlib.Path | None:
    """`/assets/x.woff2` and `./assets/x.woff2` both mean the same file inside the build directory."""
    cleaned = ref.split('?')[0].split('#')[0].lstrip('./')
    candidate = src / cleaned
    return candidate if candidate.is_file() else None


def main() -> int:
    src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'preview').resolve()
    out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'NIYAM_workbench.html').resolve()
    index = src / 'index.html'
    if not index.is_file():
        sys.stderr.write(
            f'[single-file] no build at {src}\n'
            '              build it first: bash start-preview.sh --rebuild\n'
        )
        return 1

    html = index.read_text()
    inlined = {'css': 0, 'js': 0, 'assets': 0}

    # 1. stylesheets: inline the CSS, then the font and image URLs inside it
    def inline_css(match: re.Match[str]) -> str:
        ref = match.group('href')
        path = resolve(src, ref)
        if path is None:
            return match.group(0)
        css = path.read_text()

        def inline_url(m: re.Match[str]) -> str:
            target = resolve(src, m.group('ref'))
            if target is None:
                return m.group(0)
            inlined['assets'] += 1
            return m.group('pre') + data_uri(target) + m.group('post')

        css = re.sub(r"(?P<pre>url\(['\"]?)(?P<ref>[^'\")]+)(?P<post>['\"]?\))", inline_url, css)
        inlined['css'] += 1
        return f'<style>\n{css}\n</style>'

    html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="(?P<href>[^"]+)"[^>]*>', inline_css, html)
    html = re.sub(r'<link[^>]*href="(?P<href>[^"]+)"[^>]*rel="stylesheet"[^>]*>', inline_css, html)

    # 2. scripts: inline the bundle. A literal `</script` inside a string would end the element early,
    #    so it is escaped the way the JSON-in-HTML convention requires.
    def inline_js(match: re.Match[str]) -> str:
        ref = match.group('src')
        path = resolve(src, ref)
        if path is None:
            return match.group(0)
        code = path.read_text().replace('</script', '<\\/script')
        inlined['js'] += 1
        attrs = match.group('attrs') or ''
        return f'<script{attrs}>\n{code}\n</script>'

    html = re.sub(
        r'<script(?P<attrs>[^>]*)\ssrc="(?P<src>[^"]+)"[^>]*>\s*</script>', inline_js, html
    )

    # 3. anything else referenced by URL — the favicon, an icon in the head
    def inline_attr(match: re.Match[str]) -> str:
        path = resolve(src, match.group('ref'))
        if path is None:
            return match.group(0)
        inlined['assets'] += 1
        return f'{match.group("pre")}{data_uri(path)}{match.group("post")}'

    html = re.sub(r'(?P<pre>(?:href|src)=")(?P<ref>/(?:assets|favicon)[^"]*)(?P<post>")', inline_attr, html)

    out.write_text(html)
    left = re.findall(r'(?:href|src)="/[^"]+"', html) + re.findall(r'url\(/[^)]+\)', html)
    size = out.stat().st_size
    print(
        f'[single-file] {out.name}: {size / 1024:.0f} kB — '
        f'{inlined["js"]} script, {inlined["css"]} stylesheet, {inlined["assets"]} assets inlined'
    )
    if left:
        print(f'[single-file] still referenced externally (would need the server): {left}')
        return 1
    print('[single-file] no external references: opens with no server and no network')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
