import 'package:flutter/material.dart';

class StatusIndicator extends StatelessWidget {
  final String status;
  final double? fontSize;

  const StatusIndicator({
    Key? key,
    required this.status,
    this.fontSize,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Color color;
    Color bgColor;
    String label = status.toUpperCase();

    switch (status.toLowerCase()) {
      case 'online':
      case 'available':
      case 'green':
        color = cs.primary;
        bgColor = cs.primary.withOpacity(0.12);
        if (status.toLowerCase() == 'green') label = 'NORMAL';
        break;
      case 'warning':
      case 'low fuel':
      case 'orange':
        color = cs.tertiary;
        bgColor = cs.tertiary.withOpacity(0.12);
        if (status.toLowerCase() == 'orange') label = 'ADVERTENCIA';
        break;
      case 'error':
      case 'red':
      case 'maintenance':
        color = cs.error;
        bgColor = cs.error.withOpacity(0.12);
        if (status.toLowerCase() == 'red') label = 'CRÍTICO';
        break;
      case 'offline':
      case 'gray':
      case 'configuring':
      default:
        color = cs.onSurfaceVariant;
        bgColor = cs.outlineVariant;
        if (status.toLowerCase() == 'gray') label = 'SIN TELEMETRÍA';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: fontSize ?? 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}
