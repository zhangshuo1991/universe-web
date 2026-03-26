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

This repo uses TypeScript, React 19, and Next.js 15. Follow the existing style: 2-space indentation, semicolons, and single quotes. Use `PascalCase` for React components (`ClientEarthObserver.tsx`), `camelCase` for functions and Zustand actions, and descriptive file names grouped by feature. Prefer the `@/` import alias over long relative paths. Keep Cesium code in client components only; do not import Cesium in server-rendered modules. Do not allow any single code file to exceed 1000 lines.

## Testing Guidelines

There is no dedicated automated test suite yet. Before opening a PR, run `pnpm lint`, `pnpm typecheck`, and `pnpm build`. For UI or viewer changes, include brief manual verification notes covering the affected panel, layer, or API route.

For any implementation task, code changes are not considered complete after coding alone. After implementing, you must use `$agent-browser` to perform realistic browser-based verification against the actual app flow, inspect the result, fix any issues found, and repeat the browser test until there are no remaining problems. Only then is the task considered complete.

## Commit & Pull Request Guidelines

Recent history uses Conventional Commit prefixes with optional scopes, for example `feat(agent): ...` and `feat(solar-system): ...`. Keep the `type(scope): summary` format and write concise, imperative summaries. PRs should include a short description, linked issue if applicable, manual test steps, and screenshots or screen recordings for visible UI changes.

## Security & Configuration Tips

Copy `.env.example` when setting up local config. Keep secrets such as `OPENAI_API_KEY` out of git, and document any new environment variable in `.env.example` and the PR description.

## Design Context

### Users

面向普通公众的地球观测站。用户是对太空、地球科学和地球实时状态感兴趣的普通访客，不默认具备专业背景，也不应被复杂术语和密集控制面板劝退。他们来到这里，是为了用最低认知负担去“看看现在的地球发生了什么”，并在探索过程中自然理解卫星轨道、天气、地震、空间天气等信息。使用场景通常是桌面浏览器上的沉浸式探索，也需要兼顾移动端的基本可用性。

### Brand Personality

探索 · 智能 · 简洁

- 探索：界面应像太空望远镜的取景器，每一次交互都在揭示新发现，鼓励用户继续点、继续看、继续问。
- 智能：AI 对话和数据可视化要传递“懂你想问什么”的感觉，专业但不堆砌。
- 简洁：UI 必须简单、好用，第一次进入的人也应能立即上手，不需要先学习界面。

语调应沉稳、清晰、不卖弄，像一位知识丰富但表达通俗的天文馆解说员。

### Aesthetic Direction

视觉基调是深空科技感，但必须服务于可用性。保留纯暗色主题、玻璃态面板、微妙的光晕与网格纹理，但不能为了“酷”牺牲信息理解和操作效率。

- 当前没有固定外部参考产品。
- 所有视觉决策优先围绕“普通公众一眼能懂、第一次用就会、愿意继续探索”来判断，而不是围绕设计潮流或技术炫技。

应避免的方向：

- 过度拟物或游戏化的卡通风格
- 信息过载的传统拥挤仪表盘
- 过于极客或黑客终端风
- 把“专业感”误做成“复杂难懂”的数据后台

主题保持暗色模式，沿用现有深空背景、青绿色主强调色、琥珀金辅助高光，以及 viewer 优先的空间层级。

### Design Principles

1. 简单先于丰富。先保证普通公众立即会用，再考虑继续加信息。
2. 数据即叙事。每一项数据都应有上下文和意义，不展示孤立数字。
3. 渐进式揭示。首屏保持干净，细节在用户表达兴趣后再展开。
4. 探索欲优先。设计要自然激发“我想继续探索”的冲动。
5. 空间感优先。地球 viewer 永远是视觉焦点，面板只做辅助。
6. 默认遵循 WCAG AA 基线，并尊重 `prefers-reduced-motion`。
