@echo off
REM ========================================
REM SIMULADOR DE NODOS ESP32 - Contenedores
REM ========================================
echo Instalando dependencias...
pip install paho-mqtt

echo Iniciando simulador...
python simulator.py
pause
