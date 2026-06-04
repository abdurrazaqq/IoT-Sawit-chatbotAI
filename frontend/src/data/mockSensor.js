export const generateSensorData = () => {
  const now = new Date();

  return {
    device_id: "ESP32_SAWIT_01",
    time: now.toLocaleTimeString("id-ID", { hour12: false }),
    date: now
      .toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
      .replace(/\//g, "-"),
    soil_temp: Number((26 + Math.random() * 6).toFixed(2)),
    soil_hum: Number((45 + Math.random() * 30).toFixed(2)),
    ph: Number((5.5 + Math.random() * 3).toFixed(2)),
    ec: Number((80 + Math.random() * 80).toFixed(2)),
    npk: {
      nitrogen: Math.round(90 + Math.random() * 60),
      phosphorus: Math.round(30 + Math.random() * 40),
      potassium: Math.round(60 + Math.random() * 50)
    },
    temperature: Number((27 + Math.random() * 8).toFixed(1)),
    humidity: Math.round(60 + Math.random() * 30),
    pump_air: "OFF",
    pump_nutrisi: "OFF",
    mode: "AUTO",
    wifi_signal: Math.round(-75 + Math.random() * 30),
    device_status: "ONLINE"
  };
};

export const INITIAL_DATA = generateSensorData();
