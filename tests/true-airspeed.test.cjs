const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "true-airspeed-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let seed = 54321;
const math = Object.create(Math);
math.random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const context = vm.createContext({ Math: math });
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveTrueAirspeed, pressureAltitudeFromIndicated, gradeAnswers, generateQuestion } = context;
const reference = { indicatedAltitude: 3000, qnh: 1026, oat: 0, cas: 92 };

test("user's reference accepts 2610 ft and 94 kt without replacing the ISA solution", () => {
  const solution = solveTrueAirspeed(reference);
  assert.ok(Math.abs(solution.pressureAltitude - 2660.698937) < 0.001);
  assert.ok(Math.abs(solution.tas - 94.02671) < 0.00001);
  const isa = gradeAnswers(2661, 94, solution);
  const quick = gradeAnswers(2610, 94, solution);
  assert.ok(isa.pressureAltitudeOK && isa.tasOK);
  assert.ok(quick.pressureAltitudeOK && quick.tasOK);
  assert.equal(quick.pressureMethod, "30 ft/hPa approximation");
});

test("standard sea level gives CAS = TAS, while cold dense air can give TAS below CAS", () => {
  const conditions = { indicatedAltitude: 0, qnh: 1013.25, oat: 15, cas: 100 };
  const standard = solveTrueAirspeed(conditions);
  assert.equal(standard.pressureAltitude, 0);
  assert.equal(standard.densityRatio, 1);
  assert.equal(standard.tas, 100);
  assert.ok(solveTrueAirspeed({ ...conditions, oat: -10 }).tas < 100);
  assert.ok(solveTrueAirspeed({ ...conditions, oat: 35 }).tas > 100);
});

test("QNH correction has the right sign, supports negative PA, and is independent of OAT", () => {
  const lowQnh = solveTrueAirspeed({ ...reference, qnh: 1000 });
  const highQnh = solveTrueAirspeed({ ...reference, qnh: 1040 });
  assert.ok(lowQnh.pressureAltitude > reference.indicatedAltitude);
  assert.ok(highQnh.pressureAltitude < reference.indicatedAltitude);
  assert.ok(lowQnh.tas > highQnh.tas);
  assert.ok(solveTrueAirspeed({ ...reference, indicatedAltitude: 0, qnh: 1040 }).pressureAltitude < 0);
  assert.equal(solveTrueAirspeed({ ...reference, qnh: 1000, oat: -10 }).pressureAltitude, lowQnh.pressureAltitude);
  assert.ok(Math.abs(pressureAltitudeFromIndicated(10000, 1013.25).pressureAltitude - 10000) < 1e-8);
});

test("both steps must pass; tolerances include their boundaries", () => {
  const solution = solveTrueAirspeed(reference);
  assert.equal(gradeAnswers(6000, solution.tas, solution).pressureAltitudeOK, false);
  assert.equal(gradeAnswers(solution.pressureAltitude, 120, solution).tasOK, false);
  assert.ok(gradeAnswers(solution.pressureAltitude + 100, solution.tas + 3, solution).pressureAltitudeOK);
  assert.ok(gradeAnswers(solution.pressureAltitude, solution.tas + 3, solution).tasOK);
  assert.equal(gradeAnswers(solution.pressureAltitude + 100.1, solution.tas, solution).pressureAltitudeOK, false);
  assert.equal(gradeAnswers(solution.pressureAltitude, solution.tas + 3.1, solution).tasOK, false);
});

test("invalid conditions fail explicitly", () => {
  for (const overrides of [
    { indicatedAltitude: NaN }, { indicatedAltitude: 40000 }, { qnh: 0 }, { qnh: -10 },
    { qnh: Infinity }, { oat: -273.15 }, { oat: NaN }, { cas: 0 }, { cas: Infinity }
  ]) assert.throws(() => solveTrueAirspeed({ ...reference, ...overrides }));
  assert.throws(() => gradeAnswers(NaN, 100, solveTrueAirspeed(reference)));
  assert.throws(() => gradeAnswers(5000, 0, solveTrueAirspeed(reference)));
});

test("GA-range questions include high/low/standard QNH; quick PA readings remain usable for TAS", () => {
  const qnhKinds = new Set();
  for (let i = 0; i < 2000; i++) {
    const question = generateQuestion();
    const solution = solveTrueAirspeed(question);
    qnhKinds.add(Math.sign(question.qnh - 1013.25));
    assert.ok(question.indicatedAltitude >= 0 && question.indicatedAltitude <= 10000);
    assert.ok(question.qnh >= 980 && question.qnh <= 1040);
    assert.ok(question.cas >= 50 && question.cas <= 150);
    const isaCelsius = 15 - 0.0065 * solution.pressureAltitude * 0.3048;
    assert.ok(Math.abs(question.oat - isaCelsius) <= 20.5);
    const quickPressureRatio = Math.pow(1 - 0.0065 * solution.approximatePressureAltitude * 0.3048 / 288.15, 5.25588);
    const quickTas = question.cas * Math.sqrt(((question.oat + 273.15) / 288.15) / quickPressureRatio);
    assert.ok(Math.abs(quickTas - solution.tas) < 3);
  }
  assert.equal(qnhKinds.size, 3);
});
