---
name: add-quiz
description: Add a CRP-1 flight-computer or pencil-and-paper quiz to this repository, with its own HTML page and an entry in the shared menu.
---

# Add a quiz

Read `index.html`, `assets/theme.css`, and the closest existing quiz before editing: `wind-triangle-quiz.html` for vectors or `speed-time-distance-quiz.html` for scalar calculations and time inputs.

1. Give the quiz a specific problem-based name and create its own root-level `<topic>-quiz.html` file. Keep quiz logic in that page. All pages must work when opened locally, without a server, build step, network access, or fetched data.
2. Link `assets/theme.css` and reuse the existing typography, panels, forms, buttons, feedback, and responsive layout. Keep problem-specific styles in the quiz page; extract genuinely shared assets rather than duplicating them.
3. Include a descriptive title and heading, an `All quizzes` link to `index.html`, labelled inputs with units, explicit bearing/direction conventions where relevant, and accessible answer feedback. Preserve the practice-only disclaimer.
4. Generate solvable questions, validate inputs, explain the calculation after checking the answer, and provide a deterministic reference example. State tolerances suitable for mechanical-computer or pencil-and-paper readings. New quizzes are tests: do not show calculation hints, formulas, or worked answers before submission; include explicitly requested constants in the question.
5. Add one linked card to the `quiz-list` in `index.html`, with the same name and a short description of the problem. Link only implemented quizzes; do not add broken links or pretend unwritten quizzes are playable.
6. Verify local-file menu navigation in both directions, shared styling at narrow and wide widths, the reference answer, an incorrect answer, invalid input, and question reset. Exercise mathematical edge cases introduced by the new quiz.

Keep the menu a short static list; no framework or quiz registry is needed. Extend this skill when a new quiz establishes a reusable convention.

Use the shared `.parameters` definition-list styling for known values. State wind assumptions explicitly when using airspeed for a distance/time calculation. Convert hours and minutes to total minutes before solving or grading; hours must be whole, minutes less than 60, and total time positive. Disable hidden answer fields so they do not interfere with form validation.

Focused calculation tests live in `tests` and run with `node --test`. Keep them dependency-free; browser checks must still verify actual local-file behaviour.

For vertical navigation, use `simple-vertical-navigation-quiz.html` as prior art. State any IAS = TAS simplification and use ground distance with wind-adjusted ground speed. Altitude changes are signed (negative for descent); final altitude adds that signed change to the initial altitude. Generate segments that finish at nonnegative altitudes, and grade approximate reference readings against the unrounded solution.

For airspeed correction, use `true-airspeed-quiz.html` as prior art. Convert QNH-set indicated altitude to pressure altitude before using OAT and CAS. Keep pressure-altitude conversion independent of OAT, permit negative pressure altitudes, and state whether compressibility is ignored. If allowing a pressure-altitude rule of thumb, name it explicitly and keep the ISA result as the reference.

For true altitude, use `true-altitude-quiz.html` as prior art. State the simplified CRP-1 model and sea-level reference assumption. Use the requested 30 ft/hPa pressure conversion, then the ratio of calibrated OAT to ISA temperature at pressure altitude in kelvin; apply that ratio to indicated altitude, not pressure altitude.

For fuel mass, use `fuel-mass-quiz.html` as prior art. Always distinguish US gallons from imperial gallons. Convert volume to litres before applying the stated specific gravity, then convert mass from kg to lbs if requested. Keep full precision when solving and use unit-specific grading tolerances.

For descent planning, use `rate-of-descent-quiz.html` as prior art. Subtract the target point's distance before the destination from the current distance to find the available descent distance. Use ground speed and altitude loss; answers are positive descent rates. Real airfield names are context for fictional scenarios, not published procedures.

For heading/track conversion, use `heading-track-quiz.html` as prior art. T in TVMDC means True Heading, not Track. Pure compass/true-heading questions omit drift; track questions apply drift last from compass heading, and remove it first when finding compass heading. East variation/deviation and right drift are positive; West and left are negative. Reuse `assets/bearings.js` for wrapping, circular errors, and display; load it before the quiz's inline script for local-file use.
