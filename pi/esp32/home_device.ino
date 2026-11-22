/*
  Home AI - ESP32 device example (weather station / room sensor / relays)

  Every 30 seconds this sends its readings to your Raspberry Pi and gets back
  what the relays should be. It then shows up live in the app's Home tab.

  1. Fill in WIFI_SSID, WIFI_PASS, PI_IP and DEVICE_KEY (the key is shown in the app's Home tab).
  2. Replace readSensors() with your real sensors (BME280, DHT22, rain gauge...).
  3. Set RELAY_PINS / RELAY_NAMES for your relays (or leave RELAY_COUNT at 0).
  Board: any ESP32. No extra libraries needed.
*/
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID  = "YOUR_WIFI";
const char* WIFI_PASS  = "YOUR_WIFI_PASSWORD";
const char* PI_IP      = "192.168.0.XXX";      // the Pi's address on your home network (shown in the app)
const int   PI_PORT    = 8090;
const char* DEVICE_KEY = "PASTE_DEVICE_KEY";   // shown in the app's Home tab

const char* DEVICE_ID   = "weather";           // short, unique, no spaces
const char* DEVICE_NAME = "Weather station";
const char* DEVICE_KIND = "weather";           // weather | sensor | relay
const unsigned long INTERVAL_MS = 30000;

// Relays (active LOW modules are common - flip RELAY_ON if yours is active HIGH)
const int RELAY_COUNT = 1;
const int RELAY_PINS[] = {26};
const char* RELAY_NAMES[] = {"Desk lamp"};
const int RELAY_ON = LOW;
bool relayState[4] = {false, false, false, false};

// ---- replace with your real sensors -------------------------------------------
float temperature = NAN, humidity = NAN, pressure = NAN;
void readSensors() {
  // Example: fake values so you can test the connection before wiring sensors.
  temperature = 12.0 + (esp_random() % 50) / 10.0;
  humidity    = 70.0 + (esp_random() % 100) / 10.0;
  pressure    = 1012.0 + (esp_random() % 40) / 10.0;
}
// -------------------------------------------------------------------------------

void setRelay(int i, bool on) {
  relayState[i] = on;
  digitalWrite(RELAY_PINS[i], on ? RELAY_ON : !RELAY_ON);
}

String jsonNum(float v) { return isnan(v) ? String("null") : String(v, 1); }

void report() {
  readSensors();
  String body = "{\"id\":\"" + String(DEVICE_ID) + "\",\"name\":\"" + DEVICE_NAME + "\",\"kind\":\"" + DEVICE_KIND + "\",";
  body += "\"interval\":" + String(INTERVAL_MS / 1000) + ",";
  body += "\"readings\":{\"Temperature\":" + jsonNum(temperature) + ",\"Humidity\":" + jsonNum(humidity) + ",\"Pressure\":" + jsonNum(pressure) + "},";
  body += "\"units\":{\"Temperature\":\"°C\",\"Humidity\":\"%\",\"Pressure\":\"hPa\"},";
  body += "\"relays\":{";
  for (int i = 0; i < RELAY_COUNT; i++) {
    if (i) body += ",";
    body += "\"" + String(RELAY_NAMES[i]) + "\":" + (relayState[i] ? "true" : "false");
  }
  body += "}}";

  HTTPClient http;
  http.begin(String("http://") + PI_IP + ":" + PI_PORT + "/home/report");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Key", DEVICE_KEY);
  int code = http.POST(body);
  if (code == 200) {
    String resp = http.getString();          // {"ok": true, "relays": {"Desk lamp": true}}
    for (int i = 0; i < RELAY_COUNT; i++) {
      String key = "\"" + String(RELAY_NAMES[i]) + "\": ";
      int p = resp.indexOf(key);
      if (p < 0) { key.trim(); p = resp.indexOf(key); }
      if (p >= 0) {
        bool want = resp.substring(p + key.length(), p + key.length() + 5).startsWith("true");
        if (want != relayState[i]) setRelay(i, want);
      }
    }
    Serial.println("Reported OK");
  } else {
    Serial.printf("Report failed: %d\n", code);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < RELAY_COUNT; i++) { pinMode(RELAY_PINS[i], OUTPUT); setRelay(i, false); }
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nConnected: " + WiFi.localIP().toString());
}

unsigned long last = 0;
void loop() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(2000); return; }
  if (millis() - last > INTERVAL_MS || last == 0) { last = millis(); report(); }
  delay(50);
}
