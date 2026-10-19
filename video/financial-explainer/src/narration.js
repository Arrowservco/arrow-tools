import {FPS} from './config.js';

// Voiceover script + on-screen captions. Times in seconds.
export const NARRATION = [
  {start: 0.0, end: 3.9, text: "Here's a quick look at six months of business performance."},
  {start: 4.0, end: 10.9, text: 'Expenses peaked in March, then dropped sharply, reaching their lowest level in June.'},
  {start: 11.0, end: 17.9, text: 'Cash-in also peaked in March, before declining steadily through June.'},
  {start: 18.0, end: 24.9, text: 'Profit followed the same pattern, suggesting less capacity to pay down financing.'},
  {start: 25.0, end: 29.4, text: 'The takeaway? Lower expenses help, but sustainable profit matters most.'},
].map((n) => ({...n, startFrame: Math.round(n.start * FPS), endFrame: Math.round(n.end * FPS)}));

export const DISCLAIMER = 'Approximate values from dashboard; cash-in and payoff figures are proxies.';
