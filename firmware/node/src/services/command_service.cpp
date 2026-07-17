#include "command_service.h"
#include "../../config.h"
#include "../drivers/lora_driver.h"
#include "report_service.h"
#include "node_config_service.h"

static unsigned long send_interval = SEND_INTERVAL;

static uint8_t crc8(const uint8_t* data, size_t len) {
  uint8_t crc = 0x00;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int j = 0; j < 8; j++) {
      if (crc & 0x80) crc = (crc << 1) ^ 0x07;
      else crc <<= 1;
    }
  }
  return crc;
}

static void send_ack(const String& ack_type, const String& data) {
  String node_id = String(node_config_get_id());
  String msg = node_id + ",ACK" + ack_type;
  if (data.length() > 0) msg += "," + data;
  uint8_t crc_val = crc8((const uint8_t*)msg.c_str(), msg.length());
  msg += ",CRC" + String(crc_val);
  lora_send(msg);
  Serial.print("ACK enviado: ");
  Serial.println(msg);
}

static void handle_command(const String& cmd_json) {
  Serial.print("Comando recibido: ");
  Serial.println(cmd_json);

  if (cmd_json.indexOf("\"ping\"") >= 0) {
    send_ack("0", "");
    Serial.println("  -> ping responded");
    return;
  }

  if (cmd_json.indexOf("\"reboot\"") >= 0) {
    send_ack("2", "");
    Serial.println("  -> reboot en 1s");
    delay(1000);
    ESP.restart();
    return;
  }

  if (cmd_json.indexOf("\"request\"") >= 0) {
    send_ack("3", "");
    Serial.println("  -> request received, enviando datos...");
    report_send();
    return;
  }

  if (cmd_json.indexOf("\"interval\"") >= 0) {
    int val_pos = cmd_json.indexOf("\"value\":");
    if (val_pos >= 0) {
      int start = cmd_json.indexOf(':', val_pos) + 1;
      while (start < (int)cmd_json.length() && cmd_json[start] == ' ') start++;
      int end = start;
      while (end < (int)cmd_json.length() && isDigit(cmd_json[end])) end++;
      if (end > start) {
        send_interval = cmd_json.substring(start, end).toInt();
        if (send_interval < 1000) send_interval = 1000;
        send_ack("1", String(send_interval));
        Serial.print("  -> interval changed to ");
        Serial.print(send_interval);
        Serial.println("ms");
      }
    }
    return;
  }

  Serial.println("  -> comando desconocido");
  send_ack("9", "");
}

void command_init() {
  send_interval = node_config_get_interval();
  Serial.print("Intervalo de envio: ");
  Serial.print(send_interval);
  Serial.println("ms");
}

void command_check() {
  if (!lora_available()) return;

  String raw = lora_read_string();
  Serial.print("LoRa RX: ");
  Serial.println(raw);

  int first_pipe = raw.indexOf('|');
  if (first_pipe < 0) return;

  String target = raw.substring(0, first_pipe);
  String expected = String(node_config_get_id());
  if (target != expected) {
    Serial.print("  -> no es para mi (");
    Serial.print(target);
    Serial.println(")");
    return;
  }

  String type = raw.substring(first_pipe + 1, raw.indexOf('|', first_pipe + 1));
  if (type == "ack") {
    Serial.print("  -> ACK recibido del gateway (RSSI:");
    Serial.print(lora_last_rssi);
    Serial.print(" SNR:");
    Serial.print(lora_last_snr);
    Serial.println(")");
    return;
  }
  if (type != "command") {
    Serial.println("  -> no es comando");
    return;
  }

  String cmd_payload = raw.substring(raw.indexOf('|', first_pipe + 1) + 1);
  handle_command(cmd_payload);
}

unsigned long command_get_interval() {
  return send_interval;
}
