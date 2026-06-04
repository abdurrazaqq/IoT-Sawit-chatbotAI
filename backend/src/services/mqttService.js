import mqtt from "mqtt";
import { CONTROL_TOPIC_BY_ACTION, MQTT_TOPICS } from "../config/topics.js";
import { addSensorReading, addNotification } from "./firestoreService.js";

let client = null;
let latestSensor = null;
let lastFirestoreSave = 0;

function normalizeSensor(data) {
  return {
    soil_moisture: data.soil_moisture ?? 0,
    soil_temp: data.soil_temp ?? 0,
    ph: data.ph ?? 0,
    ec: data.ec ?? 0,
    nitrogen: data.nitrogen ?? 0,
    phosphor: data.phosphor ?? 0,
    kalium: data.kalium ?? 0,
    temperature_air: data.temperature_air ?? 0,
    humidity_air: data.humidity_air ?? 0,
    pump: data.pump ?? 0,
    time: new Date().toLocaleTimeString("id-ID")
  };
}

function generateAlert(sensor) {
  const notif = [];
  const rekomendasi = [];

  if (sensor.soil_moisture < 300) {
    notif.push("Tanah kering");
    rekomendasi.push("Tambah air");
  }

  if (sensor.ph < 5.5) {
    notif.push("pH asam");
    rekomendasi.push("Tambah kapur");
  }

  if (sensor.ph > 6.5) {
    notif.push("pH basa");
    rekomendasi.push("Tambah bahan organik");
  }

  if (sensor.nitrogen < 40) {
    notif.push("Nitrogen rendah");
    rekomendasi.push("Tambah pupuk N");
  }

  if (sensor.phosphor < 20) {
    notif.push("Fosfor rendah");
    rekomendasi.push("Tambah pupuk P");
  }

  if (sensor.kalium < 40) {
    notif.push("Kalium rendah");
    rekomendasi.push("Tambah pupuk K");
  }

  if (sensor.ec > 2000) {
    notif.push("EC tinggi");
    rekomendasi.push("Kurangi pupuk");
  }

  return {
    notif: notif.length ? notif.join(", ") : null,
    rekomendasi: rekomendasi.length ? rekomendasi.join(", ") : null
  };
}

export function connectMqtt() {
  const url = process.env.MQTT_BROKER_URL;

  if (!url) {
    console.log("MQTT backend tidak aktif");
    return null;
  }

  client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId:
      process.env.MQTT_CLIENT_ID ||
      `sawit_backend_${Math.random().toString(16).slice(2)}`,
    reconnectPeriod: 3000,
    connectTimeout: 30000,
    clean: true,
    rejectUnauthorized: false
  });

  client.on("connect", () => {
    console.log("MQTT backend connected");
    client.subscribe(MQTT_TOPICS.sensorAll);
  });

  client.on("message", (_topic, raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      const sensor = normalizeSensor(parsed);

      const alert = generateAlert(sensor);

      const finalSensor = {
        ...sensor,
        notif: alert.notif,
        rekomendasi: alert.rekomendasi
      };

      latestSensor = finalSensor;

      const now = Date.now();

      if (now - lastFirestoreSave > 30000) {
        lastFirestoreSave = now;
        addSensorReading(finalSensor).catch(() => {});
      }

      if (alert.notif) {
        addNotification(alert.notif, "warning").catch(() => {});
      }

    } catch (err) {
      console.log("MQTT payload error:", err.message);
    }
  });

  return client;
}

export function publishControl(action, value) {
  const topic = CONTROL_TOPIC_BY_ACTION[action];

  if (!topic || !client?.connected) return { ok: false };

  client.publish(
    topic,
    JSON.stringify({
      value,
      source: "backend",
      ts: Date.now()
    })
  );

  return { ok: true };
}

export function getLatestSensor() {
  return latestSensor;
}