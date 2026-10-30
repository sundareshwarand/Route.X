/**
 * RouteX - IoT Emergency Traffic Management System
 * TRAFFIC JUNCTION GATEWAY FIRMWARE (NodeMCU ESP8266 + LoRa SX1278 + OLED + Signal LEDs)
 * 
 * Hardware Pinout (Carefully verified for ESP8266 Bootstrapping & No GPIO Conflicts):
 * 
 * 1. LoRa SX1278 (Hardware HSPI Bus):
 *    - SCK   : GPIO 14 (D5)
 *    - MISO  : GPIO 12 (D6)
 *    - MOSI  : GPIO 13 (D7)
 *    - NSS   : GPIO 16 (D0)  [Safe, no boot constraints]
 *    - RST   : Tied to 3.3V or unmanaged
 *    - DIO0  : Not required (Polled in loop via LoRa.parsePacket())
 * 
 * 2. SSD1306 OLED Display 128x64 (I2C Bus):
 *    - SDA   : GPIO 4 (D2)
 *    - SCL   : GPIO 5 (D1)
 * 
 * 3. Prototype Traffic Signal Output LEDs (Boot-Safe Wiring):
 *    - Normal Red LED    : GPIO 15 (D8) [Active-HIGH, Must be LOW at boot -> Wired through 330 ohm to GND]
 *    - Normal Green LED  : GPIO 0  (D3) [Active-LOW,  Must be HIGH at boot -> Wired Anode to 3.3V through 330 ohm]
 *    - Priority Green LED: GPIO 2  (D4) [Active-LOW,  Must be HIGH at boot -> Wired Anode to 3.3V through 330 ohm]
 * 
 * Frequency: 433.0 MHz (Matching Ambulance Transmitter)
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <LoRa.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// Pin Definitions
#define PIN_LORA_SS   16 // D0
#define PIN_LED_RED   15 // D8 (Active-HIGH)
#define PIN_LED_GREEN 0  // D3 (Active-LOW)
#define PIN_LED_PRIO  2  // D4 (Active-LOW)

#define PIN_OLED_SDA  4  // D2
#define PIN_OLED_SCL  5  // D1

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Network & Gateway Identity
const char* WIFI_SSID     = "RouteX-Gateway-AP"; // Configure local Wi-Fi SSID
const char* WIFI_PASSWORD = "EmergencyTransit123";
// Central Public Cloud Backend (HTTPS production with local fallback)
const char* BACKEND_HOST  = "https://routex-api.onrender.com/api";

const char* JUNCTION_ID   = "JNC-01";
const char* HARDWARE_ID   = "ESP8266-JNC-01";
const char* DEVICE_KEY    = "dev-key-jnc-secret-001";

#define LORA_FREQUENCY 433E6

// Signal States
enum TrafficSignalState {
  STATE_NORMAL_CYCLE,
  STATE_PRIORITY_ACTIVE,
  STATE_SAFE_REVERSION
};

TrafficSignalState currentState = STATE_NORMAL_CYCLE;
String activeAmbulanceId = "";
String activeDirection = "NONE";
String activeRequestId = "";
uint32_t priorityEndTime = 0;
uint32_t lastHeartbeatTime = 0;
uint32_t lastServerPollTime = 0;
uint32_t lastNormalCycleToggle = 0;
bool normalGreenOn = true;

// Deduplication
String lastReceivedPacketId = "";
uint32_t lastReceivedSeq = 0;

void setSignalOutputs(bool redOn, bool greenOn, bool prioGreenOn) {
  // Red LED: Active-HIGH on GPIO 15
  digitalWrite(PIN_LED_RED, redOn ? HIGH : LOW);
  
  // Normal Green LED: Active-LOW on GPIO 0
  digitalWrite(PIN_LED_GREEN, greenOn ? LOW : HIGH);
  
  // Priority Green LED: Active-LOW on GPIO 2
  digitalWrite(PIN_LED_PRIO, prioGreenOn ? LOW : HIGH);
}

void updateOLED() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Top Status Bar
  display.setCursor(0, 0);
  display.print("ROUTEX: ");
  display.print(JUNCTION_ID);

  display.setCursor(85, 0);
  if (WiFi.status() == WL_CONNECTED) {
    display.print("WIFI OK");
  } else {
    display.print("NO NET");
  }

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  // Main State Box
  display.setCursor(0, 16);
  if (currentState == STATE_PRIORITY_ACTIVE) {
    display.setTextSize(1);
    display.print("PRIORITY ACTIVE: ");
    uint32_t remaining = (priorityEndTime > millis()) ? (priorityEndTime - millis()) / 1000 : 0;
    display.print(remaining);
    display.println("s");

    display.setTextSize(2);
    display.setCursor(0, 30);
    display.println(activeAmbulanceId);

    display.setTextSize(1);
    display.setCursor(0, 52);
    display.print("DIRECTION: ");
    display.println(activeDirection);
  } else {
    display.setTextSize(1);
    display.print("STATE: NORMAL CYCLE");

    display.setCursor(0, 32);
    display.println("Signal: AUTONOMOUS");
    display.setCursor(0, 44);
    display.print("Light: ");
    display.println(normalGreenOn ? "GREEN PASS" : "RED STOP");

    display.setCursor(0, 56);
    display.print("LoRa: 433MHz LISTENING");
  }

  display.display();
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(BACKEND_HOST) + "/hardware/heartbeat";

  StaticJsonDocument<200> doc;
  doc["hardware_id"] = HARDWARE_ID;
  doc["junction_id"] = JUNCTION_ID;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["uptime_seconds"] = millis() / 1000;
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["firmware_version"] = "1.0.0-CLOUD";

  String payload;
  serializeJson(doc, payload);

  if (url.startsWith("https://")) {
    http.begin(secureClient, url);
  } else {
    http.begin(plainClient, url);
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", HARDWARE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int httpCode = http.POST(payload);
  if (httpCode > 0) {
    Serial.printf("[HEARTBEAT] Sent OK (HTTP %d)\n", httpCode);
  } else {
    Serial.printf("[HEARTBEAT] Error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

void acknowledgeCommand(const String& reqId, const String& status, const String& signalState, const String& dir) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(BACKEND_HOST) + "/hardware/acknowledge";

  StaticJsonDocument<256> doc;
  doc["request_id"] = reqId;
  doc["junction_id"] = JUNCTION_ID;
  doc["status"] = status;
  doc["signal_state"] = signalState;
  doc["active_direction"] = dir;
  doc["execution_notes"] = "Hardware GPIO state updated safely on NodeMCU";
  doc["is_hardware_verified"] = true;

  String payload;
  serializeJson(doc, payload);

  if (url.startsWith("https://")) {
    http.begin(secureClient, url);
  } else {
    http.begin(plainClient, url);
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", HARDWARE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int httpCode = http.POST(payload);
  Serial.printf("[ACK] Server acknowledgment response: HTTP %d\n", httpCode);
  http.end();
}

void forwardLoRaEventToBackend(const String& loraJson, int rssi, float snr) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(BACKEND_HOST) + "/hardware/event";

  StaticJsonDocument<300> doc;
  DeserializationError err = deserializeJson(doc, loraJson);
  if (err) return;

  doc["junction_id"] = JUNCTION_ID;
  doc["rssi"] = rssi;
  doc["snr"] = snr;
  doc["crc_valid"] = true;
  doc["is_hardware_verified"] = true; // Verified physical reception

  String forwardPayload;
  serializeJson(doc, forwardPayload);

  if (url.startsWith("https://")) {
    http.begin(secureClient, url);
  } else {
    http.begin(plainClient, url);
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", HARDWARE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int httpCode = http.POST(forwardPayload);
  Serial.printf("[LORA -> BACKEND] Forwarded physical LoRa packet. Response: HTTP %d\n", httpCode);
  http.end();
}

void pollServerCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (currentState == STATE_PRIORITY_ACTIVE) return; // Do not interrupt existing active transit

  WiFiClientSecure secureClient;
  secureClient.setInsecure();
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(BACKEND_HOST) + "/hardware/pending/" + String(JUNCTION_ID);

  if (url.startsWith("https://")) {
    http.begin(secureClient, url);
  } else {
    http.begin(plainClient, url);
  }
  http.addHeader("X-Device-Id", HARDWARE_ID);
  http.addHeader("X-Device-Key", DEVICE_KEY);

  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<300> doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err && doc["has_command"] == true) {
      Serial.println("[COMMAND] Received pending priority command from backend!");
      activeRequestId = doc["request_id"].as<String>();
      activeAmbulanceId = doc["ambulance_id"].as<String>();
      activeDirection = doc["direction"].as<String>();
      int durationSec = doc["duration_seconds"] | 20;

      // Switch physical signal outputs safely
      currentState = STATE_PRIORITY_ACTIVE;
      priorityEndTime = millis() + (durationSec * 1000);
      setSignalOutputs(false, false, true); // Red OFF, Normal Green OFF, Priority Green ON
      updateOLED();

      // Report confirmation ACK back to server
      acknowledgeCommand(activeRequestId, "PRIORITY_ACTIVE", "PRIORITY_ACTIVE", activeDirection);
    }
  }
  http.end();
}

void activatePriorityFromLoRa(const String& ambId, const String& dir, const String& reqId) {
  activeAmbulanceId = ambId;
  activeDirection = dir;
  activeRequestId = reqId;
  currentState = STATE_PRIORITY_ACTIVE;
  priorityEndTime = millis() + (20 * 1000); // 20s default priority window

  // Physical outputs: Drive Priority Green
  setSignalOutputs(false, false, true);
  updateOLED();

  // Acknowledge priority activation to backend
  acknowledgeCommand(reqId, "PRIORITY_ACTIVE", "PRIORITY_ACTIVE", dir);
}

void revertToNormalCycle() {
  Serial.println("[SAFETY] Priority window lapsed. Executing safe reversion to normal cycle.");
  currentState = STATE_NORMAL_CYCLE;
  normalGreenOn = true;
  setSignalOutputs(false, true, false); // Normal Green ON, Priority Green OFF
  updateOLED();

  // Send terminal completion ACK
  if (activeRequestId.length() > 0) {
    acknowledgeCommand(activeRequestId, "COMPLETED", "NORMAL_CYCLE", activeDirection);
    activeRequestId = "";
    activeAmbulanceId = "";
    activeDirection = "NONE";
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  RouteX - Traffic Junction Gateway (NodeMCU ESP8266)  ");
  Serial.println("=======================================================");

  // Initialize GPIO outputs
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_PRIO, OUTPUT);

  // Initial safe state: Normal Green ON, Red OFF, Priority OFF
  setSignalOutputs(false, true, false);

  // Initialize I2C for SSD1306 OLED (Wire.begin(SDA, SCL))
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("[OLED] Warning: SSD1306 allocation failed, continuing without OLED.");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.println("RouteX Gateway");
    display.println("Initializing LoRa...");
    display.display();
  }

  // Initialize LoRa SX1278 (Hardware HSPI)
  LoRa.setPins(PIN_LORA_SS, -1, -1); // NSS on GPIO 16, RST/DIO0 handled in software
  Serial.print("[INIT] Initializing LoRa SX1278 HSPI at 433MHz... ");
  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("FAILED! Verify LoRa wiring on HSPI.");
  } else {
    LoRa.setSpreadingFactor(9);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(7);
    LoRa.enableCrc();
    Serial.println("SUCCESS.");
  }

  // Connect to Wi-Fi
  Serial.printf("[WIFI] Connecting to SSID '%s'...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Allow up to 10s for Wi-Fi connection, proceed autonomously if not found
  uint32_t startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt < 10000)) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! Gateway IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Running in Autonomous Local Mesh Mode (No Wi-Fi).");
  }

  updateOLED();
}

void loop() {
  // Feed ESP8266 Software Watchdog
  ESP.wdtFeed();

  uint32_t now = millis();

  // 1. Check for incoming LoRa Packets (Physical Ambulance Unit)
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();

    Serial.printf("\n[LoRa RX] Received %d bytes (RSSI: %d, SNR: %.1f dB):\n", packetSize, rssi, snr);
    Serial.println(incoming);

    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, incoming);
    if (!err) {
      String ambId = doc["amb"].as<String>();
      String dir   = doc["dir"].as<String>();
      String pktId = doc["id"].as<String>();
      uint32_t seq = doc["seq"] | 0;

      // Duplicate Check
      if (pktId != lastReceivedPacketId || seq != lastReceivedSeq) {
        lastReceivedPacketId = pktId;
        lastReceivedSeq = seq;

        // 1. Forward decoded event to RouteX backend (records request in RECEIVED state)
        forwardLoRaEventToBackend(incoming, rssi, snr);

        // 2. Activate Priority outputs on physical hardware and acknowledge PRIORITY_ACTIVE
        activatePriorityFromLoRa(ambId, dir, pktId);
      } else {
        Serial.println("[LoRa RX] Duplicate packet within active window ignored.");
      }
    }
  }

  // 2. Manage Priority Timeout & Safe Reversion
  if (currentState == STATE_PRIORITY_ACTIVE) {
    if (now >= priorityEndTime) {
      revertToNormalCycle();
    }
  } else {
    // Autonomous Normal Signal Rotation Cycle (Simulates regular traffic light timing: 8s green / 8s red)
    if (now - lastNormalCycleToggle >= 8000) {
      lastNormalCycleToggle = now;
      normalGreenOn = !normalGreenOn;
      setSignalOutputs(!normalGreenOn, normalGreenOn, false);
      updateOLED();
    }
  }

  // 3. Periodic Backend Polling for Web/Mobile originated commands (every 3 seconds)
  if (now - lastServerPollTime >= 3000) {
    lastServerPollTime = now;
    pollServerCommands();
  }

  // 4. Periodic Heartbeat Telemetry (every 30 seconds)
  if (now - lastHeartbeatTime >= 30000) {
    lastHeartbeatTime = now;
    sendHeartbeat();
  }

  // 5. Update OLED UI display periodically
  static uint32_t lastOledUpdate = 0;
  if (now - lastOledUpdate >= 1000) {
    lastOledUpdate = now;
    updateOLED();
  }

  delay(20);
}
