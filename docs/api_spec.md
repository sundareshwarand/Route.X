# RouteX REST & WebSocket API Specification

Base URL: `http://localhost:8000/api`  
WebSocket URL: `ws://localhost:8000/ws`

---

## 1. Authentication (`/api/auth`)

### 1.1 Login (OAuth2 Form)
- **POST** `/auth/login`
- **Body**: `username` (email), `password`
- **Response** `200 OK`:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "uuid",
      "email": "operator@routex.org",
      "full_name": "Traffic Operations Commander",
      "role": "operator",
      "is_active": true
    }
  }
  ```

### 1.2 Login (JSON)
- **POST** `/auth/login/json`
- **Body**: `{"email": "driver1@routex.org", "password": "driver123"}`

### 1.3 User Profile
- **GET** `/auth/me`
- **Headers**: `Authorization: Bearer <token>`

---

## 2. Emergency Coordination (`/api/emergency`)

### 2.1 Submit Emergency Priority Request
- **POST** `/emergency/request`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "ambulance_id": "AMB-01",
    "junction_id": "JNC-01",
    "direction": "STRAIGHT",
    "duration_seconds": 20,
    "source": "MOBILE_APP"
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "id": "req-uuid-1234",
    "ambulance_id": "AMB-01",
    "junction_id": "JNC-01",
    "direction": "STRAIGHT",
    "status": "PENDING",
    "source": "MOBILE_APP",
    "duration_seconds": 20,
    "is_verified_hardware": false,
    "requested_at": "2026-10-19T04:00:00Z",
    "expires_at": "2026-10-19T04:00:20Z"
  }
  ```

### 2.2 List Requests
- **GET** `/emergency/requests?ambulance_id=AMB-01&status=PRIORITY_ACTIVE`

### 2.3 Cancel Request & Revert Signal
- **POST** `/emergency/requests/{id}/cancel`
- **Body**: `{"cancellation_reason": "Operator cleared transit corridor"}`

---

## 3. Hardware Gateway (`/api/hardware`)

### 3.1 NodeMCU Forward Decoded LoRa Packet
- **POST** `/hardware/event`
- **Headers**: `X-Device-Id: ESP8266-JNC-01`, `X-Device-Key: dev-key-jnc-secret-001`
- **Body**:
  ```json
  {
    "ver": 1,
    "id": "lora-pkt-uuid",
    "amb": "AMB-01",
    "dir": "LEFT",
    "seq": 42,
    "ts": 128900,
    "junction_id": "JNC-01",
    "rssi": -65,
    "snr": 9.2,
    "crc_valid": true,
    "is_hardware_verified": true
  }
  ```

### 3.2 Poll Pending Commands (NodeMCU)
- **GET** `/hardware/pending-commands/{junction_id}`
- **Response** `200 OK`:
  ```json
  {
    "has_command": true,
    "request_id": "req-uuid-1234",
    "ambulance_id": "AMB-01",
    "direction": "STRAIGHT",
    "duration_seconds": 20,
    "expires_at": "2026-10-19T04:00:20Z",
    "command_type": "ACTIVATE_PRIORITY"
  }
  ```

### 3.3 Acknowledge Signal Output Transition
- **POST** `/hardware/acknowledge`
- **Body**:
  ```json
  {
    "request_id": "req-uuid-1234",
    "junction_id": "JNC-01",
    "status": "PRIORITY_ACTIVE",
    "signal_state": "PRIORITY_ACTIVE",
    "active_direction": "STRAIGHT",
    "execution_notes": "GPIO2 Driven LOW -> Priority Green Active",
    "is_hardware_verified": true
  }
  ```

### 3.4 Hardware Heartbeat
- **POST** `/hardware/heartbeat`
- **Body**:
  ```json
  {
    "hardware_id": "ESP8266-JNC-01",
    "junction_id": "JNC-01",
    "ip_address": "192.168.1.150",
    "free_heap": 28400,
    "uptime_seconds": 3600,
    "wifi_rssi": -55,
    "firmware_version": "1.0.0-PROTOTYPE"
  }
  ```

---

## 4. Nearby Vehicle Advisories (`/api/alerts`)

- **GET** `/alerts?zone=ZONE-CENTRAL`: List advisory alerts
- **GET** `/alerts/active`: List only unexpired alerts
- **POST** `/alerts/test-broadcast`: Trigger manual test advisory

---

## 5. Junctions & Routing (`/api/junctions`)

- **GET** `/junctions`: List all registered traffic intersections
- **POST** `/junctions/route/shortest-path`: Compute shortest corridor via Dijkstra
  - **Body**: `{"start_junction_id": "JNC-01", "destination_junction_id": "JNC-05"}`

---

## 6. Live WebSockets (`/ws`)

Connect to `ws://localhost:8000/ws` for real-time operations event broadcast:
- `EMERGENCY_REQUEST_CREATED`
- `LORA_EVENT_RECEIVED`
- `SIGNAL_STATE_CHANGED`
- `NEARBY_ALERT_BROADCAST`
- `EMERGENCY_REQUEST_CANCELLED`
