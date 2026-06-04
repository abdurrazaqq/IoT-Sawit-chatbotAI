export default function HistoryTable({ data }) {
  const headers = ["Waktu", "Tanah", "Kelembaban", "pH", "EC", "N", "P", "K", "Udara", "Hum"];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#0d1b2a" }}>
            {headers.map((heading) => (
              <th
                key={heading}
                style={{ padding: "8px 12px", color: "#4fc3f7", textAlign: "left", borderBottom: "1px solid #1e3a5f" }}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data
            .slice()
            .reverse()
            .slice(0, 20)
            .map((item, index) => (
              <tr key={`${item.time}-${index}`} style={{ borderBottom: "1px solid #0f2035", background: index % 2 === 0 ? "#0a1628" : "#0b1c30" }}>
                <td style={{ padding: "6px 12px", color: "#8099b8" }}>{item.time}</td>
                <td style={{ padding: "6px 12px", color: "#ff8a65" }}>{item.soil_temp}</td>
                <td style={{ padding: "6px 12px", color: "#4fc3f7" }}>{item.soil_hum}</td>
                <td style={{ padding: "6px 12px", color: "#81c784" }}>{item.ph}</td>
                <td style={{ padding: "6px 12px", color: "#ce93d8" }}>{item.ec}</td>
                <td style={{ padding: "6px 12px", color: "#80cbc4" }}>{item.npk?.nitrogen}</td>
                <td style={{ padding: "6px 12px", color: "#f48fb1" }}>{item.npk?.phosphorus}</td>
                <td style={{ padding: "6px 12px", color: "#ffe082" }}>{item.npk?.potassium}</td>
                <td style={{ padding: "6px 12px", color: "#ffb74d" }}>{item.temperature}</td>
                <td style={{ padding: "6px 12px", color: "#64b5f6" }}>{item.humidity}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
