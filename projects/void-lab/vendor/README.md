# Vendored runtime dependencies

- `rapier.js`: unmodified `rapier.mjs` from `@dimforge/rapier3d-compat` **0.21.0**, renamed to `.js` for reliable JavaScript MIME delivery on static servers. Includes its WebAssembly payload. [Upstream package](https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.21.0.tgz), [repository](https://github.com/dimforge/rapier.js), Apache-2.0, see `RAPIER-LICENSE`.
- `three.module.js`, `three.core.js`: unmodified ES modules from `three` **0.187.0**. [Upstream package](https://registry.npmjs.org/three/-/three-0.187.0.tgz), [repository](https://github.com/mrdoob/three.js), MIT, see `THREE-LICENSE`.

Both package archives were checked against their registry SHA-512 integrity before extraction. These pinned local files require no runtime CDN imports or build step. Three's package at this version supplies the unminified module/core builds used here.
