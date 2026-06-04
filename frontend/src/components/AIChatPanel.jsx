import { useEffect, useRef, useState } from "react";
import { sendAIMessage } from "../services/apiService.js";
import { addChatMessage } from "../firebase/firestoreService.js";

const INITIAL_MESSAGE = {
  role: "assistant",
  content: "Halo. Saya AI Assistant Smart Farming. Saya bisa menganalisis sensor dan membantu kontrol pompa."
};

export default function AIChatPanel({ sensor, onControl, visible, onClose }) {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    const cleanText = text.trim();
    if (!cleanText || loading) return;

    const userMessage = { role: "user", content: cleanText };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    addChatMessage({ role: "user", content: cleanText, sensorDeviceId: sensor.device_id }).catch(() => {});

    try {
      const data = await sendAIMessage({ messages: nextMessages, sensor });
      const reply = data.reply || "Maaf, AI belum memberi jawaban.";
      const action = parseAction(reply);
      const cleanReply = reply
        .replace(/\{\s*"action"\s*:\s*"[^"]+"\s*,\s*"value"\s*:\s*"[^"]+"\s*\}/g, "")
        .trim();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: cleanReply
        }
      ]);
      if (action) {
        onControl(action.action, action.value, "ai");
      }
      speak(cleanReply);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Maaf, tidak dapat terhubung ke AI saat ini. ${error.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Voice command belum didukung browser ini." }]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      sendMessage(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  if (!visible) return null;

  return (
    <div
      className="ai-panel"
      style={{
        position: "fixed",
        bottom: 90,
        right: 20,
        width: 380,
        height: 520,
        zIndex: 9000,
        background: "#0a1628",
        border: "1px solid #1e3a5f",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 20px 60px #000a"
      }}
    >
      <div style={{ background: "linear-gradient(90deg, #0d2a4a, #0f3460)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0077b6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
          AI
        </div>
        <div>
          <div style={{ color: "#e0f0ff", fontWeight: 600, fontSize: 14 }}>AI Smart Assistant</div>
          <div style={{ color: "#4fc3f7", fontSize: 11 }}>Online - Bahasa Indonesia</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "#9bb7d4", cursor: "pointer", fontSize: 18 }}>
          x
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={{
                maxWidth: "82%",
                padding: "8px 12px",
                borderRadius: message.role === "user" ? "12px 12px 0 12px" : "12px 12px 12px 0",
                background: message.role === "user" ? "linear-gradient(135deg, #0077b6, #00b4d8)" : "#132236",
                color: "#e0f0ff",
                fontSize: 13,
                lineHeight: 1.5,
                border: message.role === "assistant" ? "1px solid #1e3a5f" : "none",
                whiteSpace: "pre-wrap"
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 4, padding: "8px 12px" }}>
            {[0, 1, 2].map((index) => (
              <div key={index} style={{ width: 6, height: 6, borderRadius: "50%", background: "#00b4d8", animation: `bounce 1s ease ${index * 0.15}s infinite` }} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid #1e3a5f", display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={toggleVoice}
          title="Voice command"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: listening ? "#ef5350" : "#1e3a5f",
            color: "#fff",
            flexShrink: 0
          }}
        >
          {listening ? "Stop" : "Mic"}
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && sendMessage(input)}
          placeholder="Tanya kondisi tanah..."
          style={{
            flex: 1,
            minWidth: 0,
            background: "#132236",
            border: "1px solid #1e3a5f",
            borderRadius: 20,
            padding: "8px 14px",
            color: "#e0f0ff",
            fontSize: 13,
            outline: "none"
          }}
        />
        <button
          type="button"
          onClick={() => sendMessage(input)}
          title="Kirim pesan"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, #00b4d8, #0077b6)",
            color: "#fff",
            flexShrink: 0
          }}
        >
          Go
        </button>
      </div>
    </div>
  );
}

function parseAction(reply) {
  const match = reply.match(/\{\s*"action"\s*:\s*"([^"]+)"\s*,\s*"value"\s*:\s*"([^"]+)"\s*\}/);
  if (!match) return null;
  return { action: match[1], value: match[2] };
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const clean = text.replace(/\{.*?\}/g, "").trim();
  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean.slice(0, 400));
  utterance.lang = "id-ID";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
