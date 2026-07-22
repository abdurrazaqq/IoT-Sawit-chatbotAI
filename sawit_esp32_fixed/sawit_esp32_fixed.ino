#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>
#include <DHTesp.h>
#include <ModbusMaster.h>

// ============================================================
// KONFIGURASI
// ============================================================

// ── WiFi ──────────────────────────────────────────────────────
const char* ssid     = "lenovo";
const char* password = "12345678";

// ── MQTT HiveMQ Cloud ─────────────────────────────────────────
const char* mqtt_server = "559ff90d4b154001a8ccc6b560018c8e.s1.eu.hivemq.cloud";
const int   mqtt_port   = 8883;
const char* mqtt_user   = "Rohman";
const char* mqtt_pass   = "Rohman123";
const char* mqtt_topic  = "sawit/sensor/esp32";
const char* mqtt_ctrl   = "sawit/control/#";
const char* DEVICE_ID   = "SAWIT-001";

// ── Buffer MQTT — WAJIB >= panjang payload ────────────────────
#define MQTT_BUFFER_SIZE 512

// ── Pin ───────────────────────────────────────────────────────
#define RXD2          17
#define TXD2          16
#define MAX485_DIR     4
#define DHTPIN        15
#define RELAY_AIR      5
#define RELAY_NUTRISI 18

// ============================================================
// OBJEK GLOBAL
// ============================================================
WiFiClientSecure  espClient;
PubSubClient      client(espClient);
ModbusMaster      node;
DHTesp            dht;
LiquidCrystal_I2C lcd(0x27, 16, 2);
RTC_DS3231        rtc;

// ============================================================
// STATE AKTUATOR
// ============================================================
bool   pumpAir     = false;
bool   pumpNutrisi = false;
String sysMode     = "AUTO";

// ============================================================
// DATA SENSOR
// FIX: inisialisasi NAN bukan 0, agar sensor "belum terbaca"
//      bisa dibedakan dari nilai valid 0
// ============================================================
float soilHum  = NAN, soilTemp = NAN, ph = NAN, ec = NAN;
float nitrogen = NAN, phosphor = NAN, kalium = NAN;
float airTemp  = NAN, airHum   = NAN;

// ── Cache sensor ──────────────────────────────────────────────
float  c_soilHum   = -1,   c_soilTemp = -1, c_ph = -1, c_ec = -1;
float  c_nitrogen  = -1,   c_phosphor = -1, c_kalium = -1;
float  c_airTemp   = -100, c_airHum   = -100;

// ── Cache aktuator ────────────────────────────────────────────
bool   c_pumpAir     = false;
bool   c_pumpNutrisi = false;
String c_sysMode     = "AUTO";

// ── Status Modbus ─────────────────────────────────────────────
bool    modbusOK  = false;
uint8_t modbusErr = 0;

// ── Timer ─────────────────────────────────────────────────────
unsigned long lastSensor  = 0;
unsigned long lastPublish = 0;
unsigned long lastLCD     = 0;
int           lcdPage     = 0;

const unsigned long SENSOR_INTERVAL  = 2000;
const unsigned long PUBLISH_INTERVAL = 30000;

// ── Forward declaration ───────────────────────────────────────
void publishMQTT();

// ============================================================
// HELPER
// ============================================================
String pad2(int n) {
  return (n < 10 ? "0" : "") + String(n);
}

// FIX: helper serialisasi float — kirim "null" kalau NaN
//      sehingga dashboard React mempertahankan nilai terakhir
String fval(float v, int dec) {
  return isnan(v) ? "null" : String(v, dec);
}

// FIX: helper LCD — tampilkan "---" kalau NaN
String fstr(float v, int dec, String unit = "") {
  return isnan(v) ? "---" : (String(v, dec) + unit);
}

// ============================================================
// MODBUS — RS485
// ============================================================
void preTransmission()  { digitalWrite(MAX485_DIR, HIGH); }
void postTransmission() { digitalWrite(MAX485_DIR, LOW);  }

