# Task Plan

## Goal
Implement the location-intel enhancement for `universe-web` using original code in this repo only, inspired by feature ideas and data-source types from `worldmonitor/`.

## Phases
- [completed] Ground current integration points and create working notes
- [completed] Build server-side location intel services and hotspot endpoint
- [completed] Integrate state and fetching into the viewer
- [completed] Upgrade location and highlights UI
- [completed] Validate with lint, typecheck, build, and browser flow

## Key Decisions
- Keep Next.js App Router and existing API shape
- Extend existing location digest instead of introducing a parallel detail model
- Use deterministic aggregation with optional OpenAI polishing
- Start with in-process caching only; no Redis or cron jobs

## Errors Encountered
- None yet
