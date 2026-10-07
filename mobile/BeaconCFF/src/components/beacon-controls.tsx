import { useEffect, useRef, useState } from 'react';
import { AppState, Button, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findBeacon, frequencyCommand, SERVICE_UUID, START_10_HZ, STOP, WRITE_UUID } from '@/ble';
import { startSweep } from '@/sweep';

async function requestPermissions() {
  if (Platform.OS !== 'android') return;
  const permissions = Number(Platform.Version) >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  if (permissions.some((permission) => results[permission] !== PermissionsAndroid.RESULTS.GRANTED)) {
    throw new Error('Bluetooth permission is required. Allow it in Settings and try again.');
  }
}

export default function BeaconControls() {
  const managerRef = useRef<BleManager | null>(null);
  const scanRef = useRef<AbortController | null>(null);
  const disconnectRef = useRef<Subscription | null>(null);
  const busyRef = useRef(false);
  const sweepRef = useRef<ReturnType<typeof startSweep> | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [ledOn, setLedOn] = useState(false);
  const [cff, setCff] = useState<number | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Turn on your Beacon, then connect.');

  const [ledStatus, setLedStatus] = useState('LED stopped.');
  const [measurementStatus, setMeasurementStatus] = useState('Press Start measurement when ready.');

  useEffect(() => {
    let manager: BleManager;
    try {
      manager = new BleManager();
      managerRef.current = manager;
    } catch {
      // Report a missing native module when the user taps Connect.
      return;
    }
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') sweepRef.current?.cancel();
    });
    return () => {
      managerRef.current = null;
      appState.remove();
      scanRef.current?.abort();
      disconnectRef.current?.remove();
      const sweep = sweepRef.current;
      sweep?.cancel();
      void (sweep?.done ?? Promise.resolve()).catch(() => {}).then(() => manager.destroy()).catch(() => {});
    };
  }, []);

  async function connect() {
    const manager = managerRef.current;
    if (busyRef.current) return;
    if (!manager) {
      setConnectionStatus('Bluetooth is unavailable. Install a native development build on your phone.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    let connected: Device | null = null;
    try {
      await requestPermissions();
      if (await manager.state() !== State.PoweredOn) {
        throw new Error('Turn on Bluetooth and allow access, then try again.');
      }
      setConnectionStatus('Looking for BeaconCFF…');
      const controller = new AbortController();
      scanRef.current = controller;
      const found = await findBeacon(manager, controller.signal);
      setConnectionStatus('Connecting…');
      connected = await found.connect({ timeout: 10000 });
      disconnectRef.current?.remove();
      disconnectRef.current = connected.onDisconnected(() => {
        if (managerRef.current !== manager) return;
        sweepRef.current?.cancel();
        setDevice(null);
        setLedOn(false);
        setConnectionStatus('Beacon disconnected. Connect again to continue.');
      });
      connected = await connected.discoverAllServicesAndCharacteristics();
      // A successful stop write verifies the expected UART service before enabling Start.
      await connected.writeCharacteristicWithResponseForService(SERVICE_UUID, WRITE_UUID, STOP);
      if (managerRef.current !== manager || !await connected.isConnected()) return;
      setDevice(connected);
      setLedOn(false);
      setConnectionStatus('Connected to BeaconCFF.');
      setLedStatus('LED stopped.');
    } catch (error) {
      disconnectRef.current?.remove();
      if (connected) await connected.cancelConnection().catch(() => {});
      if (managerRef.current === manager) {
        setDevice(null);
        setConnectionStatus(error instanceof Error ? error.message : 'Could not connect to Beacon.');
      }
    } finally {
      scanRef.current = null;
      busyRef.current = false;
      if (managerRef.current === manager) setBusy(false);
    }
  }

  async function disconnect() {
    if (!device || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await device.cancelConnection();
      setDevice(null);
      setLedOn(false);
      setConnectionStatus('Beacon disconnected. Connect again to continue.');
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : 'Could not disconnect from Beacon.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function send(command: string) {
    if (!device || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await device.writeCharacteristicWithResponseForService(SERVICE_UUID, WRITE_UUID, command);
      if (await device.isConnected()) {
        setLedOn(command !== STOP);
        setLedStatus(command === STOP ? 'LED stopped.' : 'Flickering at 10 Hz.');
      }
    } catch (error) {
      setLedStatus(error instanceof Error ? error.message : 'Could not send the command.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function measure() {
    if (!device || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMeasuring(true);
    setCff(null);
    setLedOn(true);
    setLedStatus('LED controlled by measurement.');
    setMeasurementStatus('Measurement running. Press Stop when you see flickering.');
    const sweep = startSweep(
      async (hz) => device.writeCharacteristicWithResponseForService(SERVICE_UUID, WRITE_UUID, frequencyCommand(hz)),
    );
    sweepRef.current = sweep;
    try {
      const result = await sweep.done;
      if (!managerRef.current) return;
      setLedOn(false);
      setLedStatus('LED stopped.');
      setCff(result);
      setMeasurementStatus(result === null ? 'Measurement ended without a CFF. Please try again.' : 'Measurement complete. LED stopped.');
    } catch (error) {
      if (managerRef.current) {
        setLedStatus('LED state unknown. Try Stop LED.');
        setMeasurementStatus(`Measurement failed. ${error instanceof Error ? error.message : 'Check the connection.'}`);
      }
    } finally {
      sweepRef.current = null;
      busyRef.current = false;
      if (managerRef.current) {
        setBusy(false);
        setMeasuring(false);
      }
    }
  }

  function stopMeasurement() {
    sweepRef.current?.stop();
    setMeasuring(false);
    setMeasurementStatus('Stopping measurement…');
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Button title={device ? 'Disconnect' : 'Connect to Beacon'} disabled={busy} onPress={device ? disconnect : connect} />
          <Text style={styles.status} accessibilityLiveRegion="polite">{connectionStatus}</Text>
        </View>
        <View style={styles.section}>
          <Button title={ledOn ? 'Stop LED' : 'Start flickering · 10 Hz'} disabled={busy || !device} onPress={() => send(ledOn ? STOP : START_10_HZ)} />
          <Text style={styles.status} accessibilityLiveRegion="polite">{device ? ledStatus : 'Connect to control the LED.'}</Text>
        </View>
        <View style={styles.section}>
          <Button title={measuring ? 'Stop' : 'Start measurement'} disabled={!device || (busy && !measuring)} onPress={measuring ? stopMeasurement : measure} />
          <Text style={styles.result} accessibilityLiveRegion="polite">{cff !== null ? `Your CFF: ${cff.toFixed(1)} Hz` : ' '}</Text>
          <Text style={styles.status} accessibilityLiveRegion="polite">{measurementStatus}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flexGrow: 1, padding: 24, gap: 24 },
  // Equal slots keep the buttons at the same positions when status/results change.
  section: { flexGrow: 1, flexBasis: 0, minHeight: 180, gap: 12 },
  status: { fontSize: 16, lineHeight: 23, textAlign: 'center', color: '#444' },
  result: { fontSize: 22, lineHeight: 30, fontWeight: '600', textAlign: 'center' },
});
