import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME, MAX_SCORE_PER_SEC, maxScoreForDuration } from '@cb/shared';
import { makeCourse, RunnerModel, type Hazard } from '../src/model';

function until(model: RunnerModel, distance: number): void {
  let frames = 0;
  while (model.running && model.distance < distance && frames++ < 40_000) model.tick(16);
  assert.ok(frames < 40_000, 'simulation must make progress');
}

test('a seed reproduces the whole course; another seed changes it', () => {
  assert.deepEqual(makeCourse(42), makeCourse(42));
  assert.notDeepEqual(makeCourse(42), makeCourse(43));
  for (const row of makeCourse(42)) {
    assert.ok(row.lane >= 0 && row.lane < GAME.LANES);
    assert.notEqual(row.coinLane, row.lane, 'coin lane always offers a safe route');
  }
});

test('lane changes stay inside the three tracks and require a started run', () => {
  const model = new RunnerModel(1);
  model.act('left');
  assert.equal(model.lane, 1);
  model.start();
  for (let i = 0; i < 5; i++) model.act('left');
  assert.equal(model.lane, 0);
  for (let i = 0; i < 5; i++) model.act('right');
  assert.equal(model.lane, 2);
});

for (const hazard of ['barrier', 'bar', 'train'] as Hazard[]) {
  test(`${hazard} ends an unprotected run once and keeps results stable`, () => {
    const model = new RunnerModel(10);
    model.rows[0]!.hazard = hazard;
    model.lane = model.rows[0]!.lane;
    model.start();
    until(model, 80);
    assert.ok(model.ended);
    assert.ok(model.durationMs >= 3000);
    const result = model.result();
    model.tick(1000);
    model.act('left');
    assert.deepEqual(model.result(), result);
    assert.ok(result.score <= maxScoreForDuration(result.durationMs));
  });
}

test('jump clears a low barrier, duck clears a high bar, neither clears a train', () => {
  for (const hazard of ['barrier', 'bar', 'train'] as Hazard[]) {
    const model = new RunnerModel(10);
    model.rows[0]!.hazard = hazard;
    model.lane = model.rows[0]!.lane;
    model.start();
    until(model, 65);
    model.act(hazard === 'bar' ? 'duck' : 'jump');
    until(model, 73);
    assert.equal(model.ended, hazard === 'train', hazard);
  }
});

test('long safe play collects coins, ramps speed, and respects the shared score ceiling', () => {
  const model = new RunnerModel(77);
  model.start();
  for (const row of model.rows.slice(0, 100)) {
    model.lane = row.coinLane;
    until(model, row.distance + 1);
    assert.ok(model.running);
    assert.ok(model.score <= model.durationMs / 1000 * MAX_SCORE_PER_SEC);
  }
  assert.equal(model.coins, 100);
  assert.equal(model.speed, GAME.MAX_SPEED);
  assert.equal(model.score, Math.floor(model.distance * GAME.SCORE_PER_METER) + 100 * GAME.COIN_VALUE);
});

test('a suspended tab cannot teleport the runner or create a score spike', () => {
  const model = new RunnerModel(1);
  model.start();
  model.tick(60_000);
  assert.equal(model.durationMs, 50);
  assert.ok(model.distance < 1);
  model.tick(Number.NaN);
  assert.equal(model.durationMs, 50);
});
