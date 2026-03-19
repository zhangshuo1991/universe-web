# Task Plan

## Goal
Ship a Next.js + TypeScript + Cesium-based Earth observer with deterministic Earth rotation/revolution, free geocode search, inertial camera mode, Moon/satellite/weather layers, and an LLM-ready control surface.

## Phases
- [x] Phase 1: Inspect workspace and runtime constraints
- [x] Phase 2: Create project scaffolding and package metadata
- [x] Phase 3: Implement app shell, globe viewer, and simulation modules
- [x] Phase 4: Add LLM tool skeleton and shared state primitives
- [x] Phase 5: Add geocoding, inertial camera mode, Moon/satellite/weather overlays
- [x] Phase 6: Verify build/test status and document outcomes

## Decisions
- Use `pnpm` as the package manager because it is available locally and fits a fresh project.
- Build an App Router Next.js skeleton with client-only Cesium viewer mounting.
- Keep astronomy deterministic and separate from UI/LLM logic.
- Proxy Nominatim server-side and reuse that geocoder from both the browser route and the agent tool loop.
- Use Cesium ICRF transforms for inertial camera mode rather than faking Earth spin in UI code.
- Use CelesTrak OMM JSON plus `satellite.js` propagation for orbital objects.
- Use NASA GIBS WMTS tile layers for weather overlays.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Parallel write/read race when creating plan files | 1 | Re-created planning files sequentially |
| `create-next-app` conflicted with planning files in repo root | 1 | Switched to manual in-place scaffolding |
| Cesium `Viewer` constructor rejected `imageryProvider` in v1.139 | 1 | Switched to `baseLayer: ImageryLayer.fromProviderAsync(...)` |
| ESLint scanned copied Cesium assets under `public/cesiumStatic` | 1 | Added ignores in `eslint.config.mjs` |
| `satellite.js` OMM typings were stricter than the raw CelesTrak payload | 1 | Normalized the OMM schema and filled `EPHEMERIS_TYPE` defaults before `json2satrec` |
| Next-generated `next-env.d.ts` tripped ESLint's triple-slash rule | 1 | Ignored the generated file in `eslint.config.mjs` |
| UI geocode search existed without agent parity | 1 | Added a shared geocoder utility and a `search_place` agent tool |
