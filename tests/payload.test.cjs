const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "payload-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 33445;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(readFileSync(path.join(__dirname, "..", "assets", "fuel.js"), "utf8"), context);
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solvePayload, gradePayload, generateQuestion } = context;
const reference = {
  emptyMass: 797, mauw: 1315, fuelQuantity: 19, volumeUnit: "imperialGallons",
  specificGravity: 0.72, pilotMass: 180, copilotMass: 190, crewUnit: "lbs"
};

test("reference accounts for fuel and both crew members and accepts 288 kg", () => {
  const solution = solvePayload(reference);
  assert.ok(Math.abs(solution.fuelKg - 62.1905112) < 1e-9);
  assert.ok(Math.abs(solution.pilotKg + solution.copilotKg - 167.8291769) < 1e-9);
  assert.ok(Math.abs(solution.capacity - 287.9803119) < 1e-9);
  assert.ok(gradePayload(288, solution.capacity).passed);
  assert.ok(!gradePayload(168, solution.capacity).passed);
  assert.ok(!gradePayload(456, solution.capacity).passed);
});

test("equivalent volume and crew units give equivalent capacity; more fuel reduces capacity", () => {
  const original = solvePayload(reference);
  const litres = solvePayload({ ...reference, fuelQuantity: 19 * 4.54609, volumeUnit: "litres" });
  const kgCrew = solvePayload({ ...reference, pilotMass: 180 * 0.45359237, copilotMass: 190 * 0.45359237, crewUnit: "kg" });
  assert.ok(Math.abs(original.capacity - litres.capacity) < 1e-9);
  assert.ok(Math.abs(original.capacity - kgCrew.capacity) < 1e-9);
  assert.ok(solvePayload({ ...reference, fuelQuantity: 25 }).capacity < original.capacity);
});

test("zero remaining capacity is valid; overloaded or invalid scenarios fail explicitly", () => {
  const loadedMass = solvePayload(reference).loadedMass;
  assert.equal(solvePayload({ ...reference, mauw: loadedMass }).capacity, 0);
  assert.ok(gradePayload(0, 0).passed);
  for (const overrides of [
    { mauw: loadedMass - 1 }, { emptyMass: 0 }, { emptyMass: NaN }, { mauw: Infinity },
    { fuelQuantity: -1 }, { volumeUnit: "gallons" }, { specificGravity: 0 },
    { pilotMass: -1 }, { copilotMass: Infinity }, { crewUnit: "stones" }
  ]) assert.throws(() => solvePayload({ ...reference, ...overrides }));
  assert.ok(gradePayload(290, 288).passed);
  assert.ok(!gradePayload(290.1, 288).passed);
  assert.throws(() => gradePayload(-1, 288));
});

test("random scenarios cover all volume/crew units and specific gravities without overload", () => {
  const combinations = new Set();
  for (let i = 0; i < 3000; i++) {
    const question = generateQuestion();
    const solution = solvePayload(question);
    combinations.add(`${question.volumeUnit}/${question.crewUnit}/${question.specificGravity}`);
    assert.ok(solution.fuelLitres >= 20 && solution.fuelLitres <= 160);
    assert.ok(question.emptyMass >= 650 && question.emptyMass <= 1000);
    assert.ok(solution.loadedMass < question.mauw && solution.capacity > 0);
  }
  assert.equal(combinations.size, 12);
});
