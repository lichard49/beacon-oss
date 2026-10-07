import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startSweep } from '../src/sweep.ts';
import { frequencyCommand } from '../src/ble.ts';

const flush = () => new Promise(setImmediate);

test('frequency encoding preserves 0.1 Hz steps across both bytes', () => {
  for (const hz of [55, 54.9, 25.6, 25.5, 10, 0.1, 0]) {
    assert.equal(Buffer.from(frequencyCommand(hz), 'base64').readUInt16BE() / 10, hz);
  }
  for (const hz of [-1, NaN, Infinity, 56]) assert.throws(() => frequencyCommand(hz));
});

test('starts at 55, decrements every 100 ms, and records the stop frequency', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const writes = [];
  const sweep = startSweep(async (hz) => { writes.push(hz); });
  await flush();
  t.mock.timers.tick(99);
  assert.deepEqual(writes, [55]);
  t.mock.timers.tick(1);
  await flush();
  assert.deepEqual(writes, [55, 54.9]);
  sweep.stop();
  assert.equal(await sweep.done, 54.9);
  t.mock.timers.tick(1000);
  assert.deepEqual(writes, [55, 54.9, 0]);
});

test('Stop drains an in-flight write before zero; no frequency can follow Stop', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const writes = [];
  let acknowledge;
  const sweep = startSweep((hz) => {
    writes.push(hz);
    return hz === 0 ? Promise.resolve() : new Promise((resolve) => { acknowledge = resolve; });
  });
  sweep.stop();
  sweep.stop();
  t.mock.timers.tick(500);
  assert.deepEqual(writes, [55]);
  acknowledge();
  assert.equal(await sweep.done, 55);
  assert.deepEqual(writes, [55, 0]);
});

test('failed frequency or stop writes never produce a CFF', async () => {
  for (const failAt of [55, 0]) {
    const writes = [];
    const sweep = startSweep(async (hz) => {
      writes.push(hz);
      if (hz === failAt) throw new Error('Disconnected');
    });
    const result = assert.rejects(sweep.done, /Disconnected/);
    sweep.stop();
    await result;
    assert.deepEqual(writes, [55, 0]);
  }
});

test('cancellation gives no CFF and reaching zero never wraps to a negative command', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const cancelled = startSweep(async () => {});
  cancelled.cancel();
  assert.equal(await cancelled.done, null);
  const writes = [];
  const sweep = startSweep(async (hz) => { writes.push(hz); });
  await flush();
  for (let step = 0; step < 550; step++) {
    t.mock.timers.tick(100);
    await flush();
  }
  assert.equal(await sweep.done, null);
  assert.equal(writes.length, 551);
  assert.equal(writes[10], 54); // After 1 second.
  assert.equal(writes[140], 41); // After 14 seconds.
  assert.equal(writes[300], 25); // After 30 seconds.
  assert.deepEqual(writes.slice(-3), [0.2, 0.1, 0]);
});

test('slow acknowledgements do not interrupt the cadence, and Stop drains every write', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const acknowledge = [];
  const writes = [];
  const sweep = startSweep((hz) => {
    writes.push(hz);
    return hz === 0 ? Promise.resolve() : new Promise((resolve) => { acknowledge.push(resolve); });
  });
  t.mock.timers.tick(200);
  assert.deepEqual(writes, [55, 54.9, 54.8]);
  sweep.stop();
  acknowledge[2]();
  acknowledge[1]();
  await flush();
  assert.deepEqual(writes, [55, 54.9, 54.8]);
  acknowledge[0]();
  assert.equal(await sweep.done, 54.8);
  t.mock.timers.tick(500);
  assert.deepEqual(writes, [55, 54.9, 54.8, 0]);
});
