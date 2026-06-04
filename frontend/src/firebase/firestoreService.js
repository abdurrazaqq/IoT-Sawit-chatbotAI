import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db, isFirebaseReady } from "./config.js";
import { DEFAULT_THRESHOLDS } from "../config/constants.js";

const noop = () => {};

// SENSOR
export async function addSensorReading(sensor) {
  if (!isFirebaseReady) return null;
  return addDoc(collection(db, "sensor_data"), {
    ...sensor,
    createdAt: serverTimestamp()
  });
}

// NOTIFICATION WRITE
export async function addNotification(message, type = "info") {
  if (!isFirebaseReady) return null;
  return addDoc(collection(db, "notifications"), {
    message,
    type,
    read: false,
    createdAt: serverTimestamp()
  });
}

// CONTROL LOG
export async function saveControlLog(action, value, source = "frontend") {
  if (!isFirebaseReady) return null;
  return addDoc(collection(db, "control_logs"), {
    action,
    value,
    source,
    createdAt: serverTimestamp()
  });
}

// SCHEDULE
export async function addSchedule(schedule) {
  if (!isFirebaseReady) return null;
  return addDoc(collection(db, "schedules"), {
    ...schedule,
    active: schedule.active ?? true,
    createdAt: serverTimestamp()
  });
}

// LISTENER SCHEDULE
export function listenSchedules(callback) {
  if (!isFirebaseReady) return noop;

  const q = query(
    collection(db, "schedules"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }))
    );
  });
}

// THRESHOLD GET
export async function getThresholds() {
  if (!isFirebaseReady) return DEFAULT_THRESHOLDS;

  const ref = doc(db, "settings", "thresholds");
  const snap = await getDoc(ref);

  return snap.exists()
    ? { ...DEFAULT_THRESHOLDS, ...snap.data() }
    : DEFAULT_THRESHOLDS;
}

// THRESHOLD SAVE
export async function saveThresholds(thresholds) {
  if (!isFirebaseReady) return null;

  return setDoc(doc(db, "settings", "thresholds"), {
    ...thresholds,
    updatedAt: serverTimestamp()
  });
}

// CHAT
export async function addChatMessage(message) {
  if (!isFirebaseReady) return null;

  return addDoc(collection(db, "ai_chat_history"), {
    ...message,
    createdAt: serverTimestamp()
  });
}

/* ================================
   INI TAMBAHAN BARU (PENTING)
   FIRESTORE REALTIME NOTIFICATION
================================== */

export function listenNotifications(callback) {
  if (!isFirebaseReady) return noop;

  const q = query(
    collection(db, "notifications"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    callback(data);
  });
}