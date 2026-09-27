// Today's own styles — the date switcher, the macro tones and the meals table. Moved whole out of
// `server/index.ts`'s style block (#87); the register's own layout of this surface is W4's.

export const todayCss = `
progress { display: block; width: 100%; height: 4px; margin: .5rem 0 .25rem; appearance: none; border: 0;
  border-radius: 3px; overflow: hidden; background: var(--line); }
progress::-webkit-progress-bar { background: transparent; }
progress::-webkit-progress-value { background: var(--accent); border-radius: 3px; }
progress::-moz-progress-bar { background: var(--accent); border-radius: 3px; }
.big.warn + progress::-webkit-progress-value { background: var(--warn); }
.big.warn + progress::-moz-progress-bar { background: var(--warn); }

/* THE DATE SWITCHER (#71): a white bar at the top of the day — the chevrons at the two ends, the
   day's name centred between them, and the ONE place the date is written. The relative day carries
   the date as a quiet sub-line; any other day's name is the date, so nothing prints twice. */
.daybar { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding: 6px 10px;
  background: var(--surface); border: 1px solid var(--hair); border-radius: 999px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--ink) 4%, transparent); }
.daybtn { flex: 0 0 44px; width: 44px; height: 44px; border: 0; border-radius: 50%; cursor: pointer;
  background: none; color: var(--ink); font: inherit; font-size: 20px;
  display: inline-flex; align-items: center; justify-content: center; }
.daylabel { flex: 1; min-width: 0; text-align: center; }
.dayname { margin: 0; font-size: 15px; }
.daysub { margin: 0; font-size: 12px; }
/* THE MACRO TONES (#71): a counter's figures carry the state against its target — care while
   protein is still to reach, bad once a cap is passed. The label stays neutral. */
.tone-good { color: var(--good); }
.tone-care { color: var(--care); }
.tone-bad { color: var(--bad); }
.stat { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }

/* THE TABLE IS THE SECOND THING THIS WINDOW DOES. A phone can show four rows and a total; this can
   show the one guess sitting in a list of measured things, which is the strongest statement of the
   mechanism anywhere in the product. */
.meals { width: 100%; border-collapse: collapse; }
.meals th { text-align: left; font-size: 12px; font-weight: 700; letter-spacing: .11em; text-transform: uppercase;
  color: var(--faint); padding: 0 12px 10px; border-bottom: 1px solid var(--line); }
.meals td { padding: 11px 12px; border-bottom: 1px solid var(--hair); }
.meals tr:last-child td { border-bottom: 0; }
.meals .num { text-align: right; white-space: nowrap; }
/* The guessed row, and the only colour in the list. */
.meals tr.guessed td { background: color-mix(in srgb, var(--warn) 7%, transparent); }
.meals tr.guessed td:first-child { border-left: 1.5px solid color-mix(in srgb, var(--warn) 45%, transparent); }
/* The row's verdict pills sit under the meal's name, smaller than a card's (#52). */
.meals .pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.meals .pill { min-height: 22px; padding: 0 9px; font-size: 12px; }
`;
