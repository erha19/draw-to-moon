# Original game artwork

All SVG artwork in this directory was created specifically for 画到月亮 through original vector paths and deterministic procedural composition. No downloaded stock assets, external fonts, or third-party illustrations are embedded. Source SVG files are the editable masters.

- `scene.svg`: 800 × 1000 classical Chinese night composition, transparent-independent whole scenic background. Deep teal sky, golden moon, curling cloud banks, mountains, tile roof and osmanthus. No interface or text.
- `moon.svg`: transparent 430 × 430 warm moon with separate editable paths for surface markings.
- `rabbit.svg`: 400 × 400 transparent flying rabbit, alias of fly pose.
- `rabbit-{idle,launch,fly,dash,miss,celebrate}.svg`: identical canvas and character construction; centered rotation anchor (200,225), distinct silhouette tilt/ear/expression combinations for each pose.

Palette: night #102e35, ivory #fff7dc, gold #d7b673, jade #66816b, blush #d9a999. SVG is resolution-independent, usable as same-origin image content for Canvas export. The runtime can animate translation/scale/rotation without requiring a raster sprite atlas. Pose names are the animation identifiers; no atlas coordinates apply.

Authorship: original project-generated vector artwork, 2026. No third-party asset license attribution required. These sources are provided with the project for editing and use.

Parallax layers are separately provided as `clouds.svg`, `mountains.svg`, `roof.svg`, `osmanthus.svg`, and `stars.svg`, each registered to the scene’s 800 × 1000 coordinates. `earth.svg` is a separate 800 × 400 transparent curved Earth illustration.
