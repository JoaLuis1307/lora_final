#include "mqtt_service.h"
#include "../../config.h"
#include "../drivers/wifi_driver.h"
#include "router_service.h"
#include "parser_service.h"
#include "display_service.h"
#include "web_service.h"
#include "node_store.h"

WiFiClient mqtt_esp_client;
PubSubClient mqtt_client(mqtt_esp_client);
volatile bool mqtt_connected_flag = false;

static void handle_gw_command(const String& msg) {
  if (msg.indexOf("\"display\"") >= 0) {
    int colon = msg.indexOf(':', msg.indexOf("\"display\""));
    if (colon >= 0) {
      int start = colon + 1;
      while (start < (int)msg.length() && (msg[start] == ' ' || msg[start] == '{' || msg[start] == '"')) start++;
      int end = start;
      while (end < (int)msg.length() && isDigit(msg[end])) end++;
      if (end > start) {
        int val = msg.substring(start, end).toInt();
        if (val >= 0 && val < DISP_COUNT) {
          display_mode = (DisplayMode)val;
          display_render();
          Serial.print("  -> display mode changed to ");
          Serial.println(val);
        }
      }
    }
    return;
  }
  if (msg.indexOf("\"info\"") >= 0) {
    mqtt_publish_info();
    Serial.println("  -> info published");
    return;
  }
  if (msg.indexOf("\"stats\"") >= 0) {
    mqtt_publish_stats(router_packets, router_crc_errors, stored_node_count);
    Serial.println("  -> stats published");
    return;
  }
  if (msg.indexOf("\"status\"") >= 0) {
    mqtt_publish_status(true, WiFi.localIP().toString().c_str());
    Serial.println("  -> status published");
    return;
  }
  Serial.println("  -> comando gateway desconocido");
}

static void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  String topic_str = String(topic);
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("MQTT RX [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(msg);

  String seg2 = parser_get_topic_segment(topic_str, 2);
  String seg3 = parser_get_topic_segment(topic_str, 3);

  if (seg3 == "command" && seg2.length() > 0 && seg2 != "+") {
    router_send_command_to_lora(seg2, msg);
    return;
  }

  if (seg2 == "command" && seg3.length() == 0) {
    handle_gw_command(msg);
  }
}

void mqtt_service_init() {
  mqtt_client.setBufferSize(512);
  mqtt_client.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt_client.setCallback(mqtt_callback);
}

bool mqtt_reconnect() {
  if (!wifi_is_connected()) return false;
  Serial.print("MQTT conectando con LWT...");
  bool ok;

  // Topics dinamicos con gateway_id runtime
  String gw_id = String(web_service_get_gateway_id());
  String topic_status = "lora/" + gw_id + "/status";
  String topic_command = "lora/" + gw_id + "/+/command";
  String topic_gw_cmd = "lora/" + gw_id + "/command";

  const char* willTopic = topic_status.c_str();
  uint8_t willQos = 1;
  bool willRetain = true;
  const char* willMessage = "{\"status\":\"offline\"}";

  if (strlen(MQTT_USER) > 0)
    ok = mqtt_client.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS, willTopic, willQos, willRetain, willMessage);
  else
    ok = mqtt_client.connect(MQTT_CLIENT_ID, NULL, NULL, willTopic, willQos, willRetain, willMessage);

  if (ok) {
    Serial.println(" OK");
    mqtt_client.subscribe(topic_command.c_str());
    mqtt_client.subscribe(topic_gw_cmd.c_str());
    mqtt_publish_status(true, WiFi.localIP().toString().c_str());
    mqtt_publish_info();
    mqtt_publish_stats(0, 0, 0);
  } else {
    Serial.print(" fallo rc=");
    Serial.println(mqtt_client.state());
  }
  mqtt_connected_flag = ok;
  return ok;
}

void mqtt_loop() { mqtt_client.loop(); }

bool mqtt_is_connected() { return mqtt_client.connected(); }

void mqtt_publish(const char* topic, const char* payload) {
  mqtt_client.publish(topic, payload);
}

void mqtt_publish_status(bool online, const char* ip) {
  String topic = "lora/" + String(web_service_get_gateway_id()) + "/status";
  String payload = "{\"status\":\"";
  payload += online ? "online" : "offline";
  payload += "\",\"ip\":\"";
  payload += ip;
  payload += "\"}";
  mqtt_client.publish(topic.c_str(), payload.c_str(), true);
}

void mqtt_publish_info() {
  String topic = "lora/" + String(web_service_get_gateway_id()) + "/info";
  String payload = "{";
  payload += "\"uptime\":" + String(millis() / 1000);
  payload += ",\"heap\":" + String(ESP.getFreeHeap());
  payload += ",\"wifi_rssi\":" + String(WiFi.RSSI());
  payload += ",\"firmware\":\"2.0\"";
  payload += "}";
  mqtt_client.publish(topic.c_str(), payload.c_str(), true);
}

void mqtt_publish_stats(unsigned long packets, unsigned long crc_errs, int nodes) {
  String topic = "lora/" + String(web_service_get_gateway_id()) + "/stats";
  String payload = "{";
  payload += "\"packets\":" + String(packets);
  payload += ",\"crc_errors\":" + String(crc_errs);
  payload += ",\"nodes\":" + String(nodes);
  payload += "}";
  mqtt_client.publish(topic.c_str(), payload.c_str(), true);
}
