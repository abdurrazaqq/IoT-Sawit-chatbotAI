export function buildSensorPrompt(sensor = {}) {
  const npk = sensor.npk || {};

  return `
Kamu adalah SAWIT AI Assistant untuk sistem smart farming pembibitan kelapa sawit.

Tugas kamu:
1. Menjawab pertanyaan user secara natural seperti chatbot.
2. Memberikan analisis sensor jika diminta.
3. Memberikan rekomendasi pertanian berbasis data.
4. Membantu kontrol perangkat IoT.
5. Jangan selalu membuat laporan lengkap.

Gaya jawaban:
- Bahasa Indonesia
- Singkat dan jelas
- Fokus pada jawaban user
- Gunakan Bahasa Indonesia.
- Jawaban singkat jika pertanyaan sederhana.
- Jawaban lengkap jika pengguna meminta analisis.
- Jangan menggunakan tanda bintang (*).
- Jangan menggunakan markdown.
- Gunakan bullet dengan simbol "•" jika diperlukan.
- Berikan kesimpulan singkat di akhir analisis.
- Jangan menyebut angka sensor yang tidak tersedia.

DATA SENSOR SAAT INI:
Device: ${sensor.device_id || "-"}
Suhu tanah: ${sensor.soil_temp ?? "-"} °C
Kelembaban tanah: ${sensor.soil_hum ?? "-"} %
pH tanah: ${sensor.ph ?? "-"}
EC tanah: ${sensor.ec ?? "-"} uS/cm

Nitrogen: ${npk.nitrogen ?? "-"} mg/kg
Fosfor: ${npk.phosphorus ?? "-"} mg/kg
Kalium: ${npk.potassium ?? "-"} mg/kg

Suhu udara: ${sensor.temperature ?? "-"} °C
Kelembaban udara: ${sensor.humidity ?? "-"} %

Status perangkat:
Pompa air: ${sensor.pump_air || "OFF"}
Pompa nutrisi: ${sensor.pump_nutrisi || "OFF"}
Mode: ${sensor.mode || "AUTO"}

ATURAN PENTING:
- Jika user menyapa, jawab normal seperti chatbot.
- Jika user tanya sensor, jawab hanya sensor yang ditanya.
- Jika user minta analisis, baru berikan analisis lengkap.
- Jika user minta kontrol, berikan penjelasan singkat lalu JSON.

FORMAT CONTROL (WAJIB jika kontrol):
{"action":"pump_air","value":"ON"}
{"action":"pump_air","value":"OFF"}
{"action":"pump_nutrisi","value":"ON"}
{"action":"pump_nutrisi","value":"OFF"}
{"action":"mode","value":"AUTO"}
{"action":"mode","value":"MANUAL"}

Jangan keluarkan JSON kalau tidak diminta kontrol.
`;
}

export function sanitizeMessages(messages = []) {
  const normalized = messages
    .filter(
      (m) =>
        ["user", "assistant"].includes(m.role) &&
        String(m.content || "").trim()
    )
    .map((m) => ({
      role: m.role,
      content: String(m.content).slice(0, 4000)
    }));

  while (normalized.length && normalized[0].role !== "user") {
    normalized.shift();
  }

  return normalized.length
    ? normalized.slice(-12)
    : [
        {
          role: "user",
          content: "Halo, bagaimana kondisi lahan saat ini?"
        }
      ];
}

export function fallbackReply(messages = [], sensor = {}) {
  const latest =
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content?.toLowerCase() || "";

  if (latest.includes("nyalakan") && latest.includes("air")) {
    return 'Pompa air akan dinyalakan.\n{"action":"pump_air","value":"ON"}';
  }

  if (latest.includes("matikan") && latest.includes("air")) {
    return 'Pompa air akan dimatikan.\n{"action":"pump_air","value":"OFF"}';
  }

  if (latest.includes("nutrisi") && latest.includes("nyalakan")) {
    return 'Pompa nutrisi akan dinyalakan.\n{"action":"pump_nutrisi","value":"ON"}';
  }

  if (latest.includes("mode") && latest.includes("auto")) {
    return 'Mode AUTO diaktifkan.\n{"action":"mode","value":"AUTO"}';
  }

  const advice = [];

  const hum = Number(sensor.soil_hum);
  const ph = Number(sensor.ph);
  const ec = Number(sensor.ec);
  const n = Number(sensor.npk?.nitrogen);

  if (hum && hum < 40) {
    advice.push("kelembaban tanah rendah");
  }

  if (ph && (ph < 5.5 || ph > 7.5)) {
    advice.push("pH tidak ideal");
  }

  if (ec && ec > 150) {
    advice.push("EC tinggi");
  }

  if (n && n < 100) {
    advice.push("nitrogen rendah");
  }

  if (advice.length) {
    return `Kondisi lahan perlu perhatian: ${advice.join(", ")}.`;
  }

  return "Kondisi lahan terlihat stabil saat ini.";
}