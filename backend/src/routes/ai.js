import { Router } from "express";
import { chatWithAI } from "../services/aiService.js";
import { addChatMessage } from "../services/firestoreService.js";

const router = Router();

router.post("/chat", async (req, res, next) => {
  try {
    const { messages = [], sensor = {} } = req.body;

    console.log("=== CHAT REQUEST ===");
    console.log("Messages:", JSON.stringify(messages, null, 2));

    const reply = await chatWithAI({ messages, sensor });

    console.log("=== AI REPLY ===");
    console.log(reply);

    await addChatMessage({
      role: "assistant",
      content: reply,
      sensorDeviceId: sensor.device_id || null
    }).catch((err) => {
      console.error("Firestore Error:", err);
    });

    res.json({ reply });

  } catch (error) {
    console.error("=== CHAT ERROR ===");
    console.error(error);

    next(error);
  }
});

export default router;