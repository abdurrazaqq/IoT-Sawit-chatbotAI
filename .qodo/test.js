const mqtt = require("mqtt");

const client = mqtt.connect({
  host: "559ff90d4b154001a8ccc6b560018c8e.s1.eu.hivemq.cloud",
  port: 8883,
  protocol: "mqtts",
  username: "Rohman",
  password: "Rohman123",
  rejectUnauthorized: false
});

client.on("connect", () => {
  console.log("CONNECTED OK");
});

client.on("error", (err) => {
  console.log("ERROR:", err.message);
});