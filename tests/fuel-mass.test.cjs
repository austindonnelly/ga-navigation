const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "fuel-mass-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 24680;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveFuelMass, gradeMass, generateQuestion } = context;
const reference = { quantity: 120, volumeUnit: "litres", specificGravity: 0.72, massUnit: "kg" };

test("120 litres at SG 0.72 accepts 86.4 kg or a rounded 190 lbs", () => {
  const kg = solveFuelMass(reference);
  const lbs = solveFuelMass({ ...reference, massUnit: "lbs" });
  assert.ok(Math.abs(kg.kg - 86.4) < 1e-10);
  assert.equal(kg.mass.toFixed(1), "86.4");
  assert.equal(lbs.mass.toFixed(1), "190.5");
  assert.ok(gradeMass(86.4, kg).passed);
  assert.ok(gradeMass(190, lbs).passed);
  assert.ok(!gradeMass(190, kg).passed);
  assert.ok(!gradeMass(86.4, lbs).passed);
});

test("US and imperial gallons use different conversions for both answer units", () => {
  for (const massUnit of ["kg", "lbs"]) {
    const us = solveFuelMass({ ...reference, quantity: 10, volumeUnit: "usGallons", massUnit });
    const imperial = solveFuelMass({ ...reference, quantity: 10, volumeUnit: "imperialGallons", massUnit });
    assert.ok(Math.abs(us.litres - 37.85411784) < 1e-10);
    assert.ok(Math.abs(imperial.litres - 45.4609) < 1e-10);
    assert.ok(imperial.mass > us.mass);
    assert.ok(!gradeMass(imperial.mass, us).passed);
    assert.ok(Math.abs(us.kg - 27.2549648448) < 1e-9);
  }
});

test("mass scales with quantity and specific gravity without rounding intermediate values", () => {
  const original = solveFuelMass(reference);
  assert.equal(solveFuelMass({ ...reference, quantity: 60 }).mass, original.mass / 2);
  assert.ok(Math.abs(solveFuelMass({ ...reference, specificGravity: 0.8 }).mass - 96) < 1e-10);
  assert.ok(Math.abs(solveFuelMass({ ...reference, quantity: 1.5 }).mass - 1.08) < 1e-10);
});

test("grading applies the correct unit-specific minimum or relative tolerance", () => {
  const kg = solveFuelMass({ ...reference, quantity: 10 });
  const lbs = solveFuelMass({ ...reference, quantity: 10, massUnit: "lbs" });
  assert.equal(gradeMass(kg.mass, kg).tolerance, 0.5);
  assert.equal(gradeMass(lbs.mass, lbs).tolerance, 1);
  assert.ok(gradeMass(kg.mass + 0.5, kg).passed);
  assert.ok(!gradeMass(kg.mass + 0.501, kg).passed);
  const large = solveFuelMass({ ...reference, quantity: 300 });
  assert.ok(gradeMass(large.mass * 1.01, large).passed);
  assert.ok(!gradeMass(large.mass * 1.0101, large).passed);
});

test("invalid values and ambiguous or prototype-derived units fail explicitly", () => {
  for (const overrides of [
    { quantity: 0 }, { quantity: -1 }, { quantity: NaN }, { quantity: Infinity },
    { specificGravity: 0 }, { specificGravity: NaN }, { volumeUnit: "gallons" },
    { volumeUnit: "toString" }, { massUnit: "tonnes" }, { massUnit: "constructor" }
  ]) assert.throws(() => solveFuelMass({ ...reference, ...overrides }));
  assert.throws(() => gradeMass(NaN, solveFuelMass(reference)));
  assert.throws(() => gradeMass(-1, solveFuelMass(reference)));
});

test("random quantities stay in GA range and cover all six unit combinations", () => {
  const combinations = new Set();
  for (let i = 0; i < 2000; i++) {
    const question = generateQuestion();
    const solution = solveFuelMass(question);
    combinations.add(`${question.volumeUnit}/${question.massUnit}`);
    assert.equal(question.specificGravity, 0.72);
    assert.ok(solution.litres >= 10 && solution.litres <= 300);
    assert.ok(Number.isFinite(solution.mass) && solution.mass > 0);
  }
  assert.equal(combinations.size, 6);
});
