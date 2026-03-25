# Findings

## Current Integration Points
- `src/components/earth/EarthObserver.tsx` owns provider loading, earthquake/satellite refresh, and location digest fetching.
- `src/components/earth/panels/LocationDigestPanel.tsx` renders selected-location details, layer controls, about, and highlights/landmarks.
- `src/server/locationDigest.ts` builds the current digest from reverse geocode, weather, solar info, and GDELT news.
- `src/server/locationNews.ts` currently only queries GDELT and optionally asks OpenAI for a short summary.
- `src/types/explorer.ts` contains the digest/news summary types and is the main schema expansion point.

## Architecture Constraints
- The app is a single Next.js app with no existing Redis/cache tier.
- Existing UX already has a `highlights` section, which is the cleanest place to add hotspot entry cards.
- Existing selected-location flow should be preserved so map click and landmark click continue to work.

## Implementation Notes
- Added a new `src/server/locationIntel/` service slice for Geo Hub data, RSS source definitions, XML parsing, feed fetching, hotspot aggregation, and deterministic location-intel summarization.
- Extended `LocationDigest` rather than creating a separate detail payload, so the existing `/api/location-digest` route remains the main selected-location contract.
- Added `/api/location-hotspots` for the `highlights` surface and wired hotspot state through the Zustand store.
