#include "Adafruit_BLE.h"
#include "Adafruit_BluefruitLE_SPI.h"

#include "bluefruit_configuration.h"

#define FACTORYRESET_ENABLE         1
#define MINIMUM_FIRMWARE_VERSION    "0.6.6"
#define MODE_LED_BEHAVIOUR          "MODE"

Adafruit_BluefruitLE_SPI ble(BLUEFRUIT_SPI_CS, BLUEFRUIT_SPI_IRQ, BLUEFRUIT_SPI_RST);

int ble_command;
int ble_command_packets_read = 0;
int ble_command_msb;
int ble_command_lsb;

/*
 * Set up BLE communication including establishing connection
 */
void setupBleComm(void (*disconnected_callback)()) {
  Serial.begin(115200);

  /* Initialise the module */
  Serial.print(F("Initialising the Bluefruit LE module: "));

  if ( !ble.begin(VERBOSE_MODE) )
  {
    Serial.println(F("Couldn't find Bluefruit, make sure it's in CoMmanD mode & check wiring?"));
    while(1);
  }
  Serial.println( F("OK!") );

  if ( FACTORYRESET_ENABLE )
  {
    /* Perform a factory reset to make sure everything is in a known state */
    Serial.println(F("Performing a factory reset: "));
    if ( ! ble.factoryReset() ){
      Serial.println(F("Couldn't factory reset"));
      while(1);
    }
  }

  if (!ble.sendCommandCheckOK("AT+GAPDEVNAME=BeaconCFF")) {
    Serial.println(F("Bluetooth device name set fail :("));
    while(1);
  }
  Serial.println( F("Bluetooth device name set successful") );

  /* Disable command echo from Bluefruit */
  ble.echo(false);

  Serial.println("Requesting Bluefruit info:");
  /* Print Bluefruit information */
  ble.info();

  Serial.println(F("Please use Adafruit Bluefruit LE app to connect in UART mode"));
  Serial.println(F("Then Enter characters to send to Bluefruit"));
  Serial.println();

  ble.verbose(false);  // debug info is a little annoying after this point!

  /* Wait for connection */
  while (! ble.isConnected()) {
      delay(500);
  }

  // LED Activity command is only supported from 0.6.6
  if ( ble.isVersionAtLeast(MINIMUM_FIRMWARE_VERSION) )
  {
    // Change Mode LED Activity
    Serial.println(F("******************************"));
    Serial.println(F("Change LED activity to " MODE_LED_BEHAVIOUR));
    ble.sendCommandCheckOK("AT+HWModeLED=" MODE_LED_BEHAVIOUR);
    Serial.println(F("******************************"));
  }

  // Set module to DATA mode
  Serial.println( F("Switching to DATA mode!") );
  ble.setMode(BLUEFRUIT_MODE_DATA);

  ble.setDisconnectCallback(disconnected_callback);
}

/*
 * Read a command over BLE including assembling the full packet
 */
int readBleInput() {  
  ble_command = -1;

  if (ble.available()) {
    if (ble_command_packets_read == 0) {
      ble_command_lsb = ble.read();
      ble_command_packets_read++;

      // indicate that we're in the middle of a packet
      ble_command = -2;
    } else if (ble_command_packets_read == 1) {
      ble_command_msb = ble.read();
      ble_command_packets_read = 0;

      // assemble full packet
      ble_command = ble_command_msb | (ble_command_lsb << 8);
    }
  }

  return ble_command;
}

void bleUpdate() {
  ble.update(1000);
}
