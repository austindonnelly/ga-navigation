const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "fuel-consumption-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 11223;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(readFileSync(path.join(__dirname, "..", "assets", "fuel.js"), "utf8"), context);
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveFuelConsumption, gradeConsumption, generateQuestion, fuelQuantityFromLitres } = context;
const reference = {
  kind: "fuel", initialQuantity: 42, currentQuantity: 36, volumeUnit: "usGallons",
  elapsedMinutes: 24, furtherMinutes: 48, specificGravity: 0.75, answerUnit: "kg"
};

test("reference burns another 12 US gallons and accepts 68 kg", () => {
  const solution = solveFuelConsumption(reference);
  assert.equal(solution.usedVolume, 6);
  assert.equal(solution.burnPerMinute, 0.25);
  assert.equal(solution.remainingVolume, 24);
  assert.ok(Math.abs(solution.answer - 68.137412112) < 1e-9);
  assert.ok(gradeConsumption(68, solution).passed);
  assert.ok(!gradeConsumption(85, solution).passed);
});

test("endurance is additional time from the current reading and independent of specific gravity", () => {
  const question = { ...reference, kind: "endurance", answerUnit: "minutes" };
  const solution = solveFuelConsumption(question);
  assert.equal(solution.answer, 144);
  assert.equal(solveFuelConsumption({ ...question, specificGravity: 0.72 }).answer, 144);
  assert.ok(!gradeConsumption(168, solution).passed);
});

test("different fuel units and specific gravities convert remaining fuel consistently", () => {
  for (const volumeUnit of ["litres", "usGallons", "imperialGallons"]) {
    for (const answerUnit of ["litres", "usGallons", "imperialGallons", "kg", "lbs"]) {
      for (const specificGravity of [0.72, 0.75]) {
        const solution = solveFuelConsumption({ ...reference, volumeUnit, answerUnit, specificGravity });
        assert.equal(solution.remainingVolume, 24);
        assert.equal(solution.answer, fuelQuantityFromLitres(solution.remainingLitres, answerUnit, specificGravity));
      }
    }
  }
  const low = solveFuelConsumption({ ...reference, specificGravity: 0.72 });
  assert.ok(low.answer < solveFuelConsumption(reference).answer);
});

test("zero further flight and exact exhaustion work; flight beyond exhaustion fails", () => {
  assert.equal(solveFuelConsumption({ ...reference, furtherMinutes: 0, answerUnit: "usGallons" }).answer, 36);
  const exhausted = solveFuelConsumption({ ...reference, furtherMinutes: 144 });
  assert.equal(exhausted.answer, 0);
  assert.ok(gradeConsumption(0, exhausted).passed);
  assert.throws(() => solveFuelConsumption({ ...reference, furtherMinutes: 144.1 }));
  assert.equal(solveFuelConsumption({ ...reference, kind: "endurance", currentQuantity: 0, answerUnit: "minutes" }).answer, 0);
});

test("invalid readings, units, and inputs fail explicitly", () => {
  for (const overrides of [
    { kind: "rate" }, { currentQuantity: 42 }, { currentQuantity: 43 }, { currentQuantity: -1 },
    { elapsedMinutes: 0 }, { elapsedMinutes: NaN }, { furtherMinutes: -1 },
    { specificGravity: 0 }, { volumeUnit: "gallons" }, { answerUnit: "minutes" },
    { answerUnit: "constructor" }, { initialQuantity: Infinity }
  ]) assert.throws(() => solveFuelConsumption({ ...reference, ...overrides }));
  assert.throws(() => gradeConsumption(NaN, solveFuelConsumption(reference)));
  assert.throws(() => gradeConsumption(-1, solveFuelConsumption(reference)));
  const solution = solveFuelConsumption(reference);
  const tolerance = gradeConsumption(solution.answer, solution).tolerance;
  assert.ok(gradeConsumption(solution.answer + tolerance, solution).passed);
  assert.ok(!gradeConsumption(solution.answer + tolerance + 0.01, solution).passed);
});

test("random questions cover both kinds, all unit combinations, and both specific gravities", () => {
  const combinations = new Set();
  for (let i = 0; i < 5000; i++) {
    const question = generateQuestion();
    const solution = solveFuelConsumption(question);
    combinations.add(`${question.volumeUnit}/${question.answerUnit}/${question.specificGravity}`);
    const litresPerUnit = question.volumeUnit === "litres" ? 1 : question.volumeUnit === "usGallons" ? 3.785411784 : 4.54609;
    assert.ok(question.initialQuantity * litresPerUnit >= 60 && question.initialQuantity * litresPerUnit <= 240);
    assert.ok(question.elapsedMinutes >= 10 && question.elapsedMinutes <= 40);
    assert.ok(solution.burnLitresPerHour >= 25 - 1e-9 && solution.burnLitresPerHour <= 60 + 1e-9);
    assert.ok(solution.answer > 0);
    if (question.kind === "fuel") assert.ok(question.furtherMinutes < solution.enduranceMinutes);
    else assert.equal(question.furtherMinutes, undefined);
  }
  assert.equal(combinations.size, 36);
});
