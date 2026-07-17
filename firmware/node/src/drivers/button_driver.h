#ifndef BUTTON_DRIVER_H
#define BUTTON_DRIVER_H

#include <Arduino.h>

void node_button_init();
void node_button_check();
bool node_button_is_confirm_mode();
unsigned long node_button_confirm_remaining();
bool node_button_handle_confirm();
bool node_button_in_ap_mode();
void node_button_set_ap_mode(bool active);

#endif
