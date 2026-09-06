# SmartPOS SUNMI V2s client

This module targets the SUNMI V2s T5940 profile:

- Portrait orientation
- `minSdk 23`, `targetSdk 30`
- WebView shell sized with Android dp/sp rather than physical pixels
- SUNMI scanner broadcast receiver
- SUNMI printer service binding through the standard `woyou.aidl.service` service name
- Android NFC reader mode

## Build configuration

The default URL is a placeholder and must be replaced for a release build:

```text
https://app.example.com
```

For emulator development, use `http://10.0.2.2:3001`. For a physical SUNMI
on the local network, use the development machine's LAN URL. For the release
APK, always use the deployed HTTPS app URL.

For a physical SUNMI connected to the same network as the development machine, pass the machine's LAN URL:

```bash
gradlew.bat :app:assembleDebug -PSMARTPOS_WEB_URL=http://192.168.1.20:3001
```

The backend must also be reachable by the SUNMI through the configured frontend/API URL. Do not use `localhost` from the device; on Android, that points to the device itself.

## Hardware setup

1. Set the SUNMI scanner output mode to Broadcast Output Mode.
2. Confirm the scanner action configured by the device firmware matches one of the receiver actions in `SunmiHardware.java`.
3. Enable NFC on the device.
4. Confirm the SUNMI printer service is installed and enabled.
5. Build and install on the physical V2s before producing a release APK.

The web app can listen for:

```js
window.addEventListener("smartpos:scan", (event) => {
  const value = event.detail.value;
});

window.addEventListener("smartpos:nfc", (event) => {
  const id = event.detail.id;
});

window.SmartPOSHardware?.printText("Receipt text\\n");
```

The printer implementation intentionally uses reflection so the project can compile without redistributing a proprietary SUNMI SDK. Verify the printer callback signature against the firmware's installed SUNMI service before release.
