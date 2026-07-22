import { useCallback, useEffect, useRef, useState } from "react";
import AIChatPanel from "../components/AIChatPanel.jsx";
import AuthPanel from "../components/AuthPanel.jsx";
import ChartPanel from "../components/ChartPanel.jsx";
import HistoryTable from "../components/HistoryTable.jsx";
import SchedulePanel from "../components/SchedulePanel.jsx";
import SensorCard from "../components/SensorCard.jsx";
import SparkLine from "../components/SparkLine.jsx";
import Toast from "../components/Toast.jsx";
import { DEFAULT_THRESHOLDS, INITIAL_SCHEDULES, MQTT_TOPICS, NAV_ITEMS, SENSOR_RANGES } from "../config/constants.js";
import { INITIAL_DATA } from "../data/mockSensor.js";
import {
  addNotification,
  addSchedule as addScheduleToFirestore,
  addSensorReading,
  getThresholds,
  listenSchedules,
  saveControlLog,
  saveThresholds,
} from "../firebase/firestoreService.js";
import { subscribeAuth } from "../firebase/authService.js";
import { isFirebaseReady } from "../firebase/config.js";
import { mqttService } from "../mqtt/mqttService.js";
import { sendControlCommand } from "../services/apiService.js";
import { sensorStatus, wifiQuality } from "../utils/sensorUtils.js";

// ─────────────────────────────────────────────────────────────
// KONSTANTA
// ─────────────────────────────────────────────────────────────
const CONTROL_LOCK_MS = 60_000;

// ─────────────────────────────────────────────────────────────
// HELPER: cek apakah format waktu valid (HH:MM:SS dengan titik dua)
// Data lama dari Firestore memakai format titik (13.31.16) bukan titik dua
// ─────────────────────────────────────────────────────────────
function isValidTimeFormat(time) {
  if (!time) return false;
  return /^\d{2}:\d{2}:\d{2}$/.test(time);
}

