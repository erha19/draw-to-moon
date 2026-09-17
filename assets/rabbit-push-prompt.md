# Moon-rabbit animation prompts

Tool: built-in imagegen (not CLI/API fallback).

Reference: the existing rabbit-idle.svg character, rendered as a transparent reference image.

## Initial generation

Use case: illustration-story. Asset type: production transparent sprite atlas for a Chinese Mid-Autumn moon-rolling browser game.
Create ONE 1536 x 1024 PNG spritesheet, exactly THREE COLUMNS by TWO ROWS of equal 512 x 512 cells, with six animation key poses of the SAME moon rabbit. Read poses left-to-right, then second row left-to-right. No drawn grid or cell boundaries.
Reference image 1 is character identity reference only. Keep its ivory-white rabbit, pink inner ears, dark small eyes, warm gold scarf and small ochre travel bundle on its back. Refine into beautiful hand-painted Chinese storybook/gongbi illustration, fine restrained gold outlines, soft fur shading, charming determined expression. This is a usable 2D side-view game sprite, never a UI screen.
All poses FACE RIGHT. Keep the same scale, camera, full body and floor baseline y=445 within every cell, all ears, paws, tail, bundle and scarf inside the cell with clear padding. Transparent RGBA canvas, truly empty alpha outside each rabbit, NO painted checkerboard, NO white or colored backdrop, NO vignette, NO floor/shadow panel.
Pose 1: ready, slightly crouched, front paws reaching toward the right, looking at an unseen heavy moon.
Pose 2: crouches low and braces both hind feet, front paws planted against the unseen moon to the right, visibly storing strength.
Pose 3: straining push, body tilted steeply forward, ears swept back, both forepaws extending toward the right, hind feet firmly grounded.
Pose 4: maximum powerful shove, body and arms fully extended diagonally toward the right, one hind leg stretched back, closed determined eyes, scarf trailing.
Pose 5: follow-through after release, bunny leaning/stumbling forward with forepaws extended, clearly different from crouching.
Pose 6: recovered stance, happily waving one front paw at the departing moon while facing right.
Important: render ONLY the rabbit in each cell. DO NOT draw a moon, ball, rock, scene, text, numbers, logos, arrows, sparkles or props beyond its established scarf and bundle. The game separately renders the user's unique moon, so the rabbit must stand alone. Clean silhouettes that read at 100 pixels tall. Six isolated poses, exactly one rabbit per cell.

## Targeted correction

Edit target: this six-pose rabbit spritesheet. Keep the rabbit character design, rendering, gold scarf, ochre round travel bundle, face and the six storytelling poses. Change ONLY the background and cell registration.
CRITICAL: completely REMOVE all the golden glow, hazy halos, dark background and any backdrop pixels. Everything outside each rabbit silhouette must be alpha=0, genuinely fully transparent. No aura, no outer lighting, no shadow, no glow, no matte, no colored backdrop, no checkerboard drawing. Preserve clean antialiased edges. This is a game sprite atlas that will be composited onto a dark teal mountain landscape.
Output EXACTLY 1536x1024 PNG with three columns by two rows of 512x512 cells. Slightly shrink poses so every part of every rabbit is INSIDE its own cell with at least 36 pixels padding on the left and right, and at least 28 pixels above ears/below feet. Especially the full-extension pose in lower-left must NOT extend beyond x=476. Set the floor/foot baseline consistently around y=465 in each row's cells. All rabbits keep facing RIGHT, same character size, no text, no grid lines, no additional elements. The only opaque pixels belong to the rabbit, scarf and backpack.

## Integration notes

Selected output: rabbit-push-atlas.png. The generated PNG retains genuine transparency. Its six poses do not fit equal 512px grid cells perfectly; the game uses measured source rectangles, a common foot baseline and a shared paw anchor. The atlas itself is the unmodified generated output.
