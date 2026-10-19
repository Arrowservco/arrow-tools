import {Easing, interpolate} from 'remotion';

export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);
export const easeInOutSin = Easing.inOut(Easing.sin);
export const easePop = Easing.out(Easing.back(1.25));

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

// 0..1 progress of `frame` over [start, start + dur], clamped.
export const prog = (frame, start, dur, easing = easeOut) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

export const fmt$ = (n) => '$' + Math.round(n).toLocaleString('en-US');
