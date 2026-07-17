#include "battery_service.h"
#include <math.h>

// =====================================================
// CURVA DE DESCARGA Li-ion 18650 (a ~0.2C, ~320mA)
// =====================================================
// Fuente: datasheets Samsung INR18650-160E, LG MJ1,
// curvas tipicas de celdas Li-ion a carga moderada.
//
// La relacion voltaje-SOC NO es lineal:
// - Zona plana media (3.7-3.9V): ~60-20% SOC
// - Descenso rapido en los extremos
// - Bajo carga, voltaje cae mas rapido por IR interna
//
// Para ESP32 con GPS + LoRa + sensores, el consumo
// tipico es 80-180mA, lo cual es ~0.05-0.1C para
// una celda de 1600mAh.

static const float VOLTAGE_TABLE[] = {
  4.20f, 4.15f, 4.10f, 4.05f, 4.00f,
  3.95f, 3.90f, 3.85f, 3.80f, 3.75f,
  3.70f, 3.65f, 3.60f, 3.55f, 3.50f,
  3.40f, 3.30f, 3.20f, 3.10f, 3.00f
};

// SOC real medido en descarga a ~0.1C
static const float SOC_TABLE[] = {
  100.0f, 97.0f, 93.0f, 88.0f, 80.0f,
  72.0f,  62.0f, 52.0f, 42.0f, 33.0f,
  24.0f,  18.0f, 13.0f, 9.0f,  6.0f,
  4.0f,   2.5f,  1.5f,  0.5f,  0.0f
};

static const int TABLE_SIZE = sizeof(VOLTAGE_TABLE) / sizeof(VOLTAGE_TABLE[0]);

// --- Estado interno ---
static BatteryStatus current_status = {};
static float accumulated_mah = 0.0f;
static float accumulated_mwh = 0.0f;
static unsigned long last_update_ms = 0;
static bool first_update = true;

// =====================================================
// INTERPOLACION PIECEWISE
// =====================================================
float battery_voltage_to_percent(float voltage_v) {
  if (voltage_v >= VOLTAGE_TABLE[0]) return 100.0f;
  if (voltage_v <= VOLTAGE_TABLE[TABLE_SIZE - 1]) return 0.0f;

  for (int i = 0; i < TABLE_SIZE - 1; i++) {
    if (voltage_v <= VOLTAGE_TABLE[i] && voltage_v >= VOLTAGE_TABLE[i + 1]) {
      float span_v = VOLTAGE_TABLE[i] - VOLTAGE_TABLE[i + 1];
      float span_soc = SOC_TABLE[i] - SOC_TABLE[i + 1];
      if (span_v < 0.001f) return SOC_TABLE[i];
      float ratio = (VOLTAGE_TABLE[i] - voltage_v) / span_v;
      return SOC_TABLE[i] + ratio * (SOC_TABLE[i + 1] - SOC_TABLE[i]);
    }
  }
  return 0.0f;
}

float battery_estimate_remaining_mah(float voltage_v) {
  float pct = battery_voltage_to_percent(voltage_v);
  return (pct / 100.0f) * BATT_CAPACITY_MAH;
}

float battery_estimate_runtime_min(float remaining_mah, float current_ma) {
  if (current_ma < 1.0f) return 9999.0f;
  return (remaining_mah / current_ma) * 60.0f;
}

// =====================================================
// SERVICIO PRINCIPAL
// =====================================================

void battery_service_init() {
  memset(&current_status, 0, sizeof(BatteryStatus));
  accumulated_mah = 0.0f;
  accumulated_mwh = 0.0f;
  last_update_ms = millis();
  first_update = true;
}

void battery_service_update(float voltage_v, float current_ma, float power_mw) {
  unsigned long now = millis();

  // --- Coulomb counting ---
  if (!first_update) {
    unsigned long dt_ms = now - last_update_ms;
    // Sanity: solo integrar si dt < 60 segundos (evita saltos grandes)
    if (dt_ms > 0 && dt_ms < 60000) {
      float dt_h = dt_ms / 3600000.0f;
      float abs_current = fabsf(current_ma);
      accumulated_mah += abs_current * dt_h;
      accumulated_mwh += fabsf(power_mw) * dt_h;
    }
  }
  first_update = false;
  last_update_ms = now;

  // Clamp accumulators
  if (accumulated_mah > BATT_CAPACITY_MAH) accumulated_mah = BATT_CAPACITY_MAH;
  if (accumulated_mwh > BATT_CAPACITY_MAH * BATT_FULL_V) {
    accumulated_mwh = BATT_CAPACITY_MAH * BATT_FULL_V;
  }

  // --- SOC por voltaje (Open Circuit Voltage approximation) ---
  float soc_volt = battery_voltage_to_percent(voltage_v);

  // --- SOC por Coulomb counting ---
  float remaining_cl = BATT_CAPACITY_MAH - accumulated_mah;
  if (remaining_cl < 0) remaining_cl = 0;
  float soc_cl = (remaining_cl / BATT_CAPACITY_MAH) * 100.0f;

  // --- Blend adaptativo ---
  // Bajo consumo (< 5mA): confiar mas en voltaje (OCV es mas preciso)
  // Consumo normal (5-500mA): blend balanceado
  // Alto consumo (> 500mA): confiar mas en Coulomb counting
  //   (la caida de voltaje por IR interna sesga el OCV)
  float soc;
  if (current_ma < 5.0f) {
    soc = soc_volt * 0.85f + soc_cl * 0.15f;
  } else if (current_ma < 500.0f) {
    soc = soc_volt * 0.5f + soc_cl * 0.5f;
  } else {
    soc = soc_volt * 0.2f + soc_cl * 0.8f;
  }

  // Clamp
  if (soc < 0.0f) soc = 0.0f;
  if (soc > 100.0f) soc = 100.0f;

  // --- Calcular valores derivados ---
  float remaining_mah = (soc / 100.0f) * BATT_CAPACITY_MAH;
  float total_energy = BATT_CAPACITY_MAH * BATT_NOMINAL_V;
  float remaining_energy = (soc / 100.0f) * total_energy;

  float runtime_min = battery_estimate_runtime_min(remaining_mah, current_ma);
  float runtime_hours = runtime_min / 60.0f;

  // --- Llenar struct ---
  current_status.voltage_v           = voltage_v;
  current_status.current_ma          = current_ma;
  current_status.power_mw            = power_mw;
  current_status.soc_percent         = soc;
  current_status.soc_voltage_percent = soc_volt;
  current_status.soc_coulomb_percent = soc_cl;
  current_status.remaining_mah       = remaining_mah;
  current_status.consumed_mah        = accumulated_mah;
  current_status.runtime_min         = runtime_min;
  current_status.runtime_hours       = runtime_hours;
  current_status.energy_consumed_mwh = accumulated_mwh;
  current_status.energy_total_mwh    = total_energy;
  current_status.energy_remaining_mwh = remaining_energy;
  current_status.low_battery         = (soc < BATT_LOW_PCT);
  current_status.critical_battery    = (soc < BATT_CRITICAL_PCT);
}

BatteryStatus battery_service_get_status() {
  return current_status;
}

void battery_service_reset_counters() {
  accumulated_mah = 0.0f;
  accumulated_mwh = 0.0f;
  last_update_ms = millis();
  first_update = true;
}
