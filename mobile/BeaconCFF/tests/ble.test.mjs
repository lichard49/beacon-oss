import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findBeacon, START_10_HZ, STOP } from '../src/ble.ts';

// Decode exactly as readBleInput() and loop() in the firmware do.
test('commands are two big-endian bytes in tenths of a Hz', () => {
  for (const [command, hz] of [[START_10_HZ, 10], [STOP, 0]]) {
    const bytes = Buffer.from(command, 'base64');
    assert.equal(bytes.length, 2);
    assert.equal(((bytes[0] << 8) | bytes[1]) / 10, hz);
  }
});

function scanner(scan) {
  return {
    stopped: 0,
    async startDeviceScan(_services, _options, callback) { scan(callback); },
    async stopDeviceScan() { this.stopped++; },
  };
}

test('ignores other devices, matches BeaconCFF, and stops scanning', async () => {
  const beacon = { localName: 'BeaconCFF', id: 'beacon' };
  const manager = scanner((callback) => {
    callback(null, { name: 'Other' });
    callback(null, beacon);
  });
  assert.equal(await findBeacon(manager, new AbortController().signal), beacon);
  assert.equal(manager.stopped, 1);
});

test('uses device name when local name is unavailable', async () => {
  const beacon = { name: 'BeaconCFF' };
  const manager = scanner((callback) => callback(null, beacon));
  assert.equal(await findBeacon(manager, new AbortController().signal), beacon);
});

test('times out and stops scanning', async () => {
  const manager = scanner(() => {});
  await assert.rejects(findBeacon(manager, new AbortController().signal, 1), /not found/);
  assert.equal(manager.stopped, 1);
});

test('reports scan errors and stops scanning', async () => {
  const manager = scanner((callback) => callback(new Error('Bluetooth off'), null));
  await assert.rejects(findBeacon(manager, new AbortController().signal), /Bluetooth off/);
  assert.equal(manager.stopped, 1);
});

test('unmount cancellation stops scanning', async () => {
  const controller = new AbortController();
  const manager = scanner(() => {});
  const result = findBeacon(manager, controller.signal);
  controller.abort();
  await assert.rejects(result, /cancelled/);
  assert.equal(manager.stopped, 1);
});
