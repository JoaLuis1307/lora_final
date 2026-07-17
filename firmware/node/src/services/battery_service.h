#ifndef BATTERY_SERVICE_H
#define BATTERY_SERVICE_H

#include <Arduino.h>

// --- Parametros de la bateria Li-ion 18650 ---
#define BATT_CAPACITY_MAH     1600.0f
#define BATT_NOMINAL_V        3.7f
#define BATT_FULL_V           4.2f
#define BATT_EMPTY_V          3.0f

// Niveles de alerta
#define BATT_LOW_PCT          20.0f
#define BATT_CRITICAL_PCT     10.0f

// --- Estructura de estado completo ---
struct BatteryStatus {
  float voltage_v;           // Voltaje medido (V)
  float current_ma;          // Corriente consumida (mA, positivo = descarga)
  float power_mw;            // Potencia instantanea (mW)
  float soc_percent;         // Estado de carga blend (%)
  float soc_voltage_percent; // SOC estimado solo por voltaje (%)
  float soc_coulomb_percent; // SOC estimado solo por Coulomb counting (%)
  float remaining_mah;       // Capacidad restante estimada (mAh)
  float consumed_mah;        // Consumido acumulado por Coulomb counting (mAh)
  float runtime_min;         // Autonomia estimada (minutos)
  float runtime_hours;       // Autonomia estimada (horas)
  float energy_consumed_mwh; // Energia consumida acumulada (mWh)
  float energy_total_mwh;    // Energia total de la bateria (mWh)
  float energy_remaining_mwh;// Energia restante estimada (mWV)
  bool  low_battery;         // true si < 20%
  bool  critical_battery;    // true si < 10%
};

// --- API ---

void battery_service_init();

// Actualizar con lecturas del INA219 (llamar cada ciclo de medicion)
void battery_service_update(float voltage_v, float current_ma, float power_mw);

// Obtener estado completo calculado
BatteryStatus battery_service_get_status();

// Resetear contadores de Coulomb counting (ej: al conectar cargador)
void battery_service_reset_counters();

// Conversion directa voltaje -> % (para uso externo)
float battery_voltage_to_percent(float voltage_v);

// Conversion directa voltaje -> mAh restantes
float battery_estimate_remaining_mah(float voltage_v);

// Tiempo estimado de autonomia en minutos
float battery_estimate_runtime_min(float remaining_mah, float current_ma);

#endif