void readModbus() {
  uint8_t result = node.readHoldingRegisters(0x0000, 7);

  if (result == node.ku8MBSuccess) {
    modbusOK  = true;
    modbusErr = 0;

    soilHum  = node.getResponseBuffer(0) / 10.0;
    soilTemp = node.getResponseBuffer(1) / 10.0;
    ec       = node.getResponseBuffer(2) / 10.0;
    ph       = node.getResponseBuffer(3) / 10.0;
    nitrogen = node.getResponseBuffer(4);
    phosphor = node.getResponseBuffer(5);
    kalium   = node.getResponseBuffer(6);

    Serial.printf("[MODBUS] SoilHum:%.1f SoilTemp:%.1f EC:%.1f pH:%.2f N:%.0f P:%.0f K:%.0f\n",
                  soilHum, soilTemp, ec, ph, nitrogen, phosphor, kalium);
  } else {
    modbusOK  = false;
    modbusErr = result;
    Serial.printf("[MODBUS ERROR] Code: 0x%02X\n", result);
    // FIX: tidak reset ke 0 — variabel tetap di nilai terakhir yang valid (atau NAN)
    //      sehingga dashboard tidak menerima nilai 0 palsu
  }
}

// ============================================================
// DHT22
// ============================================================
void readDHT() {
  TempAndHumidity data = dht.getTempAndHumidity();
  // FIX: hanya update kalau baca berhasil (tidak NaN)
  //      jika gagal, airTemp/airHum tetap di nilai sebelumnya
  if (!isnan(data.temperature)) airTemp = data.temperature;
  if (!isnan(data.humidity))    airHum  = data.humidity;
  Serial.printf("[DHT] AirTemp:%s AirHum:%s\n",
                fstr(airTemp, 1).c_str(),
                fstr(airHum,  1).c_str());
}

// ============================================================
// CEK PERUBAHAN SIGNIFIKAN
// FIX: isnan() check agar NAN tidak dianggap "berubah" terus
// ============================================================
bool isChanged() {
  // Aktuator
  if (pumpAir     != c_pumpAir)     return true;
  if (pumpNutrisi != c_pumpNutrisi) return true;
  if (sysMode     != c_sysMode)     return true;

  // Sensor fisik — skip cek kalau nilai masih NAN
  if (!isnan(soilHum)  && abs(soilHum  - c_soilHum)  > 1.0f) return true;
  if (!isnan(soilTemp) && abs(soilTemp - c_soilTemp) > 0.5f) return true;
  if (!isnan(ph)       && abs(ph       - c_ph)       > 0.2f) return true;
  if (!isnan(ec)       && abs(ec       - c_ec)       > 1.0f) return true;
  if (!isnan(nitrogen) && abs(nitrogen - c_nitrogen) > 1.0f) return true;
  if (!isnan(phosphor) && abs(phosphor - c_phosphor) > 1.0f) return true;
  if (!isnan(kalium)   && abs(kalium   - c_kalium)   > 1.0f) return true;
  if (!isnan(airTemp)  && abs(airTemp  - c_airTemp)  > 0.5f) return true;
  if (!isnan(airHum)   && abs(airHum   - c_airHum)   > 1.0f) return true;

  return false;
}

void updateCache() {
  c_pumpAir     = pumpAir;
  c_pumpNutrisi = pumpNutrisi;
  c_sysMode     = sysMode;

  c_soilHum  = soilHum;
  c_soilTemp = soilTemp;
  c_ph       = ph;
  c_ec       = ec;
  c_nitrogen = nitrogen;
  c_phosphor = phosphor;
  c_kalium   = kalium;
  c_airTemp  = airTemp;
  c_airHum   = airHum;
}

// ============================================================
// LCD — rotasi 7 halaman setiap 4 detik
// FIX: gunakan fstr() agar tampil "---" saat sensor belum siap
// ============================================================
void updateLCD() {
  if (millis() - lastLCD < 4000) return;
  lastLCD = millis();
  lcd.clear();

  switch (lcdPage) {
    case 0:
      lcd.setCursor(0, 0); lcd.print("N:" + fstr(nitrogen, 0) + " mg/kg");
      lcd.setCursor(0, 1); lcd.print("P:" + fstr(phosphor, 0) + " K:" + fstr(kalium, 0));
      break;
    case 1:
      lcd.setCursor(0, 0); lcd.print("pH: "  + fstr(ph, 2));
      lcd.setCursor(0, 1); lcd.print("EC: "  + fstr(ec, 1) + " uS/cm");
      break;
    case 2:
      lcd.setCursor(0, 0); lcd.print("SoilHum: " + fstr(soilHum,  1) + "%");
      lcd.setCursor(0, 1); lcd.print("SoilTmp: " + fstr(soilTemp, 1) + "C");
      break;
    case 3:
      lcd.setCursor(0, 0); lcd.print("AirT: " + fstr(airTemp, 1) + "C");
      lcd.setCursor(0, 1); lcd.print("AirH: " + fstr(airHum,  1) + "%");
      break;
    case 4: {
      DateTime now = rtc.now();
      lcd.setCursor(0, 0);
      lcd.print(pad2(now.hour()) + ":" + pad2(now.minute()) + ":" + pad2(now.second()));
      lcd.setCursor(0, 1);
      lcd.print(pad2(now.day()) + "/" + pad2(now.month()) + "/" + String(now.year()));
      break;
    }
    case 5:
      lcd.setCursor(0, 0);
      lcd.print("PmpAir:" + String(pumpAir ? "ON" : "OFF") +
                " Ntr:" + String(pumpNutrisi ? "ON" : "OFF"));
      lcd.setCursor(0, 1);
      lcd.print("Mode:" + sysMode + " " + String(WiFi.RSSI()) + "dB");
      break;
    case 6:
      lcd.setCursor(0, 0);
      lcd.print(modbusOK ? "MODBUS: OK" : "MODBUS: ERR");
      lcd.setCursor(0, 1);
      lcd.print("ErrCode: 0x" + String(modbusErr, HEX));
      break;
  }

  if (++lcdPage > 6) lcdPage = 0;
}

