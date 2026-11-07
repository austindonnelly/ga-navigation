const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "rate-of-descent-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 97531;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveRateOfDescent, gradeRate, generateQuestion } = context;
const reference = {
  destination: "Clacton", distanceToDestination: 20,
  cruisingAltitude: 5000, groundSpeed: 77, targetAltitude: 2000, targetDistance: 5
};

test("Clacton reference uses 15 nm and accepts a 256 ft/min reading", () => {
  const solution = solveRateOfDescent(reference);
  assert.equal(solution.descentDistance, 15);
  assert.equal(solution.altitudeToLose, 3000);
  assert.equal(solution.minutes, 900 / 77);
  assert.ok(Math.abs(solution.rod - 256.6666667) < 1e-6);
  assert.ok(gradeRate(256, solution.rod).passed);
  assert.ok(gradeRate(257, solution.rod).passed);
  assert.ok(!gradeRate(192.5, solution.rod).passed);
});

test("more speed or an earlier target needs a greater descent rate", () => {
  const original = solveRateOfDescent(reference).rod;
  assert.equal(solveRateOfDescent({ ...reference, groundSpeed: 154 }).rod, original * 2);
  assert.ok(solveRateOfDescent({ ...reference, targetDistance: 10 }).rod > original);
  assert.ok(solveRateOfDescent({ ...reference, targetAltitude: 3000 }).rod < original);
  assert.equal(solveRateOfDescent({ ...reference, targetDistance: 0 }).descentDistance, 20);
});

test("invalid altitude, speed, and target point fail explicitly", () => {
  for (const overrides of [
    { destination: "" }, { destination: " " }, { groundSpeed: 0 }, { groundSpeed: NaN },
    { cruisingAltitude: 2000 }, { targetAltitude: -1 }, { targetAltitude: 6000 },
    { targetDistance: -1 }, { targetDistance: 20 }, { targetDistance: 25 },
    { distanceToDestination: Infinity }
  ]) assert.throws(() => solveRateOfDescent({ ...reference, ...overrides }));
  assert.throws(() => gradeRate(-256, 256));
  assert.throws(() => gradeRate(NaN, 256));
  assert.ok(gradeRate(266, 256).passed);
  assert.ok(!gradeRate(266.1, 256).passed);
});

test("random questions cover the nearby airfields and maintain plausible descent rates", () => {
  const destinations = new Set();
  for (let i = 0; i < 2000; i++) {
    const question = generateQuestion();
    const solution = solveRateOfDescent(question);
    destinations.add(question.destination);
    assert.ok(question.cruisingAltitude >= 3500 && question.cruisingAltitude <= 8000);
    assert.ok(question.targetAltitude >= 1000 && question.targetAltitude <= 2500);
    assert.ok(question.groundSpeed >= 50 && question.groundSpeed <= 150);
    assert.ok(question.targetDistance >= 3 && question.targetDistance <= 10);
    assert.ok(solution.descentDistance >= 5 && solution.descentDistance <= 40);
    assert.ok(solution.rod >= 150 - 1e-9 && solution.rod <= 800 + 1e-9);
  }
  assert.deepEqual([...destinations].sort(), ["Conington", "Duxford", "Fenland", "Fowlmere", "Old Warden"]);
});
