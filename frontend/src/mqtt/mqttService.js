import mqtt from "mqtt";
import { MQTT_TOPICS } from "../config/constants.js";
import { normalizeSensorPayload } from "../utils/sensorUtils.js";

class MqttService {
  client = null;
  listeners = new Set();
  statusListeners = new Set();

  connect() {
    const url = import.meta.env.VITE_MQTT_BROKER_URL;
    if (!url) {
      this.emitStatus("OFFLINE");
      return;
    }

    if (this.client) return;

    this.emitStatus("CONNECTING");
    this.client = mqtt.connect(url, {
      username: import.meta.env.VITE_MQTT_USERNAME || undefined,
      password: import.meta.env.VITE_MQTT_PASSWORD || undefined,
      reconnectPeriod: 3000,
      clean: true,
      clientId: `sawit_frontend_${Math.random().toString(16).slice(2)}`
    });

    this.client.on("connect", () => {
      this.emitStatus("CONNECTED");
      this.client.subscribe(MQTT_TOPICS.sensorAll);
    });

    this.client.on("reconnect", () => this.emitStatus("RECONNECTING"));
    this.client.on("close", () => this.emitStatus("DISCONNECTED"));
    this.client.on("error", () => this.emitStatus("ERROR"));
    this.client.on("message", (_topic, raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        this.listeners.forEach((listener) => listener(normalizeSensorPayload(payload)));
      } catch {
        this.emitStatus("INVALID_PAYLOAD");
      }
    });
  }

  disconnect() {
    this.client?.end(true);
    this.client = null;
    this.emitStatus("OFFLINE");
  }

  onSensor(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  publishControl(action, value) {
    const topicMap = {
      pump_air: MQTT_TOPICS.controlPumpAir,
      pump_nutrisi: MQTT_TOPICS.controlPumpNutrisi,
      mode: MQTT_TOPICS.controlMode
    };
    const topic = topicMap[action];
    if (!topic || !this.client?.connected) return false;

    this.client.publish(topic, JSON.stringify({ value, ts: Date.now() }), { qos: 0, retain: false });
    return true;
  }

  emitStatus(status) {
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export const mqttService = new MqttService();
