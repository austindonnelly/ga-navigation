const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "true-altitude-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 13579;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveTrueAltitude, pressureAltitudeFromIndicated, gradeAltitude, generateQuestion } = context;
const reference = { indicatedAltitude: 6200, qnh: 1030, oat: 10 };

test("reference accepts 6340 ft and applies temperature correction to indicated altitude", () => {
  const solution = solveTrueAltitude(reference);
  assert.equal(solution.pressureAltitude, 5697.5);
  assert.ok(Math.abs(solution.trueAltitude - 6340.809802) < 0.001);
  assert.ok(gradeAltitude(6340, solution.trueAltitude).passed);
  assert.ok(!gradeAltitude(6200, solution.trueAltitude).passed);
  assert.ok(!gradeAltitude(solution.pressureAltitude * solution.temperatureRatio, solution.trueAltitude).passed);
});

test("ISA temperature leaves altitude unchanged; warmer and colder temperatures change it correctly", () => {
  const { isaTemperature } = solveTrueAltitude(reference);
  const isa = solveTrueAltitude({ ...reference, oat: isaTemperature });
  assert.equal(isa.trueAltitude, 6200);
  assert.ok(solveTrueAltitude({ ...reference, oat: isaTemperature + 20 }).trueAltitude > 6200);
  assert.ok(solveTrueAltitude({ ...reference, oat: isaTemperature - 20 }).trueAltitude < 6200);
  assert.equal(solveTrueAltitude({ indicatedAltitude: 0, qnh: 1013.25, oat: 15 }).trueAltitude, 0);
});

test("QNH conversion has the right sign and supports negative pressure altitude", () => {
  assert.equal(pressureAltitudeFromIndicated(3000, 1013.25), 3000);
  assert.equal(pressureAltitudeFromIndicated(3000, 1000), 3397.5);
  assert.equal(pressureAltitudeFromIndicated(3000, 1030), 2497.5);
  assert.ok(pressureAltitudeFromIndicated(500, 1040) < 0);
  const lowQnh = solveTrueAltitude({ ...reference, qnh: 980 });
  const highQnh = solveTrueAltitude({ ...reference, qnh: 1040 });
  assert.ok(lowQnh.trueAltitude > highQnh.trueAltitude);
});

test("invalid values fail explicitly and tolerance includes its boundary", () => {
  for (const overrides of [
    { indicatedAltitude: -1 }, { indicatedAltitude: NaN }, { indicatedAltitude: 40000 },
    { qnh: 0 }, { qnh: -1 }, { qnh: Infinity }, { oat: NaN }, { oat: -273.15 }
  ]) assert.throws(() => solveTrueAltitude({ ...reference, ...overrides }));
  assert.ok(gradeAltitude(6390, 6340).passed);
  assert.ok(!gradeAltitude(6390.1, 6340).passed);
  assert.throws(() => gradeAltitude(NaN, 6340));
  assert.throws(() => gradeAltitude(-1, 6340));
});

test("random questions cover warmer/colder and high/low/standard QNH within GA ranges", () => {
  const qnhKinds = new Set();
  const temperatureKinds = new Set();
  for (let i = 0; i < 2000; i++) {
    const question = generateQuestion();
    const solution = solveTrueAltitude(question);
    qnhKinds.add(Math.sign(question.qnh - 1013.25));
    temperatureKinds.add(Math.sign(question.oat - solution.isaTemperature));
    assert.ok(question.indicatedAltitude >= 500 && question.indicatedAltitude <= 10000);
    assert.ok(question.qnh >= 980 && question.qnh <= 1040);
    assert.ok(Math.abs(question.oat - solution.isaTemperature) <= 20.5);
    assert.ok(Number.isFinite(solution.trueAltitude) && solution.trueAltitude > 0);
  }
  assert.equal(qnhKinds.size, 3);
  assert.ok(temperatureKinds.has(-1) && temperatureKinds.has(1));
});
