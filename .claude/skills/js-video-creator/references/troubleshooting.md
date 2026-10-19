# Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Failed to launch the browser process ... Old Headless mode has been removed` | `--browser-executable` pointed at full Chromium. Use the **headless shell**: `/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell` (render.sh does this). |
| Remotion tries to download Chrome and hangs/403s | Network policy blocks the download. Pass `--browser-executable` as above. |
| Output `pix_fmt=yuvj420p` | JPEG frame format. Set `Config.setVideoImageFormat('png')` and `Config.setPixelFormat('yuv420p')`. |
| `Memory reported by CGroup ... differing memory amounts` | Harmless warning in containers. |
| Node can't import a src module in a script | Add the explicit `.js` extension in imports and `"type":"module"` in package.json; keep scripts' imports to plain `.js` (no JSX). |
| Text overlaps captions/disclaimer | Captions wrap to 3 lines at 46px; use 42px, keep captions at y~1470 and disclaimer ~1725; re-check the longest caption. |
| Last-frame not clean | Overlay opacity must hit exactly 1 on the final frame: `prog(frame, DURATION - N, N - 1)`. |
| Scene feels empty at the start | Pull item/headline timings earlier; leave >=0.6 s of hold on the final headline before the fade. |
| Bars/lines jitter | Something depends on non-frame state (random, Date, CSS transition). Make it a function of `frame`. |
| Custom font missing in render | Install the font in the container or add `@remotion/google-fonts` (needs network). Otherwise accept the fallback and say so. |
| Render slow | Lower `--concurrency` if memory-bound; avoid huge blur filters; PNG frames are slower than JPEG (~1.6x) but needed for yuv420p. |
