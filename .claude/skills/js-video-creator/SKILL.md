---
name: js-video-creator
description: Create animated videos from JavaScript code using Remotion (React + SVG) and render them to MP4. Use when the user asks for a JS/JavaScript video, an animated explainer, data-viz or chart animation, social clip (Reels/TikTok/Shorts), kinetic-typography or code-demo video, or to turn a screenshot/dashboard/data into a video. Covers scaffolding, scene timelines, captions, SFX, rendering in a headless cloud container, and QA.
---

# JavaScript video creator

Claude cannot output video directly. The workflow is: **write the video as code -> preview frames -> render MP4**.
Default stack: **Remotion 4 + React + SVG, plain JavaScript (.jsx)**. Everything is frame-driven, so renders are deterministic.
A complete worked example lives in `video/financial-explainer/` (if present) - read it for patterns before inventing new ones.

## Workflow

1. **Pin the spec before coding.** Decide (assume + state briefly, don't interrogate): duration, fps (30), size (9:16 = 1080x1920, 16:9 = 1920x1080, 1:1 = 1080x1080), scenes with timestamps, on-screen text, narration, palette, audio plan. Frames = seconds x fps; scene frames must tile the total exactly.
2. **Scaffold**: `bash .claude/skills/js-video-creator/scripts/scaffold.sh <dir> [WIDTHxHEIGHT] [SECONDS]` creates a runnable project (Root, config, timeline, utils, captions, one demo scene) and runs nothing else. Then `cd <dir> && npm install`.
3. **Model the data and timeline first** (`data.js`, `config.js`, `timeline.js`): scene frame ranges, scene-local timings, sound-effect cues. Visuals and audio read the same constants so they never drift.
4. **Build scenes** as components using `useCurrentFrame()` + `prog()`/`interpolate`. One `<Sequence>` per scene. See `references/patterns.md`.
5. **QA with stills before a full render**: `bash .claude/skills/js-video-creator/scripts/render.sh still <dir> <frame> ...` then Read the PNGs and look at them. Fix layout/legibility, re-check. Stills take seconds; full renders take minutes.
6. **Render**: `bash .claude/skills/js-video-creator/scripts/render.sh video <dir>` (finds a browser automatically, writes `<dir>/out/<id>.mp4`). Verify with `ffprobe`: size, fps, frame count, duration, `pix_fmt=yuv420p`.
7. **Deliver**: send the MP4 to the user (SendUserFile), commit the source (not the MP4, `out/` is gitignored), and say plainly what is and isn't included (voiceover, music).

## Rules that prevent the usual failures

- **Never claim audio you did not produce.** No TTS available => ship a timestamped narration script + burned-in captions + optional user-supplied `voiceover.mp3` hook. Synthesized SFX via ffmpeg (`references/patterns.md`) are fine; call them SFX.
- **Data honesty.** Values read from a screenshot are approximate: label them (`~$1,930`, on-screen disclaimer). Don't invent figures. If you must estimate (e.g. a category split), flag it in code comments and in your reply. If the user's image wasn't actually attached, say so.
- **Deterministic only.** No `Math.random()`, `Date.now()`, CSS transitions/animations, or `setTimeout`. Everything is a function of `frame`.
- **Mobile legibility.** Min ~24px text at 1080 wide, body 36-46px, headlines 80-120px. Keep key content out of the bottom ~200px and top ~150px (platform UI). Max one idea per scene.
- **Explicit file extensions in imports** (`./data.js`, `./Scene.jsx`) so Node scripts can import plain-JS modules (`"type": "module"`).
- **Pin versions**: all `remotion` / `@remotion/*` packages on the exact same version; `react`/`react-dom` 18.3.1.
- **Fonts**: use system/installed Inter with a fallback stack; don't depend on network at render time unless the user's environment allows it. Say so if font fidelity matters.
- **No unsupported APIs.** If unsure a Remotion API exists, check `node_modules/remotion` types or docs rather than guessing.

## Cloud-container notes (this environment)

- npm registry works; Remotion's own Chrome download may be blocked. `render.sh` falls back to the preinstalled Playwright **headless shell** (`/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell`). Full Chromium fails with "Old Headless mode has been removed" - it must be the *headless shell*.
- Use PNG frames (`Config.setVideoImageFormat('png')`) so output is `yuv420p`; JPEG frames give `yuvj420p`.
- ~900 frames at 1080x1920 renders in ~2-3 min. Run full renders with `run_in_background`, don't sleep-poll; wait for the completion notice.
- Memory warnings about cgroup/meminfo are harmless.
- Read `references/troubleshooting.md` on any render error.

## Choosing an approach

| Need | Use |
|---|---|
| Polished, data-driven, reusable videos | Remotion (default) |
| Quick one-off animation, no framework | HTML/CSS/GSAP page + Playwright frame capture + ffmpeg |
| Browser-only, no install | Canvas + MediaRecorder |
| Code-explainer / diagram animation | Remotion with SVG, or Motion Canvas |

Remotion licensing: free for individuals/small teams, company license needed above that - mention it when delivering to a business.

## Deliverable checklist

- [ ] Frames total exactly fps x seconds; scenes tile with no gaps (validate in `Root.jsx` + a check script)
- [ ] Stills from every scene viewed and legible on a phone-sized view
- [ ] Final MP4 probed: dimensions, fps, frame count, `yuv420p`, audio stream present if promised
- [ ] Disclaimers/approximation labels present where data is estimated
- [ ] README with install / preview / render commands and any external-asset instructions
- [ ] Source committed; MP4 sent to the user
