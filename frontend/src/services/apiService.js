const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

async function request(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      body: options.body ? options.body : undefined
    });

    if (!res.ok) {
      const message = await res.text();
      throw new Error(message || `Request gagal: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.log("API ERROR:", err.message);
    throw new Error("Backend tidak terhubung atau request gagal");
  }
}

export function sendAIMessage({ messages, sensor }) {
  return request("/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      messages,
      sensor
    })
  });
}

export function sendControlCommand({ action, value, sensor }) {
  return request("/control", {
    method: "POST",
    body: JSON.stringify({
      action,
      value,
      sensor
    })
  });
}