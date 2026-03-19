---
date: 2026-03-19
topic: earth-observer-llm
---

# Earth Observer Brainstorm

## What We're Building
A web-based Earth observation experience where users can freely pan, zoom, click, scrub time, and ask for guided exploration in natural language. The system should show a physically grounded Earth with real rotation, axial tilt, day/night terminator, seasons, and orbit around the Sun. The LLM should not directly render graphics; it should interpret user intent, plan view changes, explain what is being shown, and trigger the same camera/time/layer actions available in the UI.

## Why This Approach
The recommended approach is a hybrid architecture:
- CesiumJS or a WebGL globe engine handles Earth rendering, camera control, time, imagery, terrain, picking, and geospatial layers.
- A deterministic simulation layer computes astronomical state from time using orbital parameters and rotation models.
- An LLM agent sits above those primitives and calls safe tools such as `set_time`, `fly_to`, `highlight_region`, `toggle_layer`, and `annotate_selection`.

This keeps the physics and graphics deterministic while still allowing free-form exploration and natural-language control.

## Approaches Considered

### Approach A: Pure Three.js custom globe
Build the globe, orbit math, picking, and interaction yourself.

Pros:
- Maximum control over look and feel
- Easier to build a highly stylized visual identity

Cons:
- You must rebuild camera controls, geospatial picking, tiling, and time systems
- Higher risk and slower path to a usable product

Best when: the product is art-first rather than geography-first.

### Approach B: Globe engine + deterministic astro core + LLM orchestration
Use CesiumJS for the globe, a small astronomy/time engine for Earth state, and an LLM as an intent layer.

Pros:
- Fastest route to a credible interactive Earth
- Clean separation between physics, rendering, and language behavior
- Matches agent-native parity well

Cons:
- Visual design is constrained by the chosen engine unless customized
- Requires careful tool design so the LLM cannot produce inconsistent state

Best when: you want a real product with both scientific grounding and open-ended interaction.

### Approach C: Full agent-native world model
Treat every map/view/layer operation as an agent-driven workflow and let the LLM compose almost everything.

Pros:
- Highly flexible and extensible
- Strong long-term agent-native architecture

Cons:
- Too much risk for v1
- Harder to guarantee physical correctness and low-latency interactions

Best when: you already have a stable deterministic viewer and want to expand into agent-driven workflows.

## Key Decisions
- Use a deterministic simulation core for astronomy: Earth motion must come from formulas, not LLM output.
- Use the LLM only for intent understanding and explanation: the model should call tools, not invent camera state or orbital math.
- Maintain action parity: every UI action available to the user must also be exposed to the LLM as a tool.
- Start with the Sun-Earth system only: add Moon, satellites, weather, and historical overlays after the base loop is stable.
- Simulate time explicitly: one authoritative simulation clock drives Earth rotation, revolution, sunlight direction, and UI labels.

## Physical Model
Minimum physically grounded model for v1:
- Earth axial tilt: approximately 23.439 degrees
- Sidereal rotation period: approximately 23h 56m 4s
- Tropical year / orbital cycle for seasons
- Elliptical orbit approximation with orbital elements
- Sun direction derived from simulation time
- Day/night terminator and seasonal subsolar latitude

Useful reference concepts:
- Newtonian gravity and Keplerian orbital elements for Earth revolution
- Rigid body rotation for Earth spin
- Celestial coordinate transforms: ECI/ECEF and lat/lon conversions
- Solar declination and hour angle for illumination

## LLM Role
The LLM should support requests like:
- "带我看今天白天和黑夜的分界线"
- "跳到上海，并解释为什么现在太阳高度这么低"
- "播放从春分到夏至的季节变化"
- "比较北京和悉尼此刻的昼夜情况"

The LLM tools should be atomic:
- `fly_to(lat, lon, altitude, heading, pitch)`
- `set_time(iso)`
- `play_time(speed)`
- `pause_time()`
- `toggle_layer(layer_id, visible)`
- `pick_location(screen_x, screen_y)` or `select_entity(id)`
- `add_annotation(text, target)`
- `compare_locations(a, b)`
- `complete_task(result)`

## Recommended Stack
- Frontend: Next.js + TypeScript
- Globe: CesiumJS
- State: Zustand or Redux Toolkit
- Time/physics: small dedicated astronomy module in TypeScript
- LLM orchestration: server route exposing tool-calling loop
- Optional data sources: NASA Blue Marble, Cesium World Terrain, cloud/weather overlays

## Open Questions
- Is the first release Earth-only, or must Moon and satellites also be visible?
- Should "自由点击" mean geographic picking only, or also semantic object picking and storytelling?
- Is the product closer to scientific visualization, education, or cinematic exploration?

## Next Steps
1. Scaffold a Cesium-based viewer with a single authoritative simulation clock.
2. Implement deterministic Earth rotation, tilt, and Sun illumination.
3. Add click picking and camera primitives.
4. Add an LLM tool layer that can call the same primitives as the UI.
5. Add guided scenarios such as solstice/equinox playback and city-to-city daylight comparison.
