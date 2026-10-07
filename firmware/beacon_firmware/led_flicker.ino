// resolve the Arduino pin once for fast writes in the timer interrupts
volatile uint8_t *my_led_port;
uint8_t my_led_mask;

// always start timer 1's counter from 0 to reset
const uint16_t timer1_counter_start = 0;

// flag for requesting a new frequency
// (can only be set at the end of a tick-tock)
volatile bool update_frequency = false;
// the requested new frequency
int new_frequency;

// state of LED (flickering or not)
bool flickering = false;

/*
 * Set up the LED pin for output and associated timers needed for flickering
 */
void setupLed(uint8_t led_pin) {
  my_led_port = portOutputRegister(digitalPinToPort(led_pin));
  my_led_mask = digitalPinToBitMask(led_pin);
  pinMode(led_pin, OUTPUT);

  // set timer 1 mode
  TCCR1A = 0;

  // reset timer 1's counter
  TCNT1 = timer1_counter_start;

  // enable timer 1's comparison interrupts
  TIMSK1 = (1 << OCIE1A) | (1 << OCIE1B);

  // enable interrupts
  interrupts();
}

/*
 * First timer interrupt (comparison A)
 */
ISR(TIMER1_COMPA_vect) {
  // Turn off the active-high LED without changing other pins.
  *my_led_port &= ~my_led_mask;
}

/*
 * Second timer interrupt (comparison B)
 */
ISR(TIMER1_COMPB_vect) {
  // Turn on the active-high LED without changing other pins.
  *my_led_port |= my_led_mask;

  // reset
  TCNT1 = timer1_counter_start;

  if (update_frequency) {
    update_frequency = false;
    OCR1A = int(round(31250 / new_frequency));
    OCR1B = int(round(62500 / new_frequency));
  }
}

/*
 * Requests a new frequency by setting appropriate flag and saving new frequency
 */
void setLedFlickerFrequency(float frequency) {
  update_frequency = true;
  new_frequency = 2 * frequency;
}

/*
 * Start LED if it's not already running by setting the prescaler
 */
void startLed() {
  if (!flickering) {
    flickering = true;

    // set prescaler to 256 (each tick is 16 MHz / 256)
    TCCR1B |= (1 << CS12);
    TCCR1B &= ~(1 << CS11);
    TCCR1B &= ~(1 << CS10);
  }
}

/*
 * Stop LED if it's already running by disabling the prescaler
 */
void stopLed() {
  Serial.println("stop led");
  *my_led_port &= ~my_led_mask;

  if (flickering) {
    flickering = false;
  
    // set prescaler to 256 (each tick is 16 MHz / 256)
    TCCR1B &= ~(1 << CS12);
    TCCR1B &= ~(1 << CS11);
    TCCR1B &= ~(1 << CS10);
  }
}

bool isFlickering() {
  return flickering;
}
