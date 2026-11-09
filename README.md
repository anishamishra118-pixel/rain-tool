# Rain Drops

Generative particle studies of a raindrop's life: freezing, falling, under pressure, untouched, thawing, splitting, and reaching land. They were made as part of Anisha Mishra's MFA thesis at MICA, which treats rain as both phenomenon and being.

Every piece is a self-contained page with live controls, PNG export (transparent background) and video recording. Each piece exists twice:

- **`originals/`** — the original standalone HTML tools, written in plain JavaScript and canvas.
- **`p5/`** — the same pieces recreated in [p5.js](https://p5js.org) (v1.11.1, instance mode), one folder per piece.

## The pieces

| Piece | Original | p5.js | What it shows |
|---|---|---|---|
| Snow drop | `originals/snow-drop.html` | `p5/snow-drop/` | Snowflake arms grow out from the ring while crystals grow inward to an irregular hollow, frost spreading from top to bottom. Tilt-blur controls. |
| Sleet drop | `originals/sleet-drop.html` | `p5/sleet-drop/` | A melted drop refreezing from the outside in: an ice shell thickens, the liquid core shrinks, spikes and bulges push out, hairline cracks appear. |
| Land drop | `originals/land-drop.html` | `p5/land-drop/` | The drop hitting the ground, seen from above: flattening, splash crown and satellite droplets, spray, a soak-in stain with a coffee-ring rim, petrichor specks. |
| Frozen living drop | `originals/frozen-living-drop.html` | `p5/frozen-living-drop/` | A solid drop of ~650,000 particles that keeps moving. Crisp edges stay crisp; soft edges creep and swell. |
| Pressure drop | `originals/pressure-drop.html` | `p5/pressure-drop/` | *Raindrop under pressure and resistance.* A jellyfish-like ring; a pressure cycle drives one wall in until it stretches into a distorted U, holds trembling, then eases back. |
| Untouched drop | `originals/untouched-drop.html` | `p5/untouched-drop/` | *Raindrop, untouched by air pressure or resistance.* A barely breathing ring with loose edges dissolving into a grey particle haze. |
| Thaw drop | `originals/thaw-drop.html` | `p5/thaw-drop/` | One slider carries the drama: **Frozen → Thaw → Split**. The frozen drop empties into the untouched ring; past Thaw, tension builds until the ring cracks into ~1,600 ricocheting marbles. |

## Running them

**Originals:** double-click any file in `originals/` and it opens in your browser. Nothing to install.

**p5.js versions:** these load p5.js from a CDN and share two small files in `p5/lib/`, so open them through a local web server:

```bash
cd rain-drops
python3 -m http.server 8000
# then open http://localhost:8000
```

Or publish the repo with GitHub Pages (Settings → Pages → deploy from the main branch). The `index.html` at the root links to everything.

Use Chrome for the heavier particle pieces and for video recording (Safari records .mp4, Chrome records .webm; transparent video works in Chrome only).

## Controls (all pieces)

- **Sliders:** every slider updates live; the comments in each `sketch.js` explain what they do.
- **Save PNG:** black particles on a transparent background, at the canvas's full resolution.
- **Record:** saves a video. Choose the background (white, grey or transparent) from the menu next to it. In the snow, sleet and land drops, recording restarts the growth and stops by itself when it finishes; elsewhere, click again to stop.
- **H:** hides and shows all controls.
- **Thaw drop easter egg:** once the slider is at Thaw, slice quickly across the ring with the cursor to split it open yourself. It heals after a few seconds.

## Tuning

Constants near the top of each `sketch.js` (and each original) adjust what the sliders don't, for example:

- `p5/thaw-drop/sketch.js`: `BULGE` (size of the frozen drop's soft bulges), `REACH` (how far its powder drifts), `SPLIT_AT` (where the tension snaps), `MARBLES`, `RMAX`, `FUSE` (set `true` to let colliding marbles merge).
- `p5/pressure-drop/sketch.js`: `PUSH` (how far the wall is driven in), `CYCLE` (length of a pressure cycle), `FLOOR` (how much pinch it keeps at rest).
- `p5/frozen-living-drop/sketch.js`: `INK` (higher = more solid black, lower = more grain).

## How it works

The particle pieces don't draw particles one by one with p5's `point()`, which would be far too slow at this count. Each particle adds a little ink into a buffer, and the buffer is written into p5's `pixels` once per frame: black, with transparency set by density. Grey tones come from many faint particles overlapping; nothing is blurred. The shared code lives in `p5/lib/kit.js` (controls, export, the ink buffer, the tiny-sphere dots) and `p5/lib/growth.js` (the shared engine for the snow, sleet and land pieces, including the tilt blur).
