import { Router } from "express";
import { getLatestSensor } from "../services/mqttService.js";

const router = Router();

router.get("/latest", (_req, res) => {
  res.json({ sensor: getLatestSensor() });
});

export default router;
  