# 🌴 SAWIT.IO Smart Farming Dashboard

SAWIT.IO adalah sistem Smart Farming berbasis Internet of Things (IoT) yang dirancang untuk memonitor kondisi pembibitan kelapa sawit secara real-time serta mengendalikan proses penyiraman dan pemberian nutrisi secara otomatis. Sistem ini dilengkapi dengan AI Chatbot untuk membantu analisis kondisi tanaman dan memberikan rekomendasi berdasarkan data sensor.

---

# 📌 Fitur

- Monitoring suhu udara
- Monitoring kelembaban udara
- Monitoring kelembaban tanah
- Monitoring pH tanah
- Monitoring Nitrogen (N)
- Monitoring Fosfor (P)
- Monitoring Kalium (K)
- Monitoring EC (Electrical Conductivity)
- Monitoring TDS
- Monitoring Salinity

- Dashboard Monitoring Realtime
- Kontrol Pompa Air
- Kontrol Pompa Nutrisi
- Mode Manual dan Otomatis
- Penjadwalan Penyiraman
- Firebase Authentication
- Firebase Firestore Realtime Database
- MQTT Communication
- AI Chatbot menggunakan Claude API
- Riwayat Sensor
- Riwayat Kontrol
- Notifikasi

---

# 🛠 Teknologi

## Frontend

- React 18
- Vite
- Tailwind CSS
- Firebase Web SDK
- MQTT.js

## Backend

- Node.js
- Express.js
- Firebase Admin SDK
- MQTT
- Anthropic Claude API

## Hardware

- ESP32
- Sensor Soil NPK 7 in 1
- Relay Module
- Water Pump
- Nutrient Pump

---

# 📂 Struktur Project

```text
sawit-iot/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.js
│   │
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── config/
│   │   ├── data/
│   │   ├── firebase/
│   │   ├── mqtt/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   │
│   ├── .env.example
│   └── package.json
│
├── Dokumentasi_perangkat/
│   ├── Desain_rangkaian.png
│   ├── pcbdesainlayer_top.png
│   ├── pcbdesainbootom.png
│   ├── hasil_perangkat_keras.jpg
│   ├── hasil_perangkat_keras2.jpg
│   └── Implementasi.jpeg
│
├── README.md
└── package.json
```

---

# ⚙️ Instalasi

Clone repository

```bash
git clone https://github.com/abdurrazaqq/IoT-Sawit-chatbotAI.git
```

Masuk ke folder project

```bash
cd IoT-Sawit-chatbotAI
```

Install dependency

```bash
npm install
```

Install dependency frontend

```bash
cd frontend
npm install
```

Install dependency backend

```bash
cd ../backend
npm install
```

---

# 🔑 Konfigurasi Environment

Salin file konfigurasi

```bash
copy frontend\.env.example frontend\.env
copy backend\.env.example backend\.env
```

Isi konfigurasi Firebase pada:

```text
frontend/.env
```

Isi API Key Claude pada:

```text
backend/.env
```

---

# ▶️ Menjalankan Project

Dari root project

```bash
npm run dev
```

Frontend

```
http://localhost:5173
```

Backend

```
http://localhost:3001
```

---

# Firebase

Aktifkan

- Authentication (Email/Password)
- Firestore Database

Buat data user

```text
users/{uid}

email : admin@sawit.io
role  : admin
```

Collection yang digunakan

- sensor_data
- notifications
- schedules
- settings
- ai_chat_history
- control_logs

Deploy rules

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

# MQTT

Frontend

```env
VITE_MQTT_BROKER_URL=ws://broker.hivemq.com:8000/mqtt
```

Backend

```env
MQTT_BROKER_URL=mqtt://broker.hivemq.com:1883
```

Topic Sensor

```
sawit/sensor/#
```

Topic Kontrol

```
sawit/control/pompa_air
sawit/control/pompa_nutrisi
sawit/control/mode
```

---

# AI Chatbot

Endpoint

```http
POST /api/ai/chat
```

Request

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Bagaimana kondisi tanah?"
    }
  ],
  "sensor": {}
}
```

Apabila AI menghasilkan respon

```json
{
  "action":"pump_air",
  "value":"ON"
}
```

maka sistem akan mengirim perintah MQTT ke perangkat ESP32.

---

# Dokumentasi Perangkat

Dokumentasi hardware tersedia pada folder

```text
Dokumentasi_perangkat/
```

Berisi

- Desain rangkaian
- Layout PCB Top
- Layout PCB Bottom
- Implementasi perangkat
- Hasil perangkat keras

---

# Screenshot

Tambahkan screenshot dashboard pada folder berikut

```text
images/
```

Contoh

```markdown
## Dashboard

![Dashboard](images/dashboard.png)

## AI Chatbot

![Chatbot](images/chatbot.png)

## Monitoring Sensor

![Sensor](images/sensor.png)
```

---

# Keamanan

File berikut tidak disertakan ke repository

- .env
- node_modules
- Firebase Secret
- API Key
- Service Account

Gunakan file `.env.example` sebagai template konfigurasi.

---

# Author

**Abdur Razaq Assakun**

Bachelor of Computer Systems

IoT Engineer • Fullstack Developer • DevOps Enthusiast