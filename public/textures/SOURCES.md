Textures from Poly Haven (https://polyhaven.com), CC0: free to use, no attribution required.
Re-encoded to WebP for the site.

- oak-color.webp, oak-normal.webp, oak-rough.webp: oak_veneer_01 (2K; roughness downscaled to 1K)
- mat-normal.webp, mat-rough.webp: linoleum_brown (1K), used only as surface relief on the mat

Baked by `npm run bake:textures` (scripts/bake-textures), drawn once in headless Chrome instead of on
every page load:

- wood-color.webp, wood-bump.webp: the generated black ash planks (phones only)
- mat-print.webp, mat-print-half.webp (phones), mat-bump.webp (phones): the cutting mat
- coffee.webp, plaster.webp, pegboard.webp
- room-env.webp: three's PMREM of its RoomEnvironment (the scene's environment light), stored as RGBE
  in a lossless WebP and decoded on the GPU by scene.ts
