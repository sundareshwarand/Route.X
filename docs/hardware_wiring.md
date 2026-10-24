# RouteX Hardware Wiring & Electrical Integration Guide

## 1. Architectural Overview

RouteX integrates a physical emergency vehicle unit (ESP32) and a municipal traffic junction controller unit (NodeMCU ESP8266). Local vehicle-to-infrastructure communication is handled via Long Range (LoRa) 433 MHz SX1278 transceivers, completely decoupled from local Wi-Fi and backend cloud networking.

---

## 2. Ambulance Unit: ESP32 DevKit v1

### 2.1 Microcontroller & Operating Voltage
- **Core**: ESP-WROOM-32 (32-bit dual-core, 240 MHz).
- **Operating Voltage**: 3.3 V logic levels. Powered via 5 V micro-USB or regulated 3.3 V rail.
- **Transceiver**: Semtech SX1278 LoRa Module (SPI Bus).

### 2.2 Pinout Table

| ESP32 GPIO Pin | Function / Target Module Pin | Electrical Configuration | Description |
|:---|:---|:---|:---|
| **GPIO 32** | Push Button 1 (LEFT) | `INPUT_PULLUP` (Active-LOW) | Connects to tactile switch; other side to GND. |
| **GPIO 33** | Push Button 2 (STRAIGHT) | `INPUT_PULLUP` (Active-LOW) | Connects to tactile switch; other side to GND. |
| **GPIO 25** | Push Button 3 (RIGHT) | `INPUT_PULLUP` (Active-LOW) | Connects to tactile switch; other side to GND. |
| **GPIO 26** | Status Indicator LED | Output (`Active-HIGH`) | In series with 330 Ω resistor to LED anode; cathode to GND. |
| **GPIO 18** | SX1278 `SCK` | SPI Clock | Connects to LoRa module SCK. |
| **GPIO 19** | SX1278 `MISO` | SPI Master In / Slave Out | Connects to LoRa module MISO. |
| **GPIO 23** | SX1278 `MOSI` | SPI Master Out / Slave In | Connects to LoRa module MOSI. |
| **GPIO 5** | SX1278 `NSS` (CS) | SPI Chip Select | Connects to LoRa module NSS. |
| **GPIO 14** | SX1278 `RST` | Reset | Connects to LoRa module RST. |
| **GPIO 2** | SX1278 `DIO0` | Interrupt / Packet Ready | Connects to LoRa module DIO0. |
| **3V3** | SX1278 `VCC` | Power (3.3 V only) | Do NOT connect to 5 V. Add 10 µF electrolytic + 100 nF ceramic capacitor nearby. |
| **GND** | SX1278 `GND` | Ground Reference | Common ground with ESP32. |

---

## 3. Junction Gateway: NodeMCU ESP8266

### 3.1 Conflict Resolution & Boot-Strapping Engineering

> [!IMPORTANT]
> **Resolution of ESP8266 Pin Conflicts**:
> In standard ESP8266 hardware, **GPIO 12 (D6)** and **GPIO 13 (D7)** are required for the Hardware SPI (HSPI) bus (`MISO` and `MOSI`). They **cannot** simultaneously drive traffic light LEDs.
>
> Furthermore, the ESP8266 requires strict voltage levels on its strapping pins during power-up:
> 1. **GPIO 15 (D8)**: Must be **LOW** at boot to boot from SPI flash.
> 2. **GPIO 0 (D3)**: Must be **HIGH** at boot (pulling LOW enters UART download mode).
> 3. **GPIO 2 (D4)**: Must be **HIGH** at boot (connected to TXD1 / onboard LED).
> 4. **GPIO 16 (D0)**: No boot constraints; ideal for Chip Select.

### 3.2 Conflict-Free Pin Allocation

```
                        +----------------------+
                        |   NodeMCU ESP8266    |
                        +----------------------+
   [OLED I2C]           |                      |  [LoRa SX1278 HSPI]
   GPIO 5 (D1) -------->| SCL                  |
   GPIO 4 (D2) -------->| SDA             MOSI |--------> GPIO 13 (D7)
                        |                 MISO |--------> GPIO 12 (D6)
   [Prototype LEDs]     |                  SCK |--------> GPIO 14 (D5)
   GPIO 15 (D8) ------->| RED (Active-HIGH) CS |--------> GPIO 16 (D0)
   GPIO 0  (D3) ------->| GRN (Active-LOW)     |
   GPIO 2  (D4) ------->| PRIO (Active-LOW)    |
                        +----------------------+
```

