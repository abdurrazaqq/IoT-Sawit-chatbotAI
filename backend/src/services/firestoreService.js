import { firestore, firebaseReady, firebaseAdmin } from "../config/firebase.js";

const FieldValue = firebaseAdmin.firestore.FieldValue;

export async function addSensorReading(sensor) {
  if (!firebaseReady) return null;

  const clean = {
    soil_moisture: sensor.soil_moisture ?? 0,
    soil_temp: sensor.soil_temp ?? 0,
    ph: sensor.ph ?? 0,
    ec: sensor.ec ?? 0,
    nitrogen: sensor.nitrogen ?? 0,
    phosphor: sensor.phosphor ?? 0,
    kalium: sensor.kalium ?? 0,
    temperature_air: sensor.temperature_air ?? 0,
    humidity_air: sensor.humidity_air ?? 0,
    pump: sensor.pump ?? "OFF",
    notif: sensor.notif ?? "",
    rekomendasi: sensor.rekomendasi ?? "",
    time: sensor.time ?? "",
    createdAt: FieldValue.serverTimestamp()
  };

  return firestore.collection("sensor_data").add(clean);
}
export async function addNotification(message, type = "info") {
  if (!firebaseReady) return null;
  return firestore.collection("notifications").add({
    message,
    type,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function addControlLog(action, value, source = "backend") {
  if (!firebaseReady) return null;
  return firestore.collection("control_logs").add({
    action,
    value,
    source,
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function addChatMessage(message) {
  if (!firebaseReady) return null;
  return firestore.collection("ai_chat_history").add({
    ...message,
    createdAt: FieldValue.serverTimestamp()
  });
}
