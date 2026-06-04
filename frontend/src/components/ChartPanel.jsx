import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function ChartPanel({ history }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || history.length < 2) return undefined;
    if (chartRef.current) chartRef.current.destroy();

    const sample = history.slice(-30);
    const labels = sample.map((item) => item.time);
    const mkDataset = (label, key, color, dash = []) => ({
      label,
      data: sample.map((item) => key.split(".").reduce((value, prop) => value?.[prop], item)),
      borderColor: color,
      backgroundColor: `${color}22`,
      borderWidth: 1.5,
      borderDash: dash,
      tension: 0.4,
      pointRadius: 0,
      fill: false
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          mkDataset("Kelembaban Tanah %", "soil_hum", "#4fc3f7"),
          mkDataset("pH x10", "ph", "#81c784", [5, 3]),
          mkDataset("Suhu Tanah", "soil_temp", "#ff8a65", [2, 2]),
          mkDataset("Nitrogen", "npk.nitrogen", "#80cbc4", [8, 3])
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { labels: { color: "#8099b8", font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: "#4a6580", font: { size: 9 } }, grid: { color: "#0f2035" } },
          y: { ticks: { color: "#4a6580", font: { size: 10 } }, grid: { color: "#0f2035" } }
        }
      }
    });

    return () => chartRef.current?.destroy();
  }, [history]);

  return (
    <div style={{ position: "relative", height: 260 }}>
      <canvas ref={canvasRef} role="img" aria-label="Grafik sensor realtime" />
    </div>
  );
}
