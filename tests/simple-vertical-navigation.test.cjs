const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "simple-vertical-navigation-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 12345;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveVerticalNavigation, gradeAltitude, generateQuestion } = context;
const reference = { kind: "change", ias: 75, wind: 20, verticalSpeed: 500, distance: 5 };

test("reference preserves full precision and accepts a 1575 ft mechanical reading", () => {
  const solution = solveVerticalNavigation(reference);
  assert.equal(solution.gs, 95);
  assert.equal(solution.minutes, 300 / 95);
  assert.equal(solution.answer.toFixed(1), "1578.9");
  assert.ok(gradeAltitude(1575, solution.answer).passed);
  assert.ok(!gradeAltitude(1500, solution.answer).passed);
});

test("headwind increases time and altitude change; calm and tailwind are handled", () => {
  const calm = solveVerticalNavigation({ ...reference, wind: 0 });
  const headwind = solveVerticalNavigation({ ...reference, wind: -20 });
  const tailwind = solveVerticalNavigation(reference);
  assert.equal(calm.answer, 2000);
  assert.equal(headwind.gs, 55);
  assert.ok(headwind.answer > calm.answer && calm.answer > tailwind.answer);
});

test("descents have negative changes and final altitude adds the signed change", () => {
  const descent = solveVerticalNavigation({ ...reference, wind: 0, verticalSpeed: -500 });
  assert.equal(descent.answer, -2000);
  assert.ok(gradeAltitude(-2000, descent.answer).passed);
  assert.ok(!gradeAltitude(2000, descent.answer).passed);
  assert.equal(solveVerticalNavigation({ ...reference, kind: "final", wind: 0, initialAltitude: 1000 }).answer, 3000);
  assert.equal(solveVerticalNavigation({ ...reference, kind: "final", wind: 0, verticalSpeed: -500, initialAltitude: 3000 }).answer, 1000);
  assert.equal(solveVerticalNavigation({ ...reference, kind: "final", wind: 0, verticalSpeed: -500, initialAltitude: 2000 }).answer, 0);
});

test("invalid segments fail explicitly and signed answers include tolerance boundaries", () => {
  for (const overrides of [
    { kind: "time" }, { ias: 0 }, { wind: -75 }, { wind: -100 },
    { distance: 0 }, { distance: Infinity }, { verticalSpeed: 0 }, { verticalSpeed: NaN },
    { kind: "final" }, { kind: "final", initialAltitude: -1 },
    { kind: "final", initialAltitude: 0, verticalSpeed: -500 }
  ]) assert.throws(() => solveVerticalNavigation({ ...reference, ...overrides }));
  assert.ok(gradeAltitude(-1950, -2000).passed);
  assert.ok(!gradeAltitude(-1949.9, -2000).passed);
  assert.throws(() => gradeAltitude(NaN, 2000));
});

test("generated segments cover all twelve variations without implausible final altitudes", () => {
  const combinations = new Set();
  for (let i = 0; i < 2000; i++) {
    const question = generateQuestion();
    const solution = solveVerticalNavigation(question);
    combinations.add(`${question.kind}/${Math.sign(question.wind)}/${Math.sign(question.verticalSpeed)}`);
    assert.ok(question.ias >= 50 && question.ias <= 150);
    assert.ok(question.wind === 0 || (Math.abs(question.wind) >= 5 && Math.abs(question.wind) <= 30));
    assert.ok(Math.abs(question.verticalSpeed) >= 250 && Math.abs(question.verticalSpeed) <= 750);
    assert.ok(question.distance >= 1 && question.distance <= 10);
    assert.ok(solution.gs > 0 && Math.abs(solution.change) <= 4000);
    if (question.kind === "final") {
      assert.ok(question.initialAltitude >= 500 && question.initialAltitude <= 10000);
      assert.ok(solution.answer >= 500 && solution.answer <= 10000);
    } else assert.equal(question.initialAltitude, undefined);
  }
  assert.equal(combinations.size, 12);
});
