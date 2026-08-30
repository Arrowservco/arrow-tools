# The Storage Units — Design & Implementation Plan

A walkthrough-only liminal-space exploration game. Same emotional grammar as the yellow
Backrooms — endless wrong architecture, buzzing lights, no way out — but the setting is an
indoor climate-controlled self-storage facility instead of an office floor.

**Status:** plan only. No code written yet.

---

## 1. Concept

You are inside a self-storage facility that does not end. Corridors of roll-up doors run
past the point where the building's exterior should be. Aisle signs count up past numbers
the facility could not contain. Motion-sensor lights wake a section ahead of you and drop
the section behind you back into black. You can walk. That is all you can do.

There is no monster. There is no chase. The horror is entirely spatial: scale that does not
resolve, repetition that is almost but not quite identical, and a light system that
guarantees you can never see where you came from.

**One-line pitch:** *You took the wrong turn out of unit B-214. There is no right turn.*

---

## 2. Design pillars

1. **Walk, look, listen — nothing else.** No inventory, no combat, no stamina bar, no HUD.
2. **The building is the antagonist.** Threat comes from architecture and light, never from
   an entity.
3. **Familiar, then wrong.** Every space reads as a real storage facility for about eight
   seconds before something is off.
4. **You are never lost on purpose.** The maze is always solvable forward; it is only
   unsolvable backward.

### Explicit non-goals

These are cut on purpose. Adding any of them changes the genre:

- No enemies, entities, jump-scares, or death states
- No combat, weapons, or health
- No puzzles with fail states, no keys, no locked-door fetch quests
- No multiplayer
- No sprint-based chase sequences
- No timers

The only "loss" condition is your own patience, and the game respects that by keeping runs
to 20–35 minutes.

---

## 3. Art direction

### 3.1 Translating the reference

| Yellow Backrooms | The Storage Units |
| --- | --- |
| Mono-yellow patterned wallpaper | Corrugated roll-up doors, uniform tan/orange-oxide, one door every 3 m |
| Damp beige office carpet | Sealed grey concrete, epoxy-coated, with taped aisle lines and scuff arcs at every door |
| Drop ceiling with acoustic tiles | Open plenum: partition walls stop at 3.6 m, capped with wire-mesh security cage; ceiling deck and ductwork visible above |
| Continuous humming fluorescents | Motion-sensor LED strips, dark by default, snapping on in banks as you approach |
| Random empty rooms | Occasional open bay: an unrented unit, door up, unit light on, nothing inside but a swept floor |
| Wall outlets, exit signs | Aisle placards (`A-100 – A-148`), unit number plates, red EXIT signs over doorways that lead to more corridor, fire extinguisher cabinets, security-camera domes |
| Yellow-green cast | Cool sodium-tinged white (`#e8ead9`) from the LEDs against warm-grey concrete; the only saturated colors are the doors and the EXIT signs |

### 3.2 Palette

```
Concrete floor      #6f6f6a      sealed, semi-gloss, subtle specular streaks
Partition steel     #b9b5a8      painted corrugated panel
Roll-up door        #c2733a      oxidized orange; ~1 in 30 is repainted #8a8f93 grey
Door track / handle #4a4844
Ceiling cage        #3d3d3a      wire mesh, high-frequency normal, casts grid shadows
Deck / duct         #2a2a28      barely lit, reads as void above the cage
LED strip           #e8ead9      4000K, slightly green in the falloff
EXIT sign           #d3372c      the only pure red in the game
Emergency floor     #7c1d17      dim red wash in the "power-out" sections
```

### 3.3 Signature visual moments

Each is a set piece the generator is allowed to place at most once per zone.

- **The cage ceiling** — looking up, the wire mesh runs unbroken to the vanishing point in
  both directions.
- **Light rollover** — standing still at a sector boundary, watching the bank behind you
  time out and drop, one row at a time, toward you.
- **The wide bay** — a corridor opens into an oversized drive-in bay with 12 m ceilings and
  a single working light in the middle.
- **The mezzanine** — a metal stair up to an identical floor plan, one level higher, where
  the stair down is not where you left it.
- **Non-Euclidean loop** — a four-left-turn circuit that returns you to a corridor you have
  not been in.

### 3.4 Legal / branding note

Do **not** use Guardian Storage's name, logo, color scheme, sign typography, or any real
facility's branding. Reference the *category*, not the company. Use an invented in-fiction
operator throughout — proposed: **SENTINEL SELF STORAGE** — on placards, decals, and the
loading screen. Same applies to the audio: no recognizable licensed music, ambience is
generated or from a permissive-license library with attribution recorded in
`docs/asset-credits.md`.

---

## 4. Zones (progression)

