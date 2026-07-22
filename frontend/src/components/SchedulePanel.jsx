import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────
// HELPER: cek apakah jadwal harus jalan hari ini
// ─────────────────────────────────────────────────────────────
function shouldRunToday(days) {
  const day = new Date().getDay(); // 0=Minggu, 1=Senin, ..., 6=Sabtu
  if (days === "Setiap hari") return true;
  if (days === "Senin - Jumat") return day >= 1 && day <= 5;
  if (days === "Sabtu - Minggu") return day === 0 || day === 6;
  return false;
}

// ─────────────────────────────────────────────────────────────
// HELPER: format HH:MM dari Date sekarang
// ─────────────────────────────────────────────────────────────
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// SCHEDULE PANEL
// Props baru: onControl — sama persis dengan handleControl di dashboard
// ─────────────────────────────────────────────────────────────
export default function SchedulePanel({ schedules, addSchedule, removeSchedule, onControl }) {
  const [form, setForm] = useState({
    type: "air",
    time: "06:00",
    duration: 10,
    days: "Setiap hari",
    active: true,
  });

  // Catat jadwal yang sedang aktif berjalan supaya tidak dobel trigger
  // key: scheduleId, value: timestamp kapan pompa dinyalakan
  const runningRef = useRef({});

  // ── SCHEDULER ENGINE ───────────────────────────────────────
  // Cek setiap 15 detik apakah ada jadwal yang harus dijalankan.
  // Resolusi 15 detik cukup karena jadwal berbasis menit (HH:MM).
  useEffect(() => {
    if (!onControl) return; // jaga-jaga kalau prop tidak dikirim

    const tick = () => {
      const currentTime = nowHHMM();
      const now         = Date.now();

      schedules.forEach((schedule) => {
        if (!schedule.active)            return; // jadwal nonaktif, skip
        if (schedule.time !== currentTime) return; // belum waktunya
        if (!shouldRunToday(schedule.days)) return; // bukan hari ini

        const id           = schedule.id || `${schedule.time}-${schedule.type}`;
        const lastRun      = runningRef.current[id];
        const durationMs   = (Number(schedule.duration) || 1) * 60 * 1000;

        // Sudah jalan dalam 1 menit terakhir? skip (hindari dobel trigger
        // karena tick bisa kena beberapa kali dalam 1 menit yang sama)
        if (lastRun && now - lastRun < 60_000) return;

        // Tentukan action berdasarkan tipe pompa
        const action = schedule.type === "nutrisi" ? "pump_nutrisi" : "pump_air";

        // Nyalakan pompa
        onControl(action, "ON", "schedule");
        runningRef.current[id] = now;

        // Matikan pompa setelah durasi habis
        setTimeout(() => {
          onControl(action, "OFF", "schedule");
          delete runningRef.current[id];
        }, durationMs);
      });
    };

    const interval = setInterval(tick, 15_000);
    tick(); // jalankan sekali langsung supaya tidak harus nunggu 15 detik
    return () => clearInterval(interval);
  }, [schedules, onControl]);

  // ── SUBMIT FORM ────────────────────────────────────────────
  const submit = () => {
    if (!form.time) return;
    addSchedule({
      ...form,
      duration: Number(form.duration) || 1,
      id: `sched_${Date.now()}`,
    });
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Form tambah jadwal ── */}
      <div
        style={{
          background: "#0d1b2a",
          border: "1px solid #1e3a5f",
          borderRadius: 8,
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <Field label="Tipe Pompa">
          <select
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            style={fieldStyle}
          >
            <option value="air">Pompa Air</option>
            <option value="nutrisi">Pompa Nutrisi</option>
          </select>
        </Field>

        <Field label="Waktu">
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
            style={fieldStyle}
          />
        </Field>

        <Field label="Durasi (menit)">
          <input
            type="number"
            value={form.duration}
            min={1}
            max={60}
            onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
            style={fieldStyle}
          />
        </Field>

        <Field label="Pengulangan">
          <select
            value={form.days}
            onChange={(e) => setForm((prev) => ({ ...prev, days: e.target.value }))}
            style={fieldStyle}
          >
            <option>Setiap hari</option>
            <option>Senin - Jumat</option>
            <option>Sabtu - Minggu</option>
          </select>
        </Field>

        <button
          type="button"
          onClick={submit}
          style={{
            gridColumn: "1/-1",
            background: "linear-gradient(90deg, #0077b6, #00b4d8)",
            border: "none",
            borderRadius: 8,
            padding: "10px",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tambah Jadwal
        </button>
      </div>

      {/* ── Daftar jadwal ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {schedules.length === 0 && (
          <div style={{ color: "#4a6580", fontSize: 13, textAlign: "center", padding: 20 }}>
            Belum ada jadwal. Tambahkan jadwal di atas.
          </div>
        )}

        {schedules.map((schedule, index) => {
          const id      = schedule.id || `${schedule.time}-${index}`;
          const running = !!runningRef.current[id];
          const action  = schedule.type === "nutrisi" ? "pump_nutrisi" : "pump_air";

          return (
            <div
              key={id}
              style={{
                background: "#0d1b2a",
                border: `1px solid ${running ? "#00e67644" : "#1e3a5f"}`,
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <span
                  style={{
                    color: schedule.type === "air" ? "#4fc3f7" : "#81c784",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {schedule.type === "air" ? "Pompa Air" : "Pompa Nutrisi"}
                </span>
                <span style={{ color: "#8099b8", fontSize: 12, marginLeft: 10 }}>
                  {schedule.time} — {schedule.duration} menit — {schedule.days}
                </span>
                {running && (
                  <span style={{ color: "#00e676", fontSize: 11, marginLeft: 10 }}>
                    ● Sedang berjalan
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Toggle aktif/nonaktif */}
                <button
                  onClick={() =>
                    addSchedule({ ...schedule, active: !schedule.active })
                  }
                  title={schedule.active ? "Nonaktifkan" : "Aktifkan"}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: schedule.active ? "#00e676" : "#6b829e",
                    }}
                  />
                </button>

                {/* Tombol hapus */}
                {removeSchedule && (
                  <button
                    onClick={() => removeSchedule(schedule.id)}
                    style={{
                      background: "none",
                      border: "1px solid #4a1d1d",
                      borderRadius: 4,
                      color: "#ef5350",
                      fontSize: 11,
                      padding: "2px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "#8099b8", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const fieldStyle = {
  width: "100%",
  background: "#132236",
  border: "1px solid #1e3a5f",
  borderRadius: 6,
  padding: "8px 10px",
  color: "#e0f0ff",
  fontSize: 13,
};