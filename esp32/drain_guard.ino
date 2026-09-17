#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

const char* SERVER_URL = "http://YOUR_COMPUTER_IP:5000/api/sensor";

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int LED_PIN = 2;
const int BUZZER_PIN = 4;

const int DRAIN_ID = 1;

const float DRAIN_DEPTH_CM = 100.0;

float readDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(3);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    return DRAIN_DEPTH_CM;
  }

  return duration * 0.0343 / 2.0;
}

float calculateLevel(float distance) {
  float level = ((DRAIN_DEPTH_CM - distance) / DRAIN_DEPTH_CM) * 100.0;

  if (level < 0) level = 0;
  if (level > 100) level = 100;

  return level;
}

void sendSensorData(float level) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;

  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload =
    "{\"drain_id\":" + String(DRAIN_ID) +
    ",\"water_level\":" + String(level, 2) +
    ",\"temperature\":28}";

  int response = http.POST(payload);

  Serial.println(response);

  http.end();
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.println(WiFi.localIP());
}

void loop() {
  float distance = readDistance();
  float level = calculateLevel(distance);

  Serial.print("Water level: ");
  Serial.print(level);
  Serial.println("%");

  if (level >= 90) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
  } else if (level >= 75) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  }

  sendSensorData(level);

  delay(5000);
}