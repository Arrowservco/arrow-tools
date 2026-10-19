// Global video spec: 30 s * 30 fps = 900 frames, 1080x1920 (9:16).
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION = 900;

// Scene timeline in frames. Must tile 0..DURATION exactly (checked in Root.jsx
// and by `npm run check`).
export const SCENES = {
  intro: {from: 0, dur: 120}, //    0-4 s
  expenses: {from: 120, dur: 210}, //  4-11 s
  cash: {from: 330, dur: 210}, // 11-18 s
  profit: {from: 540, dur: 210}, // 18-25 s
  takeaway: {from: 750, dur: 150}, // 25-30 s
};

// Optional external audio. Paths are relative to /public.
// Nothing is bundled for these - drop your own files in and set the paths.
//   voiceover: e.g. 'audio/voiceover.mp3'  (see README for the script)
//   music:     e.g. 'audio/music.mp3'      (royalty-free track of your choice)
export const AUDIO = {
  voiceover: null,
  voiceoverVolume: 1,
  music: null,
  musicVolume: 0.12,
  // Short synthesized UI sounds (public/audio/*.wav, made by `npm run sfx`).
  sfx: true,
  sfxVolume: 0.5,
};
