# RouteX — Physical Android Validation Record

**Test date:** 19 October 2026  
**Android phone model / Android version:** [Pending Physical Device Connection — e.g., Samsung Galaxy S21 / Android 13]  
**APK path:** `mobile/build/app/outputs/flutter-apk/app-release.apk`  
**APK size:** 51,019,868 bytes (~48.66 MB)  
**PC IPv4 address:** `192.168.1.9` (Active Wi-Fi Adapter)  
**Backend API URL configured in the app:** `http://192.168.1.9:8000/api`  

---

## Results

- **APK installation:** PENDING PHYSICAL HANDSET (Binary compiled & verified on disk)
- **App launches successfully:** PENDING PHYSICAL HANDSET (Verified on Chrome Web & Windows target)
- **Phone-to-backend connection:** PENDING PHYSICAL HANDSET (Backend bound to `0.0.0.0:8000`, verified locally)
- **Connection latency:** Pending physical execution / ~2–8 ms typical LAN estimate
- **Driver login:** PENDING PHYSICAL HANDSET (Verified via automated API test `test_login_and_auth`)
- **Emergency creation and hospital selection:** PENDING PHYSICAL HANDSET (Verified via automated test `test_route_comparison_hospital_dest_and_errors`)
- **Route comparison and tracking:** PENDING PHYSICAL HANDSET (Verified via `test_route_comparison_normal_conditions`)
- **Four simulation scenarios:** VERIFIED AUTOMATED / PENDING PHYSICAL PHONE (All 4 scenarios passed in `test_all_four_scenarios_execute_to_completion`)
- **Trip completion and fleet availability:** VERIFIED AUTOMATED / PENDING PHYSICAL PHONE (Verified in `test_ambulance_status_lifecycle_and_trip_completion`)
- **Dashboard/mobile state consistency:** VERIFIED VIA WEBSOCKETS (State engine verified across 47 tests)
- **WebSocket reconnection:** VERIFIED AUTOMATED (3-second auto-retry reconnect loop active)

---

## Errors or Observations

1. **Compilation & Packaging Integrity**: The APK compiled cleanly via `flutter build apk --release` (54.5s) with `INTERNET`, `ACCESS_NETWORK_STATE`, and `usesCleartextTraffic="true"` configured in `AndroidManifest.xml`.
2. **Network Setup**: PC's active Wi-Fi IPv4 address is `192.168.1.9`. To connect a physical phone, ensure both phone and PC are on the same Wi-Fi SSID and start the backend using `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`.
3. **No Fabricated Data**: No physical Android device is currently tethered via USB or ADB network daemon; physical handset execution will be recorded once side-loaded onto a physical device.

---

## Status Statements

- **Physical Android testing status:** Pending until the test is performed and recorded on an actual handheld device.
- **Hardware testing status:** Pending. No physical ESP32, ESP8266, or LoRa validation is claimed by this test.
- **Safety boundary:** RouteX remains a laboratory simulation prototype and is not connected to public-road traffic infrastructure.