Five zones, walked in order. Transition is always a doorway you cannot walk back through —
the corridor behind reconfigures while you are past the threshold. No loading screens;
transitions happen behind a doorway blind.

| # | Zone | Length | The turn |
| --- | --- | --- | --- |
| 0 | **The Aisle** | 3–5 min | Ordinary. Lights work. Signage is consistent. Teaches walking, looking, and that doors do not open. |
| 1 | **The Long Run** | 5–8 min | Corridors stop having intersections. One aisle, straight, for far longer than a building allows. Unit numbers keep climbing. |
| 2 | **Climate Control** | 6–9 min | Carpeted, warmer, quieter — the "nice" wing. HVAC roar. Corridors branch fractally; the maze is real here. |
| 3 | **Sublevel** | 6–9 min | Freight elevator down. Half the lights are dead; emergency red only. Water on the floor. Some units stand open and empty. |
| 4 | **The Office** | 3–5 min | A rental office with a counter, a chair, a monitor showing a facility map that does not match anything you walked. The exit door opens onto Zone 0. |

Zone 4 → Zone 0 is the ending: the loop closes and the run is marked complete. A completed
run unlocks free-roam ("Night Audit") — a single seeded endless maze with no zone
progression, for players who want the pure walking.

---

## 5. Technical architecture

### 5.1 Stack decision

Build it **in this repository** as a self-contained route, not a separate app.

- **Runtime:** Next.js 16 App Router, route `src/app/storage-units/`, with its own
  `layout.tsx` that opts out of the BidLens shell (no `BottomNav`, no `max-w-3xl`
  container, full-bleed `100dvh` canvas).
- **Renderer:** `three` + `@react-three/fiber` + `@react-three/drei`. R3F because the repo
  is already React 19 and the team knows JSX; drei for `PointerLockControls`,
  `useGLTF`, `Instances`, and `AdaptiveDpr`.
- **Physics:** none. Hand-rolled 2D AABB collision against the maze grid — the world is a
  grid of axis-aligned boxes, so a physics engine is pure overhead. ~120 lines.
- **Client-only:** the whole scene is `"use client"` behind a `next/dynamic` import with
  `ssr: false`. Zero impact on BidLens bundle size — verify with
  `npx next build --analyze` that the `/` route's first-load JS does not move.

