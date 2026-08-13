# Francis vector system

This folder contains the scalable source-of-truth artwork for Francis. The
character was reconstructed from the supplied brand-manual reference as a
layered vector so it can be edited without changing its identity.

## Assets

- `francis-master.svg`: editable, transparent, full-color master.
- `francis-small.svg`: simplified app/avatar mark for 20–47 px uses.
- `francis-one-color.svg`: single-ink version for stamps, engraving and limited
  production.
- `francis-avatar-cream.svg`: full-color avatar on the approved cream tile.
- `francis-app-icon-cobalt.svg`: app icon on the approved cobalt tile.
- `png/`: production raster exports generated from the vector masters.
- `tokens.json`: canonical palette, sizes and protected identity anchors.

## Editing rules

Import `francis-master.svg` into Figma or Illustrator. Its named groups keep the
shirt, neckerchief, head, hair, facial marks, moustache and beret separately
editable. Preserve the viewBox and the five protected identity anchors listed
in `tokens.json`.

Do not auto-trace the original screenshot again, stretch the face, mirror the
profile, change the beret angle, reduce the moustache, or recolor the
neckerchief. New poses should reuse the master head as an unchanged component.

Use the full master at 48 px and above. Use `francis-small.svg` below 48 px.
SVG is the preferred web format; PNG exports are provided for platforms that
require raster files.