| Pin (NodeMCU Label) | Function | Boot State Required | Circuit Implementation |
|:---|:---|:---|:---|
| **GPIO 14 (D5)** | LoRa `SCK` | Floating | Direct SPI clock connection to SX1278 SCK. |
| **GPIO 12 (D6)** | LoRa `MISO` | Floating | Direct SPI data connection to SX1278 MISO. |
| **GPIO 13 (D7)** | LoRa `MOSI` | Floating | Direct SPI data connection to SX1278 MOSI. |
| **GPIO 16 (D0)** | LoRa `NSS` (CS) | Neutral (Wakeup pin) | Direct chip-select connection to SX1278 NSS. |
| **GPIO 4 (D2)** | SSD1306 `SDA` | Neutral | I2C Data line (with 4.7 kΩ pull-up to 3.3 V on OLED module). |
| **GPIO 5 (D1)** | SSD1306 `SCL` | Neutral | I2C Clock line (with 4.7 kΩ pull-up to 3.3 V on OLED module). |
| **GPIO 15 (D8)** | Normal Red LED | **Must be LOW** | **Active-HIGH Circuit**: Connect GPIO 15 -> Anode of Red LED -> 330 Ω resistor -> GND. At boot, pin is pulled LOW, turning LED OFF and satisfying bootloader! Firmware writes `HIGH` to light LED. |
| **GPIO 0 (D3)** | Normal Green LED | **Must be HIGH** | **Active-LOW Circuit**: Connect 3.3 V rail -> 330 Ω resistor -> Anode of Green LED -> Cathode to GPIO 0. NodeMCU's onboard 10 kΩ pull-up keeps pin HIGH at boot, satisfying bootloader! Firmware writes `LOW` to light LED. |
| **GPIO 2 (D4)** | Emergency Priority Green LED | **Must be HIGH** | **Active-LOW Circuit**: Connect 3.3 V rail -> 330 Ω resistor -> Anode of Priority Green LED -> Cathode to GPIO 2. Onboard 10 kΩ pull-up keeps pin HIGH at boot! Firmware writes `LOW` to light LED. |

---

## 4. Electrical Protection & RF Best Practices

1. **Antenna Requirement**:
   - Never power the SX1278 transceiver without a 433 MHz tuned antenna connected (SMA whip or calibrated 17.3 cm spring helical wire). Operating without an antenna creates impedance reflection that can destroy the RF power amplifier.
2. **Decoupling Capacitors**:
   - The SX1278 draws peak pulses of up to 120 mA during transmission. Place a 100 µF electrolytic capacitor and a 100 nF ceramic capacitor directly across the VCC and GND pins of the LoRa module.
3. **Power Rails**:
   - NodeMCU 3.3 V LDO output (AMS1117-3.3) provides ~800 mA, which comfortably powers the ESP8266 (peak 250 mA), SX1278 (peak 120 mA), and OLED display (peak 25 mA). Ensure the 5 V USB supply provides at least 1.5 A.

---

## 5. Physical Hardware Verification Checklist

Follow this checklist prior to testing with live hardware:

- [ ] Check with multimeter that VCC to LoRa SX1278 is strictly 3.3 V (not 5 V).
- [ ] Verify antenna is securely screwed into the SMA connector on both modules.
- [ ] Connect ESP32 to USB; press LEFT button and observe Serial Monitor at 115200 baud for JSON output:
  `{"ver":1,"id":"...","amb":"AMB-01","dir":"LEFT","seq":1,"ts":...,"jnc":"JNC-01"}`
- [ ] Observe NodeMCU OLED display: shows `ROUTEX: JNC-01`, `WIFI OK`, and `LoRa: 433MHz LISTENING`.
- [ ] Press STRAIGHT button on ESP32:
  - NodeMCU displays `PRIORITY ACTIVE: 20s`, `AMB-01`, `DIRECTION: STRAIGHT`.
  - Priority Green LED (`GPIO 2`) illuminates.
  - Normal Green LED (`GPIO 0`) extinguishes.
- [ ] Verify packet forwarded to backend server: check RouteX web dashboard at `http://localhost:5173`.
- [ ] Verify safe reversion: wait 20 seconds without transmitting; verify Priority Green LED turns OFF, Normal Green LED turns ON, and OLED reverts to `STATE: NORMAL CYCLE`.
- [ ] Disconnect Wi-Fi router to test watchdog: verify NodeMCU continues cycling normal signal autonomously without crash or watchdog lockup.
