# SAWIT.IO Smart Farming Dashboard

Project ini memecah file `smart_farming_dashboard.jsx` menjadi project runnable:

- Frontend: React 18 + Vite
- Database/Auth: Firebase Web SDK
- Realtime device: MQTT.js via WebSocket
- AI: backend Express proxy ke Anthropic Claude API
- Backend: Express + Firebase Admin optional + MQTT publish control

AI sengaja dipanggil dari backend (`/api/ai/chat`), bukan langsung dari browser, supaya API key tidak bocor dan tidak terkena masalah CORS.

## Struktur

```text
sawit-iot/
  package.json
  firebase.json
  frontend/
    src/
      components/
      config/
      data/
      firebase/
      mqtt/
      pages/
      services/
      utils/
    .env.example
  backend/
    src/
      config/
      routes/
      services/
    .env.example
```

## Cara menjalankan

1. Install dependencies dari root project:

```bash
npm install
```

2. Buat file env:

```bash
copy frontend\.env.example frontend\.env
copy backend\.env.example backend\.env
```

3. Isi konfigurasi Firebase di `frontend/.env`.

4. Isi `ANTHROPIC_API_KEY` di `backend/.env`.

5. Jalankan frontend dan backend sekaligus:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3001`

## Firebase

Aktifkan Firebase Authentication Email/Password dan buat user admin. Dashboard tetap bisa tampil dalam mode demo saat Firebase belum dikonfigurasi, tetapi baca/tulis Firestore aktif setelah env Firebase valid dan user login.

Untuk rules admin di `frontend/firestore.rules`, buat dokumen:

```text
users/{uid}
  email: admin@sawit.io
  role: admin
```

Collection yang dipakai:

- `sensor_data`
- `notifications`
- `schedules`
- `settings/thresholds`
- `ai_chat_history`
- `control_logs`

Deploy rules:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## MQTT

Frontend membaca broker WebSocket dari:

```env
VITE_MQTT_BROKER_URL=ws://broker.hivemq.com:8000/mqtt
```

Backend membaca broker TCP dari:

```env
MQTT_BROKER_URL=mqtt://broker.hivemq.com:1883
```

Topic kontrol:

- `sawit/control/pompa_air`
- `sawit/control/pompa_nutrisi`
- `sawit/control/mode`

Topic sensor:

- `sawit/sensor/#`

## AI

Endpoint chat:

```http
POST http://localhost:3001/api/ai/chat
```

Body:

```json
{
  "messages": [
    { "role": "user", "content": "Bagaimana kondisi tanah?" }
  ],
  "sensor": {}
}
```

Jika AI mengembalikan JSON seperti `{"action":"pump_air","value":"ON"}`, frontend akan menjalankan kontrol MQTT.

## Catatan

File env tidak disertakan karena berisi secret. Gunakan `.env.example` sebagai template.
