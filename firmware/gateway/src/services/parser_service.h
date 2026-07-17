#ifndef PARSER_SERVICE_H
#define PARSER_SERVICE_H

#include <Arduino.h>

bool parser_is_json(const char* raw);
String parser_extract_value(const char* json, const char* key);
String parser_build_json(const char* key, const char* value);

String parser_compact_to_json(const String& payload);
String parser_get_token(const String& msg, int index, char sep);
String parser_get_topic_segment(const String& topic, int index);
String parser_get_node_id(const String& lora_msg);
String parser_get_data_type(const String& lora_msg);
String parser_get_payload(const String& lora_msg);
String parser_build_node_topic(const String& node_id, const String& data_type);

#endif
