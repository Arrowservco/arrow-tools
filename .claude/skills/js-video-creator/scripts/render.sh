#!/usr/bin/env bash
# Render helper for Remotion projects.
#   render.sh video <project-dir> [CompositionId] [extra remotion flags...]
#   render.sh still <project-dir> <frame> [<frame> ...]   (PNGs in <dir>/out/still-<frame>.png)
# Picks a headless-shell browser automatically when one is installed (cloud containers);
# otherwise lets Remotion manage its own browser.
set -euo pipefail

mode="${1:?usage: render.sh video|still <project-dir> ...}"; dir="${2:?project dir}"; shift 2
cd "$dir"
entry="src/index.js"; [ -f "$entry" ] || entry="src/index.jsx"
comp_default="$(grep -o 'id="[^"]*"' src/Root.jsx | head -1 | sed 's/id="//;s/"//')"

browser_args=()
if [ -n "${REMOTION_BROWSER_EXECUTABLE:-}" ]; then
  browser_args=(--browser-executable="$REMOTION_BROWSER_EXECUTABLE")
else
  shell="$(ls /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | head -1 || true)"
  [ -n "$shell" ] && browser_args=(--browser-executable="$shell")
fi
mkdir -p out

case "$mode" in
  video)
    comp="${1:-$comp_default}"; [ $# -gt 0 ] && shift
    npx remotion render "$entry" "$comp" "out/${comp}.mp4" "${browser_args[@]}" "$@" 2>&1 | grep -v -i 'memory\|docker'
    ffprobe -v error -show_entries stream=codec_name,codec_type,pix_fmt,width,height,r_frame_rate,nb_frames,duration -of default=nw=1 "out/${comp}.mp4"
    ;;
  still)
    for f in "$@"; do
      npx remotion still "$entry" "$comp_default" "out/still-$f.png" --frame="$f" "${browser_args[@]}" 2>&1 | grep -i 'error' || true
      echo "out/still-$f.png"
    done
    ;;
  *) echo "mode must be video or still" >&2; exit 1 ;;
esac
