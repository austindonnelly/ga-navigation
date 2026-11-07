const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync(path.join(__dirname, "..", "speed-time-distance-quiz.html"), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(script.slice(0, script.indexOf("    const byId")), context);
const { solveLeg, timeInMinutes, gradeAnswer, formatTime, generateQuestion } = context;

test("77 kt over 20 nm takes 15.6 minutes to one decimal place", () => {
  const solution = solveLeg({ kind: "time", speed: 77, distance: 20 });
  assert.equal(solution.toFixed(1), "15.6");
  assert.ok(gradeAnswer(15.6, solution).passed);
  assert.ok(gradeAnswer(timeInMinutes(0, 15.6), solution).passed);
  assert.ok(!gradeAnswer(20, solution).passed);
});

test("both question types handle short legs, speed limits, and multi-hour legs", () => {
  assert.equal(solveLeg({ kind: "time", speed: 150, distance: 10 }), 4);
  assert.equal(solveLeg({ kind: "time", speed: 50, distance: 150 }), 180);
  assert.equal(solveLeg({ kind: "distance", speed: 90, minutes: timeInMinutes(1, 20) }), 120);
  assert.equal(solveLeg({ kind: "distance", speed: 50, minutes: 180 }), 150);
});

test("time conversion rejects invalid parts and normalizes rounded minute carry", () => {
  assert.equal(timeInMinutes(1, 0), 60);
  assert.equal(timeInMinutes(0, 0.5), 0.5);
  assert.equal(formatTime(59.96, true), "1 h 0 min");
  assert.equal(formatTime(80, true), "1 h 20 min");
  assert.equal(formatTime(80), "80 min");
  for (const parts of [[0, 0], [0, 60], [-1, 20], [1.5, 20], [0, -1], [0, NaN], [Infinity, 0]]) {
    assert.throws(() => timeInMinutes(...parts));
  }
});

test("invalid leg values fail explicitly; tolerance includes its boundary", () => {
  for (const question of [
    { kind: "speed", speed: 77, distance: 20 },
    { kind: "time", speed: 0, distance: 20 },
    { kind: "time", speed: NaN, distance: 20 },
    { kind: "time", speed: 77, distance: -20 },
    { kind: "distance", speed: 77, minutes: Infinity },
    { kind: "distance", speed: 77 }
  ]) assert.throws(() => solveLeg(question));
  assert.ok(gradeAnswer(15.5, 15).passed);
  assert.ok(!gradeAnswer(15.501, 15).passed);
  assert.throws(() => gradeAnswer(NaN, 15));
});

test("random questions include both unknowns and keep all legs in range", () => {
  const kinds = new Set();
  const timeFormats = new Set();
  for (let i = 0; i < 2000; i++) {
    const question = generateQuestion();
    kinds.add(question.kind);
    assert.ok(question.speed >= 50 && question.speed <= 150);
    const solution = solveLeg(question);
    const distance = question.kind === "time" ? question.distance : solution;
    assert.ok(distance >= 10 && distance <= 150);
    if (question.kind === "distance") timeFormats.add(question.hoursAndMinutes);
  }
  assert.equal(kinds.size, 2);
  assert.equal(timeFormats.size, 2);
});
