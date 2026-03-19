# Findings

- Workspace started effectively empty except for `docs/brainstorms`.
- Node.js, npm, and pnpm are installed locally.
- The workspace is not a git repository.
- The initial implementation target is a runnable skeleton, not a full product.
- Decided to manually scaffold the Next.js app in-place to avoid `create-next-app` conflicts with planning files.
- Chose a Cesium static-asset copy script instead of custom webpack plugins to keep the setup explicit.
- Installed current dependency set resolved by pnpm, including Next.js 15.5.13, Cesium 1.139.1, React 19.2.4, and OpenAI SDK 5.23.2.
- Cesium 1.139 expects `Viewer` initialization through `baseLayer` rather than the legacy `imageryProvider` option in TypeScript definitions.
- `public/cesiumStatic/Assets/Textures/NaturalEarthII` is available after postinstall and is sufficient for an offline-friendly Earth base layer.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass after the final fixes.
- Nominatim geocoding will be proxied through a server route so requests carry an explicit application user agent rather than exposing the public endpoint directly from the browser.
- The same geocoding primitive is now shared by the browser search route and the LLM tool loop, which restores agent-native parity for named-place navigation.
- Satellite data will use CelesTrak JSON OMM feeds, which can be consumed directly by `satellite.js` via `json2satrec`.
- CelesTrak OMM fields can arrive as either strings or numbers, so the server-side schema must accept both shapes to remain robust.
- NASA GIBS exposes default RESTful WMTS tiles that can be consumed without an extra capabilities parse at runtime.
- Inertial camera mode is implemented with Cesium ICRF transforms and works by locking the camera in an inertial frame while Earth rotates beneath it.
- The viewer now exposes Moon, satellite, cloud, and near-surface temperature layers through both the UI and agent tools.
