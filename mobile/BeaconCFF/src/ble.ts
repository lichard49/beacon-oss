import type { BleManager, Device } from 'react-native-ble-plx';
import { fromByteArray } from 'base64-js';

export const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const WRITE_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
// Firmware expects frequency × 10 as two big-endian bytes, passed to BLE as Base64.
export const START_10_HZ = 'AGQ='; // [0x00, 0x64] = 100
export const STOP = 'AAA='; // [0x00, 0x00]

export function frequencyCommand(hz: number) {
  if (!Number.isFinite(hz) || hz < 0 || hz > 55) throw new Error('Frequency must be between 0 and 55 Hz.');
  const value = Math.round(hz * 10);
  return fromByteArray(new Uint8Array([value >> 8, value & 0xff]));
}

export async function findBeacon(
  manager: Pick<BleManager, 'startDeviceScan' | 'stopDeviceScan'>,
  signal: AbortSignal,
  timeoutMs = 10000,
): Promise<Device> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  try {
    return await new Promise<Device>((resolve, reject) => {
      cancel = () => reject(new Error('Scan cancelled.'));
      if (signal.aborted) return cancel();
      signal.addEventListener('abort', cancel);
      timer = setTimeout(() => reject(new Error('BeaconCFF not found. Check its power and try again.')), timeoutMs);
      // Bluefruit may advertise its name without the UART UUID, so scan without a service filter.
      manager.startDeviceScan(null, null, (error, device) => {
        if (error) reject(error);
        else if (device?.localName === 'BeaconCFF' || device?.name === 'BeaconCFF') resolve(device);
      }).catch(reject);
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
    await manager.stopDeviceScan();
  }
}
