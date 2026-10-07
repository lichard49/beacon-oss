const uint8_t led_pin = 13;

const float led_flicker_frequency_default = 100;
const float disconnected_flicker_frequency = 1;

enum CommunicationMode {
  SERIAL_MODE,
  BLE_MODE
} communication_mode;

int command;

void setup() {
  // turn on LED to show device is on
  setupLed(led_pin);
  setLedFlickerFrequency(led_flicker_frequency_default);
  startLed();

  // set up communications
  communication_mode = BLE_MODE;

  if (communication_mode == SERIAL_MODE) {
    setupSerialComm();
  } else if (communication_mode == BLE_MODE) {
    setupBleComm(disconnected);
  }

  // turn off LED to show device is connected
  stopLed();
}

void loop() {
  if (communication_mode == SERIAL_MODE) {
    command = readSerialInput();
  } else if (communication_mode == BLE_MODE) {
    command = readBleInput();
  }

  if (command == -2) {
    // in the middle of a packet, don't allow interrupt
    command = -1;
  } else if (communication_mode == BLE_MODE) {
    bleUpdate();
  }

  if (command != -1) {
    Serial.println(command);
  }

  switch (command) {
    case -1:
      // no incoming communications, ignore...
      break;
    case 0:
      stopLed();
      break;
    default:
      setLedFlickerFrequency(command / 10.0);
      startLed();
      break;
  }

}

void disconnected() {
  Serial.println("bye");
  stopLed();
  setLedFlickerFrequency(disconnected_flicker_frequency);
  startLed();
}
