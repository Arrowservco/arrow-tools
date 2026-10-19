import React from 'react';
import {useCurrentFrame} from 'remotion';
import {COLORS, FONT} from '../theme.js';
import {DISCLAIMER} from '../narration.js';
import {SCENES} from '../config.js';
import {prog} from '../utils.js';
import {LAYOUT} from './Layout.jsx';

const EXP = SCENES.expenses;

export const Disclaimer = () => {
  const frame = useCurrentFrame();
  const p = prog(frame, 20, 20);
  const inExpenses = frame >= EXP.from && frame < EXP.from + EXP.dur;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        width: 960,
        top: LAYOUT.disclaimerTop,
        textAlign: 'center',
        fontFamily: FONT,
        fontSize: 26,
        fontWeight: 500,
        lineHeight: 1.35,
        color: COLORS.muted,
        opacity: 0.85 * p,
      }}
    >
      {DISCLAIMER}
      {inExpenses ? <div>Fee / shipping / refund split is also approximate.</div> : null}
    </div>
  );
};
