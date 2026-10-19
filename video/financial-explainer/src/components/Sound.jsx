import React from 'react';
import {Audio, Sequence, interpolate, staticFile} from 'remotion';
import {AUDIO, DURATION} from '../config.js';
import {SFX} from '../timeline.js';

// Short synthesized UI sounds (run `npm run sfx` to regenerate) plus optional
// user-supplied voiceover / music (see config.js). Nothing is added unless the
// file exists / the path is set.
export const Sound = () => (
  <>
    {AUDIO.voiceover ? <Audio src={staticFile(AUDIO.voiceover)} volume={AUDIO.voiceoverVolume} /> : null}
    {AUDIO.music ? <Audio src={staticFile(AUDIO.music)} volume={(f) => AUDIO.musicVolume * interpolate(f, [0, 30, DURATION - 30, DURATION], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} loop /> : null}
    {AUDIO.sfx
      ? SFX.filter((s) => s.at >= 0).map((s, i) => (
          <Sequence key={i} from={s.at} durationInFrames={45} layout="none">
            <Audio src={staticFile(s.file)} volume={s.volume * AUDIO.sfxVolume} />
          </Sequence>
        ))
      : null}
  </>
);