**Rejected alternatives:** Unity/Godot WebGL (30–60 MB payload, no reuse of the existing
deploy pipeline); a separate repo (splits CI and Netlify config for no benefit); raw
three.js without R3F (loses declarative composition and drei's controls).

### 5.2 File layout

```
src/app/storage-units/
  layout.tsx                 full-bleed layout, no BidLens chrome
  page.tsx                   title screen -> dynamic import of <Game />
src/features/storage-units/
  Game.tsx                   <Canvas>, zone state machine, pause overlay
  world/
    grid.ts                  MazeGrid type, cell encoding, coordinate helpers
    generate.ts              per-zone generators (see 6)
    chunk.ts                 chunk build: grid cells -> instanced transforms
    props.ts                 placard/extinguisher/camera/sign placement rules
    zones.ts                 the five zone configs as data
  render/
    Corridor.tsx             instanced walls, doors, floor, ceiling cage
    LightGrid.tsx            sector light state + the sensor logic (see 8)
    Props.tsx                instanced small props
    PostFX.tsx               vignette, film grain, optional VHS mode
  player/
    useController.ts         input -> velocity, head-bob, footstep events
    useCollision.ts          AABB sweep against the grid
  audio/
    engine.ts                Web Audio graph: ambience bed, footsteps, light clicks
    materials.ts             surface -> footstep sample map
  state/
    store.ts                 zustand: zone, seed, settings, run progress
    persist.ts               localStorage save (seed + zone + settings)
public/storage-units/
  models/  textures/  audio/
```

### 5.3 Dependencies to add

`three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`,
`zustand`, `simplex-noise`. Nothing else. Keep them out of the root layout's import graph.

---

## 6. Maze generation

### 6.1 Representation

A `MazeGrid` is a `Uint8Array` over a 2D cell grid. Cell size **4 m**; corridor width
**3.2 m** with 0.4 m of wall thickness on each side. Ceiling height **3.6 m** (cage top),
deck at 5.2 m. Each cell packs:

```
bit 0-3   wall present N/E/S/W
bit 4-5   floor material (concrete | carpet | wet concrete | drain)
bit 6     is set-piece cell (generator will not overwrite)
bit 7     is lit-sector seed
```

Doors are not cells — they are decorations placed on any wall face that borders a walkable
cell, at 3.0 m pitch, skipping faces that carry a placard or extinguisher.

### 6.2 Per-zone algorithms

- **Zone 0 (The Aisle):** hand-authored 40×24 grid loaded from JSON. Authored so the
  tutorial beats land in a fixed order.
- **Zone 1 (The Long Run):** a 1-cell-wide corridor with rare 1-cell alcoves, extended
  procedurally on demand. Length is a function of distance walked, not a fixed number —
  the corridor gets longer while you are in it, capped so it always ends.
- **Zone 2 (Climate Control):** recursive backtracker (depth-first) over a 48×48 grid, then
  **braided** by knocking out ~18 % of dead-end walls. Braiding is essential — a perfect
  maze feels like a puzzle, a braided maze feels like a building.
- **Zone 3 (Sublevel):** same backtracker, then flood a random 30 % of cells with the
  `wet concrete` material and kill their light sectors. Dead lights are what makes the
  sublevel navigate differently despite identical topology.
- **Zone 4 (The Office):** hand-authored, like Zone 0.

All generation is **seeded** (`mulberry32` from a run seed) so any run is reproducible from
a single string — critical for bug reports and for sharing a run.

### 6.3 Guaranteed-forward invariant

After generating, run a BFS from spawn to the zone exit. If the exit is unreachable,
reject and reseed (should be impossible with a backtracker, but assert it). Then compute
the shortest path and mark those cells `on_critical_path`. Signage and light density
subtly favor the critical path so a stuck player drifts toward the exit without ever being
told anything.

### 6.4 Streaming

The world is built in **chunks of 16×16 cells (64 m²)**. Keep a 3×3 chunk window around
the player. Building a chunk = writing instanced-mesh matrices; it costs ~2 ms, so do it
synchronously on chunk-boundary crossing rather than complicating with a worker. Revisit
that only if profiling on mid-range mobile says otherwise.

---

## 7. Player controller

- **Movement:** WASD / left stick, `PointerLockControls` for mouse, on-screen twin sticks
  for touch. Walk 1.35 m/s. A "hurry" modifier at 2.1 m/s — deliberately not a sprint, no
  stamina, no FOV kick, because panic-running should not feel good.
- **Eye height** 1.68 m. Head-bob is a 2-axis Lissajous at walk frequency, amplitude 1.8 cm
  — enough to feel embodied, low enough to not induce sickness.
- **Collision:** swept AABB, player radius 0.35 m, resolved per-axis so wall-sliding is
  smooth. Grid lookup is O(1); no broadphase needed.
- **Interaction:** exactly one verb — look. A soft crosshair dot fades in near a readable
  surface (placard, sign, note) and the text renders at a comfortable size. Nothing is
  picked up, nothing is opened.
- **Accessibility (build these in from M1, not bolted on):** FOV slider 60–100°, head-bob
  off, film grain off, flicker-reduction mode (light transitions become fades instead of
  snaps — matters for photosensitivity), snap-turn option, subtitles for every diegetic
  sound cue, and a "guided" toggle that adds a faint directional draft sound toward the
  exit.

---

## 8. Lighting — the core system

This is the game's signature mechanic and its main performance lever, so it gets designed
as one system.

Divide the grid into **light sectors** of 4×4 cells. Each sector has one emissive strip run
and one state:

```
DARK -> WAKING (0.25 s ramp + relay click) -> LIT -> TIMEOUT (holds 12 s) -> FADING (1.5 s) -> DARK
```

A sector wakes when the player enters it **or a neighbor of it** — so light always appears
one sector ahead, and you walk into a room that just decided to exist. Behind you, sectors
time out on a 12-second delay, meaning the way back is dark by the time you would want it.

**Rendering:** do not use 40 real lights. Bake the corridor lighting into the material as a
per-instance emissive/ambient term and drive the *intensity* per sector from a small
uniform array (or a 32×32 data texture indexed by sector id). Two real lights maximum: one
attached to the player's current sector, one to the adjacent sector ahead, both cheap
point lights with shadows off. Ceiling-cage shadow grids are a texture, not a shadow map.

**Budget targets:** ≤150 draw calls, ≤400 k triangles on screen, 60 fps at 1080p on a
2020-era laptop iGPU, 30 fps on a 2021 mid-range phone at 0.75 DPR via `AdaptiveDpr`.

---

## 9. Audio

Audio does more work here than geometry does. Three layers:

1. **Bed:** a continuous, generated ambience — filtered pink noise shaped per zone (HVAC
   roar in Zone 2, a low 50 Hz transformer hum in Zone 3), plus a 120 Hz fluorescent buzz
   whose amplitude tracks the number of lit sectors near the player.
2. **Player:** footsteps sampled per surface (concrete / carpet / wet), 6 variants each,
   pitch-randomized ±4 %, with a convolution reverb whose wet mix is driven by the
   distance to the nearest wall on each side — corridors sound tight, the wide bay opens up
   audibly before you see it.
3. **Events:** relay click on sector wake, ballast tick on fade, distant roll-up door
   rattling (never nearer than 40 m, never twice from the same direction), an elevator
   somewhere, occasional settling metal.

Everything is Web Audio; no audio library. Mixed to −16 LUFS with a master limiter.

---

## 10. State & persistence

`zustand` store, persisted to `localStorage` under `storage-units:v1`:

```ts
{ seed: string; zone: 0|1|2|3|4; enteredZoneAt: number;
  settings: { fov, bob, grain, flickerReduction, guided, volume };
  completedRuns: number; freeRoamUnlocked: boolean }
```

Save on zone transition only, not continuously — mid-zone position is deliberately not
restored, because resuming into an unfamiliar corridor is a better experience than
resuming into a solved one. No server, no account, no API route. This ships entirely
static and does not touch the existing `/api/v1/*` surface.

---

## 11. Milestones

| # | Milestone | Deliverable | Est. |
| --- | --- | --- | --- |
| **M0** | Spike | R3F canvas on `/storage-units`, grey-box corridor, pointer-lock walking, AABB collision. Answers "does this feel right to walk in." | 1–2 d |
| **M1** | Grid & streaming | `MazeGrid`, seeded backtracker + braiding, chunked instanced rendering, BFS reachability assert, FPS counter. | 3–4 d |
| **M2** | Lighting system | Sectors, state machine, emissive driving, two real lights, flicker-reduction mode. This is the make-or-break milestone. | 3–4 d |
| **M3** | Art pass | Door / wall / floor / cage materials and props, placard text generation, one set piece (the wide bay). Grey-box → shippable-looking. | 5–7 d |
| **M4** | Audio | Full three-layer system with per-surface footsteps and dynamic reverb. | 3–4 d |
| **M5** | Zones & flow | All five zone configs, hand-authored Zone 0 and 4, transitions, title / pause / settings screens, save. | 4–6 d |
| **M6** | Polish & ship | Post FX, accessibility audit, mobile controls, perf pass to budget, Netlify deploy. | 4–5 d |

Roughly **5–6 weeks** at one developer, part-time-realistic. M0–M2 are the risk; if the
lighting system does not sell the dread at M2, the whole concept should be re-examined
before spending M3's art budget.

---

## 12. Testing

- **Vitest (fits the repo's existing setup):** grid encode/decode round-trip, seeded
  generator determinism (same seed → identical grid), BFS reachability over 1000 random
  seeds, braiding rate within tolerance, collision resolution against a fixture grid
  (corner cases: exact-corner approach, high-speed tunneling).
- **Playwright (repo already has `e2e/`):** `/storage-units` loads, canvas mounts, pointer
  lock engages on click, no console errors, and the BidLens routes still render unaffected.
- **Manual perf gate:** a `?stats=1` flag showing draw calls / triangles / frame time,
  checked against the §8 budget before each milestone closes.
- **Regression guard:** assert in CI that `/` first-load JS has not grown — the game must
  not leak into the main bundle.

---

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Lighting system too expensive on mobile | Emissive-material approach with ≤2 real lights is the plan from day one; fallback is fully baked light with no dynamic response on low-end devices. |
| Motion sickness | Low head-bob, FOV slider, snap-turn, all shipped in M1 rather than as post-launch fixes. |
| Photosensitivity from light snapping | Flicker-reduction mode is a first-class setting, and a warning on the title screen. |
| Procedural maze feels like noise, not architecture | Braiding, critical-path signage weighting, and hand-authored bookend zones. If M1 still feels random, shift Zone 2 to hand-authored room templates stitched procedurally. |
| Scope creep toward "add an entity" | The non-goals in §2 are the contract. If a monster is wanted, it is a different project. |
| Bundle bloat on BidLens | `ssr: false` dynamic import + CI first-load-JS assertion. |

---

## 14. Open questions

1. **Repo fit** — this plan assumes the game lives alongside BidLens. If `arrow-tools` is
   meant to stay a tools repo, say so and the same plan drops into a standalone Next app
   with no other changes.
2. **Run length** — 20–35 min per full loop. Longer (60 min+) is possible by extending
   Zones 2 and 3, but the light system's tension does not obviously scale that far.
3. **VHS framing** — the first reference image has a camcorder overlay (timestamp, scan
   lines, chromatic fringe). Worth shipping as an optional "1998 mode" post-FX layer in
   M6; it is cheap and it is most of the aesthetic for some players.
4. **Free-roam scoring** — should Night Audit track distance walked / deepest unit number
   reached, or stay entirely unmeasured? Measuring adds replay value but slightly
   undercuts pillar 1.