// ─────────────────────────────────────────────────────────────
// HELPER: filter nilai tidak valid dari sensor
// ─────────────────────────────────────────────────────────────
function validVal(v) {
  if (v == null || v === "" || v === 0) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─────────────────────────────────────────────────────────────
// NORMALISASI payload MQTT/Firestore → format internal
// ─────────────────────────────────────────────────────────────
function normalizeSensor(raw) {
  if (!raw) return raw;

  const ec =
    validVal(raw.ec) ??
    (raw.ec3000 != null ? validVal(Number(raw.ec3000) / 1000) : null);

  const npk = {
    nitrogen:   raw.npk?.nitrogen   ?? raw.nitrogen  ?? null,
    phosphorus: raw.npk?.phosphorus ?? raw.phosphor  ?? null,
    potassium:  raw.npk?.potassium  ?? raw.kalium    ?? null,
  };

  return {
    ...raw,
    soil_hum:      validVal(raw.soil_hum)    ?? validVal(raw.soil_moisture) ?? null,
    soil_temp:     validVal(raw.soil_temp)   ?? null,
    temperature:   validVal(raw.temperature) ?? validVal(raw.temperature_air) ?? null,
    humidity:      validVal(raw.humidity)    ?? validVal(raw.humidity_air)    ?? null,
    ec,
    ph:            validVal(raw.ph)          ?? null,
    npk,
    pump_air:      raw.pump_air     ?? (raw.pump === 1 ? "ON" : "OFF"),
    pump_nutrisi:  raw.pump_nutrisi ?? "OFF",
    mode:          raw.mode         ?? "AUTO",
    device_status: raw.device_status ?? "ONLINE",
    wifi_signal:   raw.wifi_signal   ?? 0,
    device_id:     raw.device_id     ?? "SAWIT-001",
    time:          raw.time          ?? "--:--:--",
    date:          raw.date          ?? "--/--/----",
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function SmartFarmingDashboard() {
  const [sensor, setSensor]               = useState(normalizeSensor(INITIAL_DATA));
  const [history, setHistory]             = useState([normalizeSensor(INITIAL_DATA)]);
  const [pumpAir, setPumpAir]             = useState(false);
  const [pumpNutrisi, setPumpNutrisi]     = useState(false);
  const [mode, setMode]                   = useState("AUTO");
  const [page, setPage]                   = useState("dashboard");
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount]       = useState(0);
  const [chatOpen, setChatOpen]           = useState(false);
  const [mqttStatus, setMqttStatus]       = useState("OFFLINE");
  const [schedules, setSchedules]         = useState(INITIAL_SCHEDULES);
  const [threshold, setThreshold]         = useState(DEFAULT_THRESHOLDS);
  const [user, setUser]                   = useState(null);

  const notifId           = useRef(0);
  const liveSensorSeen    = useRef(false);
  const lastFirestoreSave = useRef(0);
  const lastSensorUpdate  = useRef(Date.now());
  const lastControlTime   = useRef(0);
  const manualModeRef     = useRef(false);
  // FIX: simpan status MQTT di ref agar bisa diakses di dalam interval callback
  const mqttStatusRef     = useRef("OFFLINE");

  const API_BASE = "http://localhost:3001/api";

  // ── Notifikasi ──────────────────────────────────────────────
  const addNotif = useCallback((message, type = "info") => {
    const id = ++notifId.current;
    setNotifications((prev) => [...prev.slice(-4), { id, message, type }]);
    setNotifCount((count) => count + 1);
    addNotification(message, type).catch(() => {});
    window.setTimeout(
      () => setNotifications((prev) => prev.filter((item) => item.id !== id)),
      5000
    );
  }, []);

  // ── Fetch sensor terakhir dari API ───────────────────────────
  const fetchLastFirestoreSensor = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/sensor/latest`);
      const data = await res.json();
      return data?.sensor || null;
    } catch {
      return null;
    }
  }, []);

  // ── Update sensor ────────────────────────────────────────────
  // FIX: tambah flag fromPolling agar data polling tidak masuk history
  //      saat MQTT sudah aktif dan data live sudah tersedia
  const updateSensor = useCallback(
    (rawSensor, { fromControl = false, fromPolling = false } = {}) => {
      const next = normalizeSensor(rawSensor);

      // FIX: tolak data dengan format waktu tidak valid (format titik = data lama Firestore)
      // Kecuali saat MQTT belum pernah terima data (liveSensorSeen masih false)
      if (fromPolling && liveSensorSeen.current && !isValidTimeFormat(next.time)) {
        return;
      }

      const controlLocked =
        !fromControl &&
        Date.now() - lastControlTime.current < CONTROL_LOCK_MS;

      setSensor((prev) => {
        const merged = {
          ...next,
          soil_hum:    next.soil_hum    ?? prev.soil_hum,
          soil_temp:   next.soil_temp   ?? prev.soil_temp,
          ph:          next.ph          ?? prev.ph,
          ec:          next.ec          ?? prev.ec,
          temperature: next.temperature ?? prev.temperature,
          humidity:    next.humidity    ?? prev.humidity,
          npk: {
            nitrogen:   next.npk?.nitrogen   ?? prev.npk?.nitrogen,
            phosphorus: next.npk?.phosphorus ?? prev.npk?.phosphorus,
            potassium:  next.npk?.potassium  ?? prev.npk?.potassium,
          },
        };

        if (controlLocked) {
          merged.pump_air     = prev.pump_air;
          merged.pump_nutrisi = prev.pump_nutrisi;
          merged.mode         = prev.mode;
        }

        if (manualModeRef.current) {
          merged.mode = prev.mode;
        }

        return merged;
      });

      // FIX: hanya tambah ke history kalau:
      // 1. Bukan dari polling, ATAU
      // 2. Dari polling tapi MQTT belum konek (benar-benar offline)
      const mqttConnected = mqttStatusRef.current === "CONNECTED";
      if (!fromPolling || !mqttConnected) {
        setHistory((prev) => [...prev.slice(-100), next]);
      }

      if (!controlLocked) {
        setPumpAir(next.pump_air === "ON");
        setPumpNutrisi(next.pump_nutrisi === "ON");
        if (!manualModeRef.current) {
          setMode(next.mode || "AUTO");
        }
      }

      lastSensorUpdate.current = Date.now();

      const now = Date.now();
      if (now - lastFirestoreSave.current > 30000) {
        lastFirestoreSave.current = now;
        addSensorReading(next).catch(() => {});
      }

      if (next.notif)       addNotif(next.notif,       "warning");
      if (next.rekomendasi) addNotif(next.rekomendasi, "info");
    },
    [addNotif]
  );

  // ── MQTT realtime ────────────────────────────────────────────
  useEffect(() => {
    const offStatus = mqttService.onStatus((status) => {
      setMqttStatus(status);
      // FIX: sinkronkan ref agar updateSensor bisa cek status tanpa closure stale
      mqttStatusRef.current = status;
    });
    const offSensor = mqttService.onSensor((rawSensor) => {
      liveSensorSeen.current = true;
      updateSensor(rawSensor);
    });
    mqttService.connect();
    return () => { offStatus(); offSensor(); };
  }, [updateSensor]);

  // ── Load data Firestore saat pertama buka ────────────────────
  // FIX: hanya update sensor display (bukan history) dari init load
  useEffect(() => {
    const init = async () => {
      const last = await fetchLastFirestoreSensor();
      if (last) {
        // Hanya pakai sebagai nilai awal tampilan, tidak masuk history
        // kecuali format waktunya valid (data baru)
        updateSensor(last, { fromPolling: true });
        if (isValidTimeFormat(last.time)) {
          liveSensorSeen.current = true;
        }
      }
    };
    init();
  }, [fetchLastFirestoreSensor, updateSensor]);

  // ── Fallback polling kalau MQTT tidak aktif ──────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      // FIX: skip polling kalau MQTT sudah konek dan data masih segar
      const mqttConnected = mqttStatusRef.current === "CONNECTED";
      const isDataFresh   = Date.now() - lastSensorUpdate.current < 15000;

      if (mqttConnected && isDataFresh) return;

      // Juga skip kalau data MQTT baru saja masuk (liveSensorSeen true + segar)
      if (liveSensorSeen.current && isDataFresh) return;

      const apiData = await fetchLastFirestoreSensor();
      if (apiData) {
        updateSensor(apiData, { fromPolling: true });
        // Hanya set liveSensorSeen kalau format waktu valid
        if (isValidTimeFormat(apiData.time)) {
          liveSensorSeen.current = true;
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [updateSensor, fetchLastFirestoreSensor]);

  // ── Auth + Threshold + Schedules ────────────────────────────
  useEffect(() => {
    const unsubscribeAuth = subscribeAuth(setUser);
    getThresholds()
      .then(setThreshold)
      .catch(() => setThreshold(DEFAULT_THRESHOLDS));
    const unsubscribeSchedules = listenSchedules((remoteSchedules) => {
      if (remoteSchedules.length) setSchedules(remoteSchedules);
    });
    return () => {
      unsubscribeAuth();
      unsubscribeSchedules();
    };
  }, []);

  // ── Kontrol pompa / mode ─────────────────────────────────────
  const handleControl = useCallback(
    async (action, value, source = "manual") => {
      lastControlTime.current = Date.now();

      if (action === "mode") {
        manualModeRef.current = value === "MANUAL";
      }

      if (action === "pump_air")     setPumpAir(value === "ON");
      if (action === "pump_nutrisi") setPumpNutrisi(value === "ON");
      if (action === "mode")         setMode(value);

      setSensor((prev) => ({
        ...prev,
        pump_air:     action === "pump_air"     ? value : prev.pump_air,
        pump_nutrisi: action === "pump_nutrisi" ? value : prev.pump_nutrisi,
        mode:         action === "mode"         ? value : prev.mode,
      }));

      mqttService.publishControl(action, value);
      saveControlLog(action, value, source).catch(() => {});
      sendControlCommand({ action, value, sensor }).catch(() => {});
      addNotif(`Action ${action} → ${value}`, "info");
    },
    [addNotif, sensor]
  );

  // ── Tambah jadwal ─────────────────────────────────────────────
  const addSchedule = async (schedule) => {
    setSchedules((prev) => [...prev, schedule]);
    await addScheduleToFirestore(schedule).catch(() => {});
    addNotif("Jadwal ditambahkan", "info");
  };

  // ── Hapus jadwal ──────────────────────────────────────────────
  const removeSchedule = async (id) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    addNotif("Jadwal dihapus", "info");
  };

  // ── Export CSV ────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["Waktu", "Soil Hum(%)", "Soil Temp(C)", "pH", "EC(uS/cm)", "N(mg/kg)", "P(mg/kg)", "K(mg/kg)", "Temp Udara(C)", "Hum Udara(%)"],
    ];
    // FIX: filter history, hanya export data dengan format waktu valid
    history
      .filter((item) => isValidTimeFormat(item.time))
      .forEach((item) =>
        rows.push([
          item.time,
          item.soil_hum    ?? "",
          item.soil_temp   ?? "",
          item.ph          ?? "",
          item.ec          ?? "",
          item.npk?.nitrogen   ?? "",
          item.npk?.phosphorus ?? "",
          item.npk?.potassium  ?? "",
          item.temperature ?? "",
          item.humidity    ?? "",
        ])
      );
    const csv  = rows.map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.href     = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = "sensor_data.csv";
    link.click();
  };

  // ── Simpan threshold ──────────────────────────────────────────
  const saveThreshold = async () => {
    await saveThresholds(threshold).catch(() => {});
    addNotif(
      isFirebaseReady ? "Threshold disimpan ke Firestore" : "Threshold disimpan (demo mode)",
      "info"
    );
  };

  // FIX: history bersih — hanya data dengan format waktu valid untuk ditampilkan
  const cleanHistory = history.filter((item) => isValidTimeFormat(item.time));

  const activeNav = NAV_ITEMS.find((item) => item.id === page) || NAV_ITEMS[0];

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "flex" }}>
      {/* ── Sidebar ── */}
      <aside
        className="sidebar"
        style={{
          width: 220,
          background: "#080f1e",
          borderRight: "1px solid #0f2035",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #0f2035" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#00b4d8",
              fontFamily: "'Rajdhani', sans-serif",
              letterSpacing: "0.05em",
            }}
          >
            SAWIT.IO
          </div>
          <div style={{ fontSize: 10, color: "#4a6580", marginTop: 2 }}>
            Smart Farming Dashboard v2.0
          </div>
        </div>

        <nav style={{ padding: "8px 0", flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 16px",
                background: "none",
                border: "none",
                borderLeft: "2px solid transparent",
                color: page === item.id ? "#e0f0ff" : "#6b829e",
                cursor: "pointer",
                fontSize: 13,
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: "#0d1b2a",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                }}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <SystemStatus
          sensor={sensor}
          mqttStatus={mqttStatus}
          firebaseReady={isFirebaseReady}
        />
      </aside>

      {/* ── Main Content ── */}
      <main
        className="dashboard-content"
        style={{ flex: 1, overflowY: "auto", padding: 24 }}
      >
        <Header
          activeNav={activeNav}
          sensor={sensor}
          mode={mode}
          notifCount={notifCount}
          clearNotif={() => setNotifCount(0)}
          user={user}
        />

        {page === "dashboard" && (
          <DashboardPage
            sensor={sensor}
            history={cleanHistory}
            pumpAir={pumpAir}
            pumpNutrisi={pumpNutrisi}
            mode={mode}
            threshold={threshold}
          />
        )}

        {page === "charts" && (
          <Panel title="Grafik Realtime">
            <ChartPanel history={cleanHistory} />
          </Panel>
        )}

        {page === "control" && (
          <ControlPage
            sensor={sensor}
            pumpAir={pumpAir}
            pumpNutrisi={pumpNutrisi}
            mode={mode}
            handleControl={handleControl}
          />
        )}

        {page === "schedule" && (
          <SchedulePanel
            schedules={schedules}
            addSchedule={addSchedule}
            removeSchedule={removeSchedule}
            onControl={handleControl}
          />
        )}

        {page === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={exportCSV} style={buttonStyle("#0d2a4a", "#4fc3f7")}>
                Export CSV
              </button>
            </div>
            <Panel title={`Riwayat Sensor (${cleanHistory.length} records)`}>
              <HistoryTable data={cleanHistory} />
            </Panel>
          </div>
        )}

        {page === "settings" && (
          <SettingsPage
            threshold={threshold}
            setThreshold={setThreshold}
            saveThreshold={saveThreshold}
          />
        )}
      </main>

      {/* ── AI Chat Button ── */}
      <button
        onClick={() => setChatOpen((open) => !open)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #0077b6, #00b4d8)",
          border: "none",
          cursor: "pointer",
          color: "#fff",
          fontWeight: 800,
          boxShadow: "0 4px 20px #00b4d866",
          zIndex: 8000,
          transform: chatOpen ? "scale(0.9)" : "scale(1)",
        }}
        title="Buka AI Assistant"
      >
        AI
      </button>

      <AIChatPanel
        sensor={sensor}
        onControl={handleControl}
        visible={chatOpen}
        onClose={() => setChatOpen(false)}
      />
      <Toast
        notifications={notifications}
        remove={(id) =>
          setNotifications((prev) => prev.filter((item) => item.id !== id))
        }
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────
function DashboardPage({ sensor, history, pumpAir, pumpNutrisi, mode, threshold }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <StatusCard
          label="Pompa Air"
          value={pumpAir ? "ON" : "OFF"}
          color={pumpAir ? "#00e676" : "#6b829e"}
        />
        <StatusCard
          label="Pompa Nutrisi"
          value={pumpNutrisi ? "ON" : "OFF"}
          color={pumpNutrisi ? "#00e676" : "#6b829e"}
        />
        <StatusCard
          label="Mode"
          value={mode}
          color={mode === "AUTO" ? "#00e676" : "#ffb74d"}
        />
        <StatusCard label="Total Data" value={history.length} color="#4fc3f7" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <SensorCard
          label={SENSOR_RANGES.soil_temp?.label  || "Suhu Tanah"}
          value={sensor.soil_temp}
          unit={SENSOR_RANGES.soil_temp?.unit     || "°C"}
          min={SENSOR_RANGES.soil_temp?.min       ?? 0}
          max={SENSOR_RANGES.soil_temp?.max       ?? 60}
          color={SENSOR_RANGES.soil_temp?.color   || "#ff8a65"}
          status={sensorStatus(sensor.soil_temp, 22, threshold.temperature_max)}
          decimals={1}
        />
        <SensorCard
          label={SENSOR_RANGES.soil_hum?.label   || "Kelembaban Tanah"}
          value={sensor.soil_hum}
          unit={SENSOR_RANGES.soil_hum?.unit      || "%"}
          min={SENSOR_RANGES.soil_hum?.min        ?? 0}
          max={SENSOR_RANGES.soil_hum?.max        ?? 100}
          color={SENSOR_RANGES.soil_hum?.color    || "#4fc3f7"}
          status={sensorStatus(sensor.soil_hum, threshold.soil_hum_min, 85)}
          decimals={0}
        />
        <SensorCard
          label={SENSOR_RANGES.ph?.label          || "pH Tanah"}
          value={sensor.ph}
          unit={SENSOR_RANGES.ph?.unit            || ""}
          min={SENSOR_RANGES.ph?.min              ?? 0}
          max={SENSOR_RANGES.ph?.max              ?? 14}
          color={SENSOR_RANGES.ph?.color          || "#ce93d8"}
          status={sensorStatus(sensor.ph, threshold.ph_min, threshold.ph_max)}
          decimals={2}
        />
        <SensorCard
          label={SENSOR_RANGES.ec?.label          || "EC"}
          value={sensor.ec}
          unit={SENSOR_RANGES.ec?.unit            || "uS/cm"}
          min={SENSOR_RANGES.ec?.min              ?? 0}
          max={SENSOR_RANGES.ec?.max              ?? 500}
          color={SENSOR_RANGES.ec?.color          || "#80cbc4"}
          status={sensorStatus(sensor.ec, 40, threshold.ec_max)}
          decimals={1}
        />
        <SensorCard
          label={SENSOR_RANGES.temperature?.label || "Suhu Udara"}
          value={sensor.temperature}
          unit={SENSOR_RANGES.temperature?.unit   || "°C"}
          min={SENSOR_RANGES.temperature?.min     ?? 0}
          max={SENSOR_RANGES.temperature?.max     ?? 60}
          color={SENSOR_RANGES.temperature?.color || "#ffb74d"}
          status={sensorStatus(sensor.temperature, 24, threshold.temperature_max)}
          decimals={1}
        />
        <SensorCard
          label={SENSOR_RANGES.humidity?.label    || "Kelembaban Udara"}
          value={sensor.humidity}
          unit={SENSOR_RANGES.humidity?.unit      || "%"}
          min={SENSOR_RANGES.humidity?.min        ?? 0}
          max={SENSOR_RANGES.humidity?.max        ?? 100}
          color={SENSOR_RANGES.humidity?.color    || "#81d4fa"}
          status={sensorStatus(sensor.humidity, 45, 95)}
          decimals={0}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <NpkCard
          label="Nitrogen"
          value={sensor.npk?.nitrogen}
          color="#80cbc4"
          data={history.map((item) => item.npk?.nitrogen   ?? 0)}
        />
        <NpkCard
          label="Phosphorus"
          value={sensor.npk?.phosphorus}
          color="#f48fb1"
          data={history.map((item) => item.npk?.phosphorus ?? 0)}
        />
        <NpkCard
          label="Potassium"
          value={sensor.npk?.potassium}
          color="#ffe082"
          data={history.map((item) => item.npk?.potassium  ?? 0)}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONTROL PAGE
// ─────────────────────────────────────────────────────────────
function ControlPage({ sensor, pumpAir, pumpNutrisi, mode, handleControl }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 20,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Panel title="Kontrol Pompa Air">
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="ctrl-btn"
              onClick={() => handleControl("pump_air", "ON")}
              style={buttonStyle(pumpAir ? "#0d4a2b" : "#0d2a4a", "#e0f0ff")}
            >
              ON
            </button>
            <button
              className="ctrl-btn"
              onClick={() => handleControl("pump_air", "OFF")}
              style={buttonStyle(!pumpAir ? "#4a1d1d" : "#1e3a5f", "#e0f0ff")}
            >
              OFF
            </button>
          </div>
        </Panel>

        <Panel title="Kontrol Pompa Nutrisi">
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="ctrl-btn"
              onClick={() => handleControl("pump_nutrisi", "ON")}
              style={buttonStyle(pumpNutrisi ? "#0d4a2b" : "#0d2a4a", "#e0f0ff")}
            >
              ON
            </button>
            <button
              className="ctrl-btn"
              onClick={() => handleControl("pump_nutrisi", "OFF")}
              style={buttonStyle(!pumpNutrisi ? "#4a1d1d" : "#1e3a5f", "#e0f0ff")}
            >
              OFF
            </button>
          </div>
        </Panel>

        <Panel title="Mode Sistem">
          <div style={{ display: "flex", gap: 10 }}>
            {["AUTO", "MANUAL"].map((item) => (
              <button
                key={item}
                className="ctrl-btn"
                onClick={() => handleControl("mode", item)}
                style={buttonStyle(
                  mode === item ? "#0f3460" : "#0d1b2a",
                  item === "AUTO" ? "#4fc3f7" : "#ffb74d"
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="MQTT Payload Preview">
        <pre
          style={{
            margin: 0,
            fontSize: 11,
            color: "#81c784",
            lineHeight: 1.6,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(
            {
              device_id:    sensor.device_id,
              time:         sensor.time,
              date:         sensor.date,
              soil_temp:    sensor.soil_temp,
              soil_hum:     sensor.soil_hum,
              ph:           sensor.ph,
              ec:           sensor.ec,
              npk:          sensor.npk,
              temperature:  sensor.temperature,
              humidity:     sensor.humidity,
              pump_air:     pumpAir ? "ON" : "OFF",
              pump_nutrisi: pumpNutrisi ? "ON" : "OFF",
              mode,
            },
            null,
            2
          )}
        </pre>
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────
function SettingsPage({ threshold, setThreshold, saveThreshold }) {
  const items = [
    { label: "Kelembaban Tanah Min (%)", key: "soil_hum_min",   min: 0,  max: 100, step: 1   },
    { label: "pH Minimum",              key: "ph_min",          min: 0,  max: 14,  step: 0.1 },
    { label: "pH Maximum",              key: "ph_max",          min: 0,  max: 14,  step: 0.1 },
    { label: "EC Maximum (uS/cm)",      key: "ec_max",          min: 0,  max: 500, step: 1   },
    { label: "Nitrogen Min (mg/kg)",    key: "nitrogen_min",    min: 0,  max: 250, step: 1   },
    { label: "Suhu Max (°C)",           key: "temperature_max", min: 20, max: 50,  step: 1   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <Panel title="Threshold Settings">
        {items.map((item) => (
          <div key={item.key} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
                gap: 12,
              }}
            >
              <label style={{ fontSize: 12, color: "#8099b8" }}>{item.label}</label>
              <span style={{ fontSize: 13, color: "#4fc3f7", fontWeight: 600 }}>
                {threshold[item.key] != null ? threshold[item.key] : "—"}
              </span>
            </div>
            <input
              type="range"
              min={item.min}
              max={item.max}
              step={item.step}
              value={threshold[item.key] ?? item.min}
              onChange={(e) =>
                setThreshold((prev) => ({
                  ...prev,
                  [item.key]: Number(e.target.value),
                }))
              }
              style={{ width: "100%", accentColor: "#00b4d8" }}
            />
          </div>
        ))}
        <button onClick={saveThreshold} style={buttonStyle("#0d2a4a", "#4fc3f7")}>
          Simpan Threshold
        </button>
      </Panel>

      <Panel title="MQTT Topics">
        {[
          ["Sensor",                MQTT_TOPICS.sensorAll],
          ["Kontrol Pompa Air",     MQTT_TOPICS.controlPumpAir],
          ["Kontrol Pompa Nutrisi", MQTT_TOPICS.controlPumpNutrisi],
          ["Kontrol Mode",          MQTT_TOPICS.controlMode],
        ].map(([label, topic]) => (
          <div
            key={topic}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "7px 0",
              borderBottom: "1px solid #0f2035",
              fontSize: 12,
              gap: 16,
            }}
          >
            <span style={{ color: "#8099b8" }}>{label}</span>
            <code style={{ color: "#81c784", fontSize: 11 }}>{topic}</code>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HEADER
// ─────────────────────────────────────────────────────────────
function Header({ activeNav, sensor, mode, notifCount, clearNotif, user }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
        gap: 16,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: "#e0f0ff",
            margin: 0,
            letterSpacing: "0.05em",
          }}
        >
          {activeNav.label.toUpperCase()}
        </h1>
        <div style={{ fontSize: 11, color: "#4a6580" }}>
          Pembibitan Kelapa Sawit — {sensor.device_id}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <AuthPanel user={user} />
        <div
          style={{
            background: "#0d1b2a",
            border: "1px solid #1e3a5f",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#8099b8" }}>Mode: </span>
          <span
            style={{
              color: mode === "AUTO" ? "#00e676" : "#ffb74d",
              fontWeight: 600,
            }}
          >
            {mode}
          </span>
        </div>
        <button
          onClick={clearNotif}
          style={{
            ...buttonStyle("#0d1b2a", "#8099b8"),
            position: "relative",
            padding: "6px 12px",
          }}
        >
          Notif
          {notifCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                background: "#ef5350",
                borderRadius: "50%",
                width: 18,
                height: 18,
                fontSize: 10,
                display: "grid",
                placeItems: "center",
                color: "#fff",
              }}
            >
              {Math.min(notifCount, 9)}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SYSTEM STATUS (sidebar bawah)
// ─────────────────────────────────────────────────────────────
function SystemStatus({ sensor, mqttStatus, firebaseReady }) {
  return (
    <div style={{ padding: 16, borderTop: "1px solid #0f2035" }}>
      <div style={{ fontSize: 10, color: "#4a6580", marginBottom: 8 }}>
        SYSTEM STATUS
      </div>
      <StatusLine
        color={sensor.device_status === "ONLINE" ? "#00e676" : "#ef5350"}
        text={`Device: ${sensor.device_status}`}
      />
      <StatusLine
        color={mqttStatus === "CONNECTED" ? "#00e676" : "#ffb74d"}
        text={`MQTT: ${mqttStatus}`}
      />
      <StatusLine
        color={firebaseReady ? "#00e676" : "#6b829e"}
        text={`Firebase: ${firebaseReady ? "READY" : "DEMO"}`}
      />
      <div style={{ fontSize: 11, color: "#4a6580" }}>
        WiFi: {sensor.wifi_signal} dBm ({wifiQuality(sensor.wifi_signal)})
      </div>
      <div style={{ fontSize: 10, color: "#4a6580", marginTop: 4 }}>
        {sensor.date} {sensor.time}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
function StatusLine({ color, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          animation: "glow-pulse 2s infinite",
        }}
      />
      <span style={{ fontSize: 11, color: "#8099b8" }}>{text}</span>
    </div>
  );
}

function StatusCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "#0d1b2a",
        border: "1px solid #1e3a5f",
        borderRadius: 8,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#6b829e",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function NpkCard({ label, value, color, data }) {
  return (
    <div
      style={{
        background: "#0d1b2a",
        border: `1px solid ${color}33`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
          gap: 12,
        }}
      >
        <span style={{ fontSize: 12, color: "#8099b8" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>
          {value != null ? value : "—"} mg/kg
        </span>
      </div>
      <SparkLine data={data.slice(-24)} color={color} />
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section
      style={{
        background: "#0d1b2a",
        border: "1px solid #1e3a5f",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: "#4fc3f7",
          marginBottom: 14,
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function buttonStyle(background, color) {
  return {
    background,
    border: "1px solid #1e3a5f",
    borderRadius: 8,
    padding: "8px 16px",
    color,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  };
}