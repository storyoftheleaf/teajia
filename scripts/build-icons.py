#!/usr/bin/env python3
"""Build every Teajia icon from the one emblem.

The emblem lives in public/logos/emblem.svg (the same drawing as
src/components/Logos/LogoEmblem.tsx). This script places it, in the shop
gold, on the dark tea-ground tile and writes the browser, phone, app and
connector icons into public/:

  favicon.svg            the browser tab (thickened lines so it reads at 16 px)
  favicon.ico            16, 32 and 48 px, for browsers and favicon lookups
  favicon-16x16.png      linked from index.html
  favicon-32x32.png      linked from index.html
  apple-touch-icon.png   180 px, square (iOS rounds the corners itself)
  icon-192.png           web app manifest
  icon-512.png           web app manifest, MCP serverInfo, schema.org logo
  icon-maskable-512.png  web app manifest, emblem inside the maskable safe zone

Run from the repo root:  python3 scripts/build-icons.py
Needs cairosvg and Pillow (pip install cairosvg pillow).
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path

try:
    import cairosvg
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit('Needs cairosvg and Pillow: python3 -m pip install cairosvg pillow')

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
EMBLEM = PUBLIC / 'logos' / 'emblem.svg'

TILE = '#22201c'      # --tea-bg (dark)
GOLD = '#a8874d'      # --tea-gold
GOLD_LT = '#bfa06a'   # --tea-gold-lt, used where lines are thin on screen

# The emblem's own drawing box (viewBox) and the outer star's bounds inside it.
# Centring on the star, not the viewBox, puts the emblem in the middle of the
# tile: the viewBox has a little more room on its right and bottom edges.
STAR_MIN_X, STAR_MAX_X = 33.34, 1907.27
STAR_MIN_Y, STAR_MAX_Y = 23.08, 1897.03
STAR_W = STAR_MAX_X - STAR_MIN_X
STAR_CX = (STAR_MIN_X + STAR_MAX_X) / 2
STAR_CY = (STAR_MIN_Y + STAR_MAX_Y) / 2


def emblem_shapes() -> str:
    """The emblem's path and centre dot, without their colour."""
    svg = EMBLEM.read_text(encoding='utf-8')
    path = re.search(r'<path[^>]*\sd="([^"]+)"', svg)
    circle = re.search(r'<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"', svg)
    if not path or not circle:
        sys.exit(f'Could not read the emblem from {EMBLEM}')
    cx, cy, r = circle.groups()
    return f'<path d="{path.group(1)}"/><circle cx="{cx}" cy="{cy}" r="{r}"/>'


def tile_svg(
    size: int,
    *,
    fill: float,
    radius: float,
    gold: str = GOLD,
    line_px: float = 0.0,
) -> str:
    """One icon as SVG.

    size     the side of the square, in px
    fill     how much of the side the emblem's star spans (0.6 to 0.9)
    radius   tile corner radius as a share of the side (0 = square, full bleed)
    line_px  extra line weight in screen px at this size, so thin lines hold
    """
    scale = size * fill / STAR_W
    tx = size / 2 - STAR_CX * scale
    ty = size / 2 - STAR_CY * scale
    stroke = ''
    if line_px > 0:
        # A stroke grows each line by half its width on both sides.
        width = line_px / scale
        stroke = f' stroke="{gold}" stroke-width="{width:.2f}" stroke-linejoin="miter" stroke-miterlimit="2"'
    rx = size * radius
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">'
        f'<rect width="{size}" height="{size}" rx="{rx:.2f}" fill="{TILE}"/>'
        f'<g transform="translate({tx:.3f} {ty:.3f}) scale({scale:.6f})" fill="{gold}"{stroke}>'
        f'{emblem_shapes()}'
        f'</g></svg>'
    )


def png(svg: str, size: int) -> Image.Image:
    data = cairosvg.svg2png(bytestring=svg.encode('utf-8'), output_width=size, output_height=size)
    return Image.open(io.BytesIO(data)).convert('RGBA')


# Small sizes get a brighter gold and heavier lines; large ones keep the
# drawing as it is.
SMALL = dict(radius=0.15, gold=GOLD_LT)
SMALL_FILL = {16: 0.96, 32: 0.94, 48: 0.92}
SMALL_LINES = {16: 0.4, 32: 0.7, 48: 0.8}


def favicon(size: int) -> Image.Image:
    return png(tile_svg(size, fill=SMALL_FILL[size], line_px=SMALL_LINES[size], **SMALL), size)


def main() -> None:
    # Browser tab: drawn at 32 so its line weight suits the 16 to 32 px a tab uses.
    (PUBLIC / 'favicon.svg').write_text(
        tile_svg(32, fill=SMALL_FILL[32], line_px=SMALL_LINES[32], **SMALL) + '\n', encoding='utf-8'
    )

    icons = {size: favicon(size) for size in (16, 32, 48)}
    icons[16].save(PUBLIC / 'favicon-16x16.png', optimize=True)
    icons[32].save(PUBLIC / 'favicon-32x32.png', optimize=True)
    icons[48].save(
        PUBLIC / 'favicon.ico',
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[icons[16], icons[32]],
    )

    # iOS draws its own rounded corners, and shows black through any
    # transparency, so the touch icon is a full square.
    png(tile_svg(180, fill=0.78, radius=0, line_px=0.6), 180).convert('RGB').save(
        PUBLIC / 'apple-touch-icon.png', optimize=True
    )

    png(tile_svg(192, fill=0.78, radius=0.18, line_px=0.5), 192).save(PUBLIC / 'icon-192.png', optimize=True)
    png(tile_svg(512, fill=0.78, radius=0.18), 512).save(PUBLIC / 'icon-512.png', optimize=True)
    # Maskable: the launcher may crop to a circle of 80% of the side, so the
    # star (which reaches its own corners) stays inside 64% of the side.
    png(tile_svg(512, fill=0.62, radius=0), 512).convert('RGB').save(
        PUBLIC / 'icon-maskable-512.png', optimize=True
    )
    print('Wrote favicon.svg, favicon.ico, favicon-16x16.png, favicon-32x32.png, '
          'apple-touch-icon.png, icon-192.png, icon-512.png, icon-maskable-512.png')


if __name__ == '__main__':
    main()
