import { Router } from "express";
import { addControlLog } from "../services/firestoreService.js";
import { publishControl } from "../services/mqttService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { action, value, source = "api" } = req.body;
    const result = publishControl(action, value);
    await addControlLog(action, value, source).catch(() => {});
    res.json({ ...result, action, value });
  } catch (error) {
    next(error);
  }
});

export default router;
