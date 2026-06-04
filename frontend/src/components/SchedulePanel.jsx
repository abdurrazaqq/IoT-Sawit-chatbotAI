import { useState } from "react";

export default function SchedulePanel({ schedules, addSchedule }) {
  const [form, setForm] = useState({ type: "air", time: "06:00", duration: 10, days: "Setiap hari", active: true });

  const submit = () => {
    addSchedule({ ...form, duration: Number(form.duration) || 1 });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          background: "#0d1b2a",
          border: "1px solid #1e3a5f",
          borderRadius: 8,
          padding: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12
        }}
      >
        <Field label="Tipe Pompa">
          <select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))} style={fieldStyle}>
            <option value="air">Pompa Air</option>
            <option value="nutrisi">Pompa Nutrisi</option>
          </select>
        </Field>
        <Field label="Waktu">
          <input type="time" value={form.time} onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))} style={fieldStyle} />
        </Field>
        <Field label="Durasi (menit)">
          <input
            type="number"
            value={form.duration}
            min={1}
            max={60}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            style={fieldStyle}
          />
        </Field>
        <Field label="Pengulangan">
          <select value={form.days} onChange={(event) => setForm((prev) => ({ ...prev, days: event.target.value }))} style={fieldStyle}>
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
            cursor: "pointer"
          }}
        >
          Tambah Jadwal
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {schedules.map((schedule, index) => (
          <div
            key={schedule.id || `${schedule.time}-${index}`}
            style={{
              background: "#0d1b2a",
              border: "1px solid #1e3a5f",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16
            }}
          >
            <div>
              <span style={{ color: schedule.type === "air" ? "#4fc3f7" : "#81c784", fontSize: 13, fontWeight: 600 }}>
                {schedule.type === "air" ? "Pompa Air" : "Pompa Nutrisi"}
              </span>
              <span style={{ color: "#8099b8", fontSize: 12, marginLeft: 10 }}>
                {schedule.time} - {schedule.duration} menit - {schedule.days}
              </span>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: schedule.active ? "#00e676" : "#6b829e" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "#8099b8", textTransform: "uppercase" }}>{label}</span>
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
  fontSize: 13
};
