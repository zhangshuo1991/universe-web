# Repository Guidelines

## Project Structure & Module Organization

`src/app` contains the Next.js App Router entrypoints and API routes such as `src/app/api/agent/route.ts`. `src/components` holds the UI, with Earth viewer code under `src/components/earth`, including `layers/` and `panels/`. Put server-only data access in `src/server`, agent orchestration in `src/agent`, astronomical math in `src/simulation`, shared state in `src/store`, and shared types in `src/types`. Static Cesium assets are copied into `public/cesiumStatic`; the helper script lives in `scripts/copy-cesium-assets.mjs`.

## Build, Test, and Development Commands

Use `pnpm` for all local work:

- `pnpm install` installs dependencies and runs the Cesium asset copy step.
- `pnpm dev` starts the local app on `localhost:3000`.
- `pnpm build` creates a production build and catches route/runtime issues.
- `pnpm start` serves the production build locally.
- `pnpm lint` runs ESLint with the Next.js flat config.
- `pnpm typecheck` runs `tsc --noEmit`.

If Cesium assets are missing, rerun `pnpm install` or `node scripts/copy-cesium-assets.mjs`.

## Coding Style & Naming Conventions

This repo uses TypeScript, React 19, and Next.js 15. Follow the existing style: 2-space indentation, semicolons, and single quotes. Use `PascalCase` for React components (`ClientEarthObserver.tsx`), `camelCase` for functions and Zustand actions, and descriptive file names grouped by feature. Prefer the `@/` import alias over long relative paths. Keep Cesium code in client components only; do not import Cesium in server-rendered modules.

## Testing Guidelines

There is no dedicated automated test suite yet. Before opening a PR, run `pnpm lint`, `pnpm typecheck`, and `pnpm build`. For UI or viewer changes, include brief manual verification notes covering the affected panel, layer, or API route.

For any implementation task, code changes are not considered complete after coding alone. After implementing, you must use `$agent-browser` to perform realistic browser-based verification against the actual app flow, inspect the result, fix any issues found, and repeat the browser test until there are no remaining problems. Only then is the task considered complete.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes with optional scopes, for example `feat(agent): ...` and `feat(solar-system): ...`. Keep the `type(scope): summary` format and write concise, imperative summaries. PRs should include a short description, linked issue if applicable, manual test steps, and screenshots or screen recordings for visible UI changes.

## Security & Configuration Tips

Copy `.env.example` when setting up local config. Keep secrets such as `OPENAI_API_KEY` out of git, and document any new environment variable in `.env.example` and the PR description.
