import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import aiRoutes from "./routes/ai.js";
import controlRoutes from "./routes/control.js";
import sensorRoutes from "./routes/sensor.js";
import { connectMqtt } from "./services/mqttService.js";

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sawit-iot-backend",
    ai: Boolean(process.env.GEMINI_API_KEY),
    mqtt: Boolean(process.env.MQTT_BROKER_URL)
  });
});

app.use("/api/ai", aiRoutes);
app.use("/api/control", controlRoutes);
app.use("/api/sensor", sensorRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

connectMqtt();

app.listen(port, () => {
  console.log(`SAWIT.IO backend running on http://localhost:${port}`);
  console.log("MQTT URL:", process.env.MQTT_BROKER_URL);
  console.log("MQTT USER:", process.env.MQTT_USERNAME);
});
