# BeaconCFF

A minimal local Bluetooth controller for the Adafruit Bluefruit 32u4 running
this repository's `firmware/beacon_firmware` sketch. No server or account is needed.

## Run on a phone

Use Node.js 22.13+ (Node 24 LTS recommended) and install dependencies:

```sh
npm ci
```

Bluetooth requires a **native development build on a physical phone**; Expo Go,
the iOS simulator, and the web preview cannot connect to the Beacon.
After adding/updating native dependencies or app plugins, regenerate native configuration:

```sh
npx expo prebuild --no-install
```

Build and install using your platform's native toolchain:

```sh
# Android: Android Studio/SDK and a JDK, with USB debugging enabled
npm run android -- --device

# iOS: Xcode and device signing
npm run ios -- --device
```

For subsequent JavaScript edits:

```sh
npm start
# Or debug over USB when not on the same Wi-Fi:
npx expo start --localhost
```

For a standalone Android release with the JavaScript bundled:

```sh
npx expo run:android --variant release
```

## Use

Connection controls are at the top, the manual LED toggle is in the middle, and
measurement controls and the CFF result are at the bottom. Each section has its
own status area, with space reserved so the buttons stay in place as text changes.

1. Power on the board with the Beacon firmware installed. It advertises as `BeaconCFF`.
2. Tap **Connect to Beacon** and grant Bluetooth permissions. On Android 11 and
   earlier, BLE scanning also requires location permission and Location enabled.
3. Tap **Start flickering · 10 Hz** to start the LED. The same button becomes
   **Stop LED**; tap it again to stop.
4. Tap **Start measurement** for a sweep starting at 55 Hz and decreasing by
   0.1 Hz every 100 ms (1 Hz per second). The button becomes **Stop**; press it when flicker is
   perceived. The frequency is hidden during the sweep; only after Stop does the
   LED stop and the app display **Your CFF** in Hz.
5. Tap **Disconnect** to release the Bluetooth connection. Disconnect is disabled
   during a measurement; stop the measurement first.

A new measurement clears the previous result. Other LED controls are disabled
during a measurement. Like the original app, frequency commands are issued every
100 ms without waiting for previous BLE acknowledgements. When Stop is pressed,
the app waits for outstanding writes before sending zero and reports the last
commanded frequency. Disconnects, backgrounding the app, failed writes, and
reaching the end of the sweep without pressing Stop do not produce a CFF.
The sweep stops before sending negative frequencies. Slow BLE acknowledgements
do not abort the sweep, but queued writes can delay the physical LED and Stop.
Phone timers and Bluetooth introduce timing jitter; exact stimulus timing and
physical LED frequency still require hardware verification.

The Android launcher uses an adaptive icon with an 18/108 inset on each side,
so the square artwork's side matches the circular mask's diameter. Only its
corners are cropped. The config plugin preserves this sizing across prebuilds. Icon changes require rebuilding and reinstalling the app;
a JavaScript reload alone does not update the launcher icon.

The app connects to the first nearby device named `BeaconCFF`. Power on one Beacon
at a time. Scanning times out after 10 seconds and can be retried. Disconnects are
shown on screen; tap Connect again to reconnect. The firmware blinks at 1 Hz on
disconnection, so disconnecting is not equivalent to sending Stop.

The commands use the Nordic UART service `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
and its write characteristic `6e400002-b5a3-f393-e0a9-e50e24dcca9e`.
Each command is two big-endian bytes containing frequency × 10: `00 64` starts
10 Hz and `00 00` stops. A successful BLE write confirms delivery, not a measured
LED frequency; verify the LED on the actual board.

## Checks

```sh
npm test
npx tsc --noEmit
npm run lint
```