// ============================================================
// MQTT CALLBACK
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);
  String msg      = "";

  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.printf("[MQTT IN] %s → %s\n", topic, msg.c_str());

  String value = msg;

  if (msg.startsWith("{")) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, msg);
    if (!err && doc.containsKey("value")) {
      value = doc["value"].as<String>();
      Serial.printf("[MQTT] JSON parsed, value: %s\n", value.c_str());
    } else {
      Serial.println("[MQTT] JSON parse gagal atau field 'value' tidak ada, skip.");
      return;
    }
  }

  if (topicStr.endsWith("pump_air")) {
    pumpAir = (value == "ON");
    digitalWrite(RELAY_AIR, pumpAir ? HIGH : LOW);
    Serial.printf("[CTRL] Pompa Air: %s\n", pumpAir ? "ON" : "OFF");
    publishMQTT();
  }
  else if (topicStr.endsWith("pump_nutrisi")) {
    pumpNutrisi = (value == "ON");
    digitalWrite(RELAY_NUTRISI, pumpNutrisi ? HIGH : LOW);
    Serial.printf("[CTRL] Pompa Nutrisi: %s\n", pumpNutrisi ? "ON" : "OFF");
    publishMQTT();
  }
  else if (topicStr.endsWith("mode")) {
    if (value == "AUTO" || value == "MANUAL") {
      sysMode = value;
      Serial.printf("[CTRL] Mode: %s\n", sysMode.c_str());
      publishMQTT();
    }
  }
}

// ============================================================
// WIFI
// ============================================================
void setupWifi() {
  lcd.clear(); lcd.print("Connecting WiFi");
  Serial.print("WiFi: menghubungkan");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500); Serial.print("."); attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi OK — IP: %s\n", WiFi.localIP().toString().c_str());
    lcd.clear(); lcd.print("WiFi Connected");
  } else {
    Serial.println("\nWiFi GAGAL — lanjut offline");
    lcd.clear(); lcd.print("WiFi FAILED");
  }
  delay(1000);
}

// ============================================================
// MQTT RECONNECT
// ============================================================
void mqttReconnect() {
  int attempts = 0;
  while (!client.connected() && attempts < 5) {
    lcd.clear(); lcd.print("MQTT Connecting");
    String clientId = String(DEVICE_ID) + "-" + String(random(1000, 9999));
    Serial.printf("MQTT connect sebagai %s...\n", clientId.c_str());

    if (client.connect(clientId.c_str(), mqtt_user, mqtt_pass)) {
      client.subscribe(mqtt_ctrl);
      Serial.println("MQTT terhubung.");
      lcd.clear(); lcd.print("MQTT Connected");
      delay(500);
      return;
    }

    Serial.printf("MQTT gagal rc=%d, coba lagi...\n", client.state());
    delay(2000);
    attempts++;
  }
}

