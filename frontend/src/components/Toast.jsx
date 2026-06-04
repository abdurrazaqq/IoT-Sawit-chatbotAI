export default function Toast({ notifications, remove }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {notifications.map((item) => {
        const color = item.type === "error" ? "#ef5350" : item.type === "warning" ? "#ffb74d" : "#00e676";
        const background = item.type === "error" ? "#2d0a0a" : item.type === "warning" ? "#2d1f0a" : "#0a2d1a";

        return (
          <div
            key={item.id}
            style={{
              background,
              border: `1px solid ${color}`,
              borderRadius: 8,
              padding: "10px 16px",
              color: "#e0e8f0",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 280,
              maxWidth: 360,
              animation: "slide-in 0.3s ease"
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{item.message}</span>
            <button
              type="button"
              onClick={() => remove(item.id)}
              style={{ background: "none", border: "none", color: "#6b829e", cursor: "pointer", fontSize: 16 }}
              aria-label="Tutup notifikasi"
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
