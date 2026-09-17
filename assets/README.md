# Original game artwork

All SVG artwork in this directory was created specifically for 画到月亮 through original vector paths and deterministic procedural composition. No downloaded stock assets, external fonts, or third-party illustrations are embedded. Source SVG files are the editable masters.

- `scene.svg`: 800 × 1000 classical Chinese night composition, transparent-independent whole scenic background. Deep teal sky, golden moon, curling cloud banks, mountains, tile roof and osmanthus. No interface or text.
- `moon.svg`: transparent 430 × 430 warm moon with separate editable paths for surface markings.
- `rabbit.svg`: 400 × 400 transparent flying rabbit, alias of fly pose.
- `rabbit-{idle,launch,fly,dash,miss,celebrate}.svg`: identical canvas and character construction; centered rotation anchor (200,225), distinct silhouette tilt/ear/expression combinations for each pose.

Palette: night #102e35, ivory #fff7dc, gold #d7b673, jade #66816b, blush #d9a999. SVG is resolution-independent, usable as same-origin image content for Canvas export. The runtime can animate translation/scale/rotation without requiring a raster sprite atlas. Pose names are the animation identifiers; no atlas coordinates apply.

Authorship: original project-generated vector artwork, 2026. No third-party asset license attribution required. These sources are provided with the project for editing and use.

Parallax layers are separately provided as `clouds.svg`, `mountains.svg`, `roof.svg`, `osmanthus.svg`, and `stars.svg`, each registered to the scene’s 800 × 1000 coordinates. `earth.svg` is a separate 800 × 400 transparent curved Earth illustration.

## Moon-rabbit push animation

- `rabbit-push-atlas.png`: 1536 × 1024 RGBA, created with the built-in imagegen tool on 2026-09-17, using the existing `rabbit-idle.svg` character as a visual reference. Six poses: ready, brace, strain, push, release, wave.
- `rabbit-push-prompt.md`: original generation and correction prompts. The selected PNG is copied directly from the generated output, preserving its alpha channel.
- The poses are arranged roughly in three columns and two rows, with unequal extents. `app.js` defines full source rectangles and aligns the painted feet and front paw in a 512 × 512 Canvas. Do not slice it into equal cells: the extended paws cross nominal grid boundaries.
- The image contains only the rabbit, scarf and travel bundle. The player's actual moon is rendered separately by `moon3d.js`; no generic moon is baked into these frames.
- The short effects are synthesized by `audio.js` with Web Audio, not embedded in the image or fetched from an external audio service.
