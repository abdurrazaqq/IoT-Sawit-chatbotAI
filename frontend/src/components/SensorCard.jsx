import AnimNum from "./AnimNum.jsx";

export default function SensorCard({ label, value, unit, min, max, color, decimals = 2, status }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min || 1)) * 100));
  const statusColor = status === "normal" ? "#00e676" : status === "warning" ? "#ffb74d" : "#ef5350";

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0d1b2a 0%, #0f2035 100%)",
        border: `1px solid ${color}33`,
        borderRadius: 8,
        padding: "14px 16px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 60,
          height: 60,
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, color: "#8099b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        {status && (
          <span style={{ fontSize: 10, color: statusColor, fontWeight: 700 }}>{status.toUpperCase()}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color,
            textShadow: `0 0 12px ${color}66`
          }}
        >
          <AnimNum value={value} decimals={decimals} />
        </span>
        <span style={{ fontSize: 12, color: "#6b829e" }}>{unit}</span>
      </div>
      <div style={{ height: 3, background: "#1a2e44", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.6s ease",
            boxShadow: `0 0 6px ${color}`
          }}
        />
      </div>
    </div>
  );
}
