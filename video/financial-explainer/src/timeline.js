import {SCENES} from './config.js';

// Scene-local frame timings (0 = first frame of the scene). Both the visuals
// and the sound effects read from here so they can never drift apart.
export const T = {
  expenses: {
    barStart: (i) => 18 + i * 13,
    barDur: 26,
    peakAt: 108,
    trendAt: 140,
    bannerAt: 150,
  },
  cash: {
    barStart: (i) => 16 + i * 13,
    barDur: 26,
    peakAt: 106,
    trendAt: 140,
    bannerAt: 150,
  },
  profit: {
    lineStart: 24,
    lineDur: 80,
    bannerAt: 124,
    cautionAt: 152,
  },
  takeaway: {
    chartsAt: 6,
    itemAt: (i) => 18 + i * 16,
    headlineAt: 72,
    fadeOutDur: 18,
  },
};

const g = (scene, local) => SCENES[scene].from + local;

// Absolute-frame sound-effect cues. Files live in public/audio.
export const SFX = [
  {at: 4, file: 'audio/whoosh.wav', volume: 0.7},
  {at: g('expenses', -4), file: 'audio/whoosh.wav', volume: 0.8},
  ...[0, 1, 2, 3, 4, 5].map((i) => ({at: g('expenses', T.expenses.barStart(i)), file: 'audio/tick.wav', volume: 0.5})),
  {at: g('expenses', T.expenses.peakAt), file: 'audio/ping.wav', volume: 0.8},
  {at: g('expenses', T.expenses.bannerAt), file: 'audio/tick.wav', volume: 0.8},
  {at: g('cash', -4), file: 'audio/whoosh.wav', volume: 0.8},
  ...[0, 1, 2, 3, 4, 5].map((i) => ({at: g('cash', T.cash.barStart(i)), file: 'audio/tick.wav', volume: 0.5})),
  {at: g('cash', T.cash.peakAt), file: 'audio/ping.wav', volume: 0.8},
  {at: g('cash', T.cash.bannerAt), file: 'audio/tick.wav', volume: 0.8},
  {at: g('profit', 24), file: 'audio/whoosh.wav', volume: 0.45},
  {at: g('profit', 60), file: 'audio/ping.wav', volume: 0.8},
  {at: g('profit', 106), file: 'audio/ping.wav', volume: 0.8},
  {at: g('profit', T.profit.bannerAt), file: 'audio/tick.wav', volume: 0.8},
  {at: g('profit', T.profit.cautionAt), file: 'audio/ping.wav', volume: 0.6},
  {at: g('takeaway', -4), file: 'audio/whoosh.wav', volume: 0.8},
  ...[0, 1, 2].map((i) => ({at: g('takeaway', T.takeaway.itemAt(i)), file: 'audio/tick.wav', volume: 0.7})),
  {at: g('takeaway', T.takeaway.headlineAt), file: 'audio/ping.wav', volume: 0.9},
];
