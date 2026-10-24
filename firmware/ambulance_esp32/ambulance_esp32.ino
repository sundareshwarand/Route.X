/**
 * RouteX - IoT Emergency Traffic Management System
 * AMBULANCE UNIT FIRMWARE (ESP32 DevKit v1 + SX1278 LoRa)
 * 
 * Hardware Pinout:
 * - BUTTON_LEFT     : GPIO 32 (Active-LOW, Internal Pull-Up)
 * - BUTTON_STRAIGHT : GPIO 33 (Active-LOW, Internal Pull-Up)
 * - BUTTON_RIGHT    : GPIO 25 (Active-LOW, Internal Pull-Up)
 * - STATUS_LED      : GPIO 26 (Active-HIGH, Blinks on TX / ACK)
 * 
 * LoRa SX1278 (SPI Bus):
 * - SCK   : GPIO 18
 * - MISO  : GPIO 19
 * - MOSI  : GPIO 23
 * - NSS   : GPIO 5
 * - RST   : GPIO 14
 * - DIO0  : GPIO 2
 * 
 * Frequency: 433.0 MHz (or 868.0 / 915.0 MHz per regional ISM regulations)
 * Bandwidth: 125 kHz, Spreading Factor: 9, Coding Rate: 4/7
 */

#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>

// Hardware Pin Definitions
#define PIN_BTN_LEFT     32
#define PIN_BTN_STRAIGHT 33
#define PIN_BTN_RIGHT    25
#define PIN_STATUS_LED   26

// LoRa Pins
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_SS    5
#define LORA_RST   14
#define LORA_DIO0  2

#define LORA_FREQUENCY 433E6 // 433.0 MHz ISM band

// Ambulance Configuration
const char* AMBULANCE_ID = "AMB-01";
const char* PROTOCOL_VERSION = "ROUTEX_V1";
const char* TARGET_JUNCTION = "JNC-01";

// State & Debounce Tracking
uint32_t sequenceNumber = 1;
uint32_t lastDebounceTime = 0;
const uint32_t DEBOUNCE_DELAY_MS = 250;

// Simple CRC16 for Packet Verification
uint16_t calculateCRC16(const uint8_t* data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= (uint16_t)data[i];
    for (uint8_t j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return crc;
}

void blinkStatusLED(int count, int durationMs) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    delay(durationMs);
    digitalWrite(PIN_STATUS_LED, LOW);
    delay(durationMs);
  }
}

void transmitPriorityRequest(const char* direction) {
  digitalWrite(PIN_STATUS_LED, HIGH);

  // Generate unique packet UUID string
  char packetId[20];
  snprintf(packetId, sizeof(packetId), "lora-%lu-%lu", (unsigned long)sequenceNumber, (unsigned long)millis());

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["ver"] = 1;
  doc["id"] = packetId;
  doc["amb"] = AMBULANCE_ID;
  doc["dir"] = direction;
  doc["seq"] = sequenceNumber++;
  doc["ts"]  = millis();
  doc["jnc"] = TARGET_JUNCTION;
  doc["junction_id"] = TARGET_JUNCTION;

  String output;
  serializeJson(doc, output);

  // Calculate CRC16 over serialized string
  uint16_t crc = calculateCRC16((const uint8_t*)output.c_str(), output.length());
  doc["crc"] = crc;

  String finalPayload;
  serializeJson(doc, finalPayload);

  Serial.println("\n[LoRa TX] Broadcasting Priority Request Packet:");
  Serial.println(finalPayload);

  // Transmit over LoRa SX1278
  LoRa.beginPacket();
  LoRa.print(finalPayload);
  LoRa.endPacket();

  digitalWrite(PIN_STATUS_LED, LOW);
  blinkStatusLED(2, 60); // 2 quick confirmation blinks
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==============================================");
  Serial.println("  RouteX - Ambulance Physical Unit (ESP32)   ");
  Serial.println("==============================================");

  // Configure Button Inputs with Internal Pull-Ups
  pinMode(PIN_BTN_LEFT, INPUT_PULLUP);
  pinMode(PIN_BTN_STRAIGHT, INPUT_PULLUP);
  pinMode(PIN_BTN_RIGHT, INPUT_PULLUP);

  // Configure LED Indicator
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  // Initialize SPI & LoRa
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  Serial.print("[INIT] Initializing SX1278 LoRa at 433MHz... ");
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("FAILED! Check wiring and 3.3V power.");
    while (true) {
      blinkStatusLED(1, 500); // Continuous slow blink on hardware failure
    }
  }

  // Set LoRa Radio Parameters
  LoRa.setTxPower(17);          // 17 dBm output power
  LoRa.setSpreadingFactor(9);   // SF9 for balanced range and latency
  LoRa.setSignalBandwidth(125E3); // 125 kHz
  LoRa.setCodingRate4(7);       // 4/7 coding rate for error recovery
  LoRa.enableCrc();

  Serial.println("SUCCESS.");
  Serial.printf("[READY] Vehicle ID: %s | Target: %s\n", AMBULANCE_ID, TARGET_JUNCTION);
  Serial.println("Press Physical Button (LEFT / STRAIGHT / RIGHT) to transmit.");

  blinkStatusLED(3, 100); // 3 rapid blinks for ready status
}

void loop() {
  // Read Buttons (Active-LOW)
  bool leftPressed     = (digitalRead(PIN_BTN_LEFT) == LOW);
  bool straightPressed = (digitalRead(PIN_BTN_STRAIGHT) == LOW);
  bool rightPressed    = (digitalRead(PIN_BTN_RIGHT) == LOW);

  uint32_t now = millis();
  if ((leftPressed || straightPressed || rightPressed) && (now - lastDebounceTime > DEBOUNCE_DELAY_MS)) {
    lastDebounceTime = now;

    if (leftPressed) {
      Serial.println("[INPUT] Physical Button LEFT Pressed");
      transmitPriorityRequest("LEFT");
    } else if (straightPressed) {
      Serial.println("[INPUT] Physical Button STRAIGHT Pressed");
      transmitPriorityRequest("STRAIGHT");
    } else if (rightPressed) {
      Serial.println("[INPUT] Physical Button RIGHT Pressed");
      transmitPriorityRequest("RIGHT");
    }

    // Delay to prevent immediate re-trigger while holding button
    delay(400);
  }

  // Small delay for CPU yield
  delay(20);
}
