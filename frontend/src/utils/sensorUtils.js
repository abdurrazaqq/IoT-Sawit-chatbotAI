export function normalizeSensorPayload(payload) {
  const now = new Date();
  const npk = payload.npk || {};

  return {
    device_id: payload.device_id || payload.deviceId || "ESP32_SAWIT_01",
    time: payload.time || now.toLocaleTimeString("id-ID", { hour12: false }),
    date:
      payload.date ||
      now.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-"),
    soil_temp: Number(payload.soil_temp ?? payload.soilTemp ?? 0),
    soil_hum: Number(payload.soil_hum ?? payload.soilHum ?? payload.moisture ?? 0),
    ph: Number(payload.ph ?? 0),
    ec: Number(payload.ec ?? 0),
    npk: {
      nitrogen: Number(npk.nitrogen ?? payload.nitrogen ?? 0),
      phosphorus: Number(npk.phosphorus ?? payload.phosphorus ?? 0),
      potassium: Number(npk.potassium ?? payload.potassium ?? 0)
    },
    temperature: Number(payload.temperature ?? payload.air_temp ?? 0),
    humidity: Number(payload.humidity ?? payload.air_hum ?? 0),
    pump_air: payload.pump_air || "OFF",
    pump_nutrisi: payload.pump_nutrisi || "OFF",
    mode: payload.mode || "AUTO",
    wifi_signal: Number(payload.wifi_signal ?? -65),
    device_status: payload.device_status || "ONLINE"
  };
}

export function sensorStatus(value, low, high) {
  if (value < low || value > high) return "alert";
  if (value < low * 1.1 || value > high * 0.9) return "warning";
  return "normal";
}

export function wifiQuality(signal) {
  if (signal > -50) return "Excellent";
  if (signal > -65) return "Good";
  if (signal > -75) return "Fair";
  return "Weak";
}

export function buildSensorContext(sensor) {
  return [
    `Device: ${sensor.device_id}`,
    `Suhu tanah: ${sensor.soil_temp} degC`,
    `Kelembaban tanah: ${sensor.soil_hum}%`,
    `pH tanah: ${sensor.ph}`,
    `EC tanah: ${sensor.ec} uS/cm`,
    `Nitrogen: ${sensor.npk?.nitrogen} mg/kg`,
    `Fosfor: ${sensor.npk?.phosphorus} mg/kg`,
    `Kalium: ${sensor.npk?.potassium} mg/kg`,
    `Suhu udara: ${sensor.temperature} degC`,
    `Kelembaban udara: ${sensor.humidity}%`,
    `Pompa air: ${sensor.pump_air}`,
    `Pompa nutrisi: ${sensor.pump_nutrisi}`,
    `Mode: ${sensor.mode}`,
    `Sinyal WiFi: ${sensor.wifi_signal} dBm`
  ].join("\n");
}