// ============================================================
// PUBLISH MQTT
// FIX: gunakan fval() untuk semua field sensor fisik
//      → kirim "null" ke JSON kalau sensor belum/gagal baca
//      → dashboard React akan pertahankan nilai terakhir yang valid
// ============================================================
void publishMQTT() {
  if (!client.connected()) {
    Serial.println("[MQTT] Tidak terhubung, reconnect dulu...");
    mqttReconnect();
    if (!client.connected()) {
      Serial.println("[MQTT] Reconnect gagal, skip publish.");
      return;
    }
  }

  DateTime now = rtc.now();
  String timeStr = pad2(now.hour())   + ":" + pad2(now.minute()) + ":" + pad2(now.second());
  String dateStr = pad2(now.day())    + "/" + pad2(now.month())  + "/" + String(now.year());

  String payload = "{";

  payload += "\"device_id\":\""    + String(DEVICE_ID) + "\",";
  payload += "\"device_status\":\"ONLINE\",";
  payload += "\"time\":\""         + timeStr            + "\",";
  payload += "\"date\":\""         + dateStr            + "\",";
  payload += "\"wifi_signal\":"    + String(WiFi.RSSI())+ ",";

  // FIX: fval() → null jika NaN, bukan 0
  payload += "\"soil_hum\":"       + fval(soilHum,  1)  + ",";
  payload += "\"soil_temp\":"      + fval(soilTemp, 1)  + ",";
  payload += "\"ph\":"             + fval(ph,        2)  + ",";
  payload += "\"ec\":"             + fval(ec,        1)  + ",";

  payload += "\"npk\":{";
  payload += "\"nitrogen\":"   + fval(nitrogen, 0) + ",";
  payload += "\"phosphorus\":" + fval(phosphor, 0) + ",";
  payload += "\"potassium\":"  + fval(kalium,   0);
  payload += "},";

  // FIX: fval() → null jika NaN, bukan 0
  payload += "\"temperature\":" + fval(airTemp, 1) + ",";
  payload += "\"humidity\":"    + fval(airHum,  1) + ",";

  payload += "\"pump_air\":\""     + String(pumpAir     ? "ON" : "OFF") + "\",";
  payload += "\"pump_nutrisi\":\"" + String(pumpNutrisi ? "ON" : "OFF") + "\",";
  payload += "\"mode\":\""         + sysMode + "\"";

  payload += "}";

  Serial.printf("[MQTT] Ukuran payload: %d byte (buffer: %d)\n",
                payload.length(), MQTT_BUFFER_SIZE);

  if ((int)payload.length() >= MQTT_BUFFER_SIZE) {
    Serial.println("[ERROR] Payload terlalu besar! Naikkan MQTT_BUFFER_SIZE.");
    return;
  }

  bool ok = client.publish(mqtt_topic, payload.c_str());

  if (ok) {
    Serial.println("[MQTT OK] " + payload);
    updateCache();
    lastPublish = millis();
  } else {
    Serial.println("[MQTT FAIL] Coba reconnect + retry...");
    client.disconnect();
    delay(300);
    mqttReconnect();
    ok = client.publish(mqtt_topic, payload.c_str());
    if (ok) {
      Serial.println("[MQTT RETRY OK]");
      updateCache();
      lastPublish = millis();
    } else {
      Serial.printf("[MQTT RETRY FAIL] State: %d\n", client.state());
    }
  }
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_AIR,     OUTPUT); digitalWrite(RELAY_AIR,     LOW);
  pinMode(RELAY_NUTRISI, OUTPUT); digitalWrite(RELAY_NUTRISI, LOW);
  pinMode(MAX485_DIR,    OUTPUT); digitalWrite(MAX485_DIR,    LOW);

  Serial2.begin(4800, SERIAL_8N1, RXD2, TXD2);
  node.begin(1, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  dht.setup(DHTPIN, DHTesp::DHT22);

  if (!rtc.begin()) {
    lcd.clear(); lcd.print("RTC ERROR!");
    Serial.println("RTC tidak ditemukan!");
    while (1) delay(100);
  }
  if (rtc.lostPower()) {
    Serial.println("RTC lost power, sinkronisasi waktu kompilasi.");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("SAWIT.IO v2.0");
  lcd.setCursor(0, 1); lcd.print("Inisialisasi...");
  delay(1500);

  espClient.setInsecure();
  setupWifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
  client.setBufferSize(MQTT_BUFFER_SIZE);
  mqttReconnect();

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("System Ready");
  lcd.setCursor(0, 1); lcd.print(DEVICE_ID);
  Serial.println("=== SYSTEM READY ===");
  delay(1500);
}

// ============================================================
// LOOP
// ============================================================
void loop() {
  if (!client.connected()) mqttReconnect();
  client.loop();

  if (millis() - lastSensor >= SENSOR_INTERVAL) {
    lastSensor = millis();
    readModbus();
    readDHT();
  }

  updateLCD();

  bool changeTrigger = isChanged();
  bool timeTrigger   = (millis() - lastPublish >= PUBLISH_INTERVAL);

  if (changeTrigger || timeTrigger) {
    publishMQTT();
  }
}
