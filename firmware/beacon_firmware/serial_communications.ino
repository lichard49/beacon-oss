int serial_command;

/*
 * Set up serial communication
 */
void setupSerialComm() {
  while (!Serial);
  Serial.begin(115200);
}

/*
 * Read a command over serial
 */
int readSerialInput() {
  if (Serial.available()) {
    serial_command = Serial.parseInt();
  } else {
    serial_command = -1;
  }

  return serial_command;
}
