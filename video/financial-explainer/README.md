# 30-second financial explainer (Remotion)

Animated vertical video (1080×1920, 30 fps, 900 frames, H.264 MP4) that rebuilds the
two dashboard charts (expense pressure; cash-in vs. profit proxy, Jan–Jun 2026) as
animated SVG. Everything is frame-driven, so renders are deterministic.

> Values are **approximate**, read from the dashboard. Cash-in = total-credits proxy,
> profit = payoff-capacity proxy. Neither is a verified payout or cash on hand.
> The fee / shipping / refund split in `src/data.js` is an estimate (only monthly
> totals were provided) — edit it to match the screenshot; totals drive all labels.

## Setup & preview

```bash
cd video/financial-explainer
npm install
npm run preview      # Remotion Studio with timeline scrubber (http://localhost:3000)
```

## Export the MP4

```bash
npm run render       # -> out/financial-explainer.mp4  (1080x1920, 30fps, H.264)
npm run still        # single PNG of frame 300 for a quick look
npm run check        # verifies 900 frames, 6 months, caption pacing, stats
```

First render downloads Chrome Headless Shell automatically. If your network blocks that,
point at an installed one: `npx remotion render src/index.js FinancialExplainer out/financial-explainer.mp4 --browser-executable=/path/to/headless_shell`
(it must be a *headless shell* binary, not full Chrome).

## Audio

* **Sound effects** (included): `public/audio/{tick,ping,whoosh}.wav`, synthesized with
  ffmpeg (`npm run sfx` regenerates them). Cues are timed in `src/timeline.js`.
  Disable with `AUDIO.sfx = false` in `src/config.js`.
* **Voiceover: NOT included.** No TTS was available. Run `npm run captions` to write
  `out/voiceover-script.txt` (timestamped script) and `out/captions.srt`. Record or
  generate the voiceover with any tool, export it as ~30 s MP3/WAV, save it as
  `public/audio/voiceover.mp3`, then set `AUDIO.voiceover = 'audio/voiceover.mp3'`
  in `src/config.js`.
* **Background music: NOT included.** Add a royalty-free track as
  `public/audio/music.mp3` and set `AUDIO.music = 'audio/music.mp3'` (auto fade in/out,
  default volume 12%).
* Captions are burned into the video from `src/narration.js`.

## Timeline

| Frames | Time | Scene |
|---|---|---|
| 0–119 | 0–4 s | Intro: title, subtitle, dashboard from darkness |
| 120–329 | 4–11 s | Expense pressure: stacked bars, March peak, −72% |
| 330–539 | 11–18 s | Cash-in proxy: bars, March peak, decline |
| 540–749 | 18–25 s | Profit proxy: line draws, March/June callouts, −75%, caution |
| 750–899 | 25–30 s | Split-screen recap, 3 takeaways, headline, fade-out |

## Layout

```
src/
  index.js / Root.jsx        registerRoot + <Composition> (validates timeline)
  FinancialExplainer.jsx     scene sequencing, overlays, fade in/out
  config.js timeline.js      fps/size/scene frames, scene-local timings, SFX cues
  data.js narration.js       chart data, voiceover/caption script, disclaimer
  components/                charts, layout, captions, background, sound
  scenes/                    Scene1Intro ... Scene5Takeaway
scripts/                     make-sfx.sh, export-captions.mjs, check-timeline.mjs
```

Fonts: uses Inter if installed, otherwise the system sans-serif. For identical output on
any machine, install Inter (or add `@remotion/google-fonts`, which needs network at render).
