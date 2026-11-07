# Dreamcast Player

A standalone Dreamcast emulator in **one HTML file**. Open `dreamcast.html` in Chrome, Edge or
Firefox (double-click it, no server or install), drop in a game you own, and play.

It is a small original front-end (video, audio, input, saves, UI) around the
[Flycast](https://github.com/flyinghead/flycast) emulator core compiled to WebAssembly
(`romdev-core-flycast` 0.4.2: SH-4 JIT-to-WASM, PowerVR2 on WebGL2, AICA audio).
Nothing is uploaded; the page makes no network requests.

## Use it

1. Open `tools/dreamcast/dreamcast.html`.
2. Drag in your game, or use **Choose game files / Choose a folder**:
   - **.gdi** - select the `.gdi` *and all its track files* together (or pick the whole folder)
   - **.cdi**, **.chd**, **.cue + .bin**, **.iso**, **.elf**
   - **.zip** containing any of the above (7z/rar: extract first)
3. Play. Esc opens settings; the toolbar appears when you move the mouse.

Quick sanity check with no game: load `test/hello.elf` - you should see a diagonal colour gradient.

| Input | Default |
|---|---|
| D-pad | Arrow keys |
| A / B / X / Y | Z / X / A / S |
| Triggers L / R | Q / W |
| Start | Enter |
| Analog stick | I J K L |
| Gamepad | plug in + press a button (standard layout) |

Shortcuts: `Esc` settings, `P` pause, `F` fullscreen, `M` mute, `F5`/`F8` save/load state,
`F12` screenshot, hold `Tab` to fast-forward. All keys are remappable in Settings.

Saves: VMU/memory-card files and save states (5 slots per game) persist in the browser
(IndexedDB) and can be downloaded/imported in Settings > Saves & BIOS.

BIOS (optional): the built-in HLE BIOS runs many games. For best compatibility add your own
`dc_boot.bin` / `dc_flash.bin` under Settings, then turn off "HLE BIOS" in Game options.

## Status

The front-end logic (file intake, zip/gdi/cue handling, libretro struct parsing, printf, input
mapping, path shim) is unit-tested and the built file is integrity-checked. The **full in-browser
boot has not been run yet** - `test/smoke.cjs` exists for that but could not be executed in the
environment this was authored in. First launch: load `test/hello.elf`; if anything is off, open
Settings > Log (or the error dialog's *View log*) and report it.

## Limits to know about

- Whole disc images are read into browser memory (the core reads from an in-memory filesystem).
  Very large images (>~1.5 GB total) can fail; `.chd` is the most compact.
- Speed depends on your CPU/GPU; if a game stutters lower the resolution in Game options.
  Use Chrome or Edge with hardware acceleration enabled.
- Some games need the real BIOS; compatibility is that of Flycast with HLE BIOS otherwise.

## Rebuild / test

```bash
node tools/dreamcast/build.mjs        # fetches the pinned core from npm, patches, writes dreamcast.html
node tools/dreamcast/test/unit.cjs    # helper unit tests + built-file integrity check
python3 tools/dreamcast/test/make-test-elf.py /tmp/test.elf
node tools/dreamcast/test/smoke.cjs /tmp/test.elf /tmp/shot.png   # headless-Chromium end-to-end boot
```

`build.mjs` verifies the core's SHA-256, patches its Emscripten glue so it runs outside Node
(the upstream build forces `NODERAWFS`), gzips glue + wasm and inlines them with `src/app.js`
and `src/shell.html`.

## Licence

Flycast is GPL-2.0-or-later; the WebAssembly build is from the
[romdev](https://github.com/monteslu/romdev) project. Because the built page embeds it, treat
`dreamcast.html` as GPL-2.0-or-later too (source links are in Settings > About). No games or
console firmware are included - use only media and BIOS dumps from hardware you own.
