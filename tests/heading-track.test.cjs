const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "heading-track-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 86420;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(readFileSync(path.join(__dirname, "..", "assets", "bearings.js"), "utf8"), context);
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveHeadingTrack, gradeBearing, formatCorrection, generateQuestion } = context;
const reference = { direction: "toTrack", bearing: 285, drift: -8, deviation: 2, variation: -5, notation: "letters" };

test("reference converts compass to magnetic to true heading and applies drift last", () => {
  const solution = solveHeadingTrack(reference);
  assert.equal(solution.compassHeading, 285);
  assert.equal(solution.magneticHeading, 287);
  assert.equal(solution.trueHeading, 282);
  assert.equal(solution.trueTrack, 274);
  assert.ok(gradeBearing(274, solution.answer).passed);
  assert.ok(!gradeBearing(275, solution.answer).passed);
});

test("forward reference removes drift before variation and deviation", () => {
  const solution = solveHeadingTrack({ ...reference, direction: "toCompass", bearing: 274 });
  assert.equal(solution.trueHeading, 282);
  assert.equal(solution.magneticHeading, 287);
  assert.equal(solution.compassHeading, 285);
  assert.equal(solution.answer, 285);
  assert.equal(solveHeadingTrack({ ...reference, drift: 8 }).answer, 290);
});

test("pure TVMDC questions ask for true or compass heading without requiring drift", () => {
  const reverse = solveHeadingTrack({ direction: "toTrueHeading", bearing: 285, deviation: 2, variation: -5 });
  assert.equal(reverse.answer, 282);
  assert.equal(reverse.magneticHeading, 287);
  assert.equal(reverse.trueTrack, undefined);
  const forward = solveHeadingTrack({ direction: "fromTrueHeading", bearing: 282, deviation: 2, variation: -5 });
  assert.equal(forward.answer, 285);
  assert.equal(forward.trueTrack, undefined);
});

test("left/right, east/west, and zero corrections round-trip through north", () => {
  for (const bearing of [0, 2, 180, 358, 360]) {
    for (const drift of [-8, 0, 8]) {
      for (const deviation of [-2, 0, 2]) {
        for (const variation of [-5, 0, 5]) {
          const reverse = solveHeadingTrack({ ...reference, bearing, drift, deviation, variation });
          const expected = ((bearing + drift + deviation + variation) % 360 + 360) % 360;
          assert.equal(reverse.answer, expected);
          const forward = solveHeadingTrack({ ...reference, direction: "toCompass", bearing: reverse.answer, drift, deviation, variation });
          assert.equal(forward.answer, bearing === 360 ? 0 : bearing);
        }
      }
    }
  }
  const north = solveHeadingTrack({ ...reference, bearing: 358, deviation: 2, variation: 0, drift: 0 });
  assert.equal(north.answer, 0);
  assert.ok(gradeBearing(360, north.answer).passed);
});

test("notation changes presentation without changing the calculation", () => {
  assert.equal(formatCorrection(2, "signs"), "+2\u00b0");
  assert.equal(formatCorrection(-5, "signs"), "-5\u00b0");
  assert.equal(formatCorrection(2, "letters"), "2\u00b0 E");
  assert.equal(formatCorrection(-5, "letters"), "5\u00b0 W");
  assert.equal(formatCorrection(0, "letters"), "0\u00b0");
  assert.equal(solveHeadingTrack({ ...reference, notation: "signs" }).answer, 274);
});

test("invalid bearings, corrections, directions, and notation fail explicitly", () => {
  for (const overrides of [
    { direction: "toMagnetic" }, { bearing: -1 }, { bearing: 361 },
    { bearing: NaN }, { drift: Infinity }, { deviation: 181 }, { variation: -181 }
  ]) assert.throws(() => solveHeadingTrack({ ...reference, ...overrides }));
  assert.throws(() => formatCorrection(2, "unknown"));
  assert.throws(() => gradeBearing(-1, 274));
  assert.throws(() => gradeBearing(NaN, 274));
});

test("random questions cover all four conversions and both notations, with drift only when needed", () => {
  const combinations = new Set();
  const driftSigns = new Set(), deviationSigns = new Set(), variationSigns = new Set();
  for (let i = 0; i < 2000; i++) {
    const question = generateQuestion();
    const solution = solveHeadingTrack(question);
    combinations.add(`${question.direction}/${question.notation}`);
    const hasDrift = question.direction === "toTrack" || question.direction === "toCompass";
    if (hasDrift) {
      driftSigns.add(Math.sign(question.drift));
      assert.ok(Math.abs(question.drift) <= 15);
    } else {
      assert.equal(question.drift, undefined);
      assert.equal(solution.trueTrack, undefined);
    }
    deviationSigns.add(Math.sign(question.deviation));
    variationSigns.add(Math.sign(question.variation));
    assert.ok(question.bearing >= 0 && question.bearing < 360);
    assert.ok(Math.abs(question.deviation) <= 5 && Math.abs(question.variation) <= 15);
    assert.ok(solution.answer >= 0 && solution.answer < 360);
  }
  assert.equal(combinations.size, 8);
  for (const signs of [driftSigns, deviationSigns, variationSigns]) assert.equal(signs.size, 3);
});
