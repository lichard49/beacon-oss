# Beacon Firmware

The firmware runs on the microcontroller and is developed in the Arduino IDE.

Make sure to configure the LED pin in `beacon_firmware.ino` by defining the `led_pin` variable.
Any GPIO can be used to drive the LED.

Also be aware that the device's BLE name is defined in `ble_communications.ino`.
