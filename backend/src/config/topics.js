export const MQTT_TOPICS = {
  sensorAll: "sawit/sensor/#",
  controlPumpAir: "sawit/control/pump_air",
  controlPumpNutrisi: "sawit/control/pump_nutrisi",
  controlMode: "sawit/control/mode"
};

export const CONTROL_TOPIC_BY_ACTION = {
  pump_air: MQTT_TOPICS.controlPumpAir,
  pump_nutrisi: MQTT_TOPICS.controlPumpNutrisi,
  mode: MQTT_TOPICS.controlMode
};  
