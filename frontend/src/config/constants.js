export const SENSOR_RANGES = {
  soil_temp: { min: 20, max: 40, unit: "degC", color: "#ff8a65", label: "Suhu Tanah" },
  soil_hum: { min: 0, max: 100, unit: "%", color: "#4fc3f7", label: "Kelembaban Tanah" },
  ph: { min: 0, max: 14, unit: "pH", color: "#81c784", label: "pH Tanah" },
  ec: { min: 0, max: 300, unit: "uS/cm", color: "#ce93d8", label: "EC Tanah" },
  temperature: { min: 20, max: 45, unit: "degC", color: "#ffb74d", label: "Suhu Udara" },
  humidity: { min: 0, max: 100, unit: "%", color: "#64b5f6", label: "Kelembaban Udara" }
};

export const DEFAULT_THRESHOLDS = {
  soil_hum_min: 40,
  ph_min: 5.5,
  ph_max: 7.5,
  ec_max: 150,
  nitrogen_min: 100,
  temperature_max: 35
};

export const MQTT_TOPICS = {
  sensorAll: "sawit/sensor/#",
  controlPumpAir: "sawit/control/pompa_air",
  controlPumpNutrisi: "sawit/control/pompa_nutrisi",
  controlMode: "sawit/control/mode"
};

export const INITIAL_SCHEDULES = [
  { type: "air", time: "06:00", duration: 15, days: "Setiap hari", active: true },
  { type: "nutrisi", time: "08:00", duration: 10, days: "Senin - Jumat", active: true }
];

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "D" },
  { id: "charts", label: "Grafik", icon: "G" },
  { id: "control", label: "Kontrol", icon: "K" },
  { id: "schedule", label: "Jadwal", icon: "J" },
  { id: "history", label: "Riwayat", icon: "R" },
  { id: "settings", label: "Pengaturan", icon: "P" }
];
