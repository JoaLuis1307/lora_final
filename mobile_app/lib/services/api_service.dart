import 'dart:convert';
import 'package:http/http.dart' as http;
import 'storage_service.dart';

class ApiService {
  static Future<Map<String, String>> _getHeaders({bool requireAuth = true}) async {
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (requireAuth) {
      final token = await StorageService.getToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  // Generic GET
  static Future<http.Response> get(String path, {bool requireAuth = true}) async {
    final baseUrl = await StorageService.getApiBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    return http.get(url, headers: headers).timeout(const Duration(seconds: 4));
  }

  // Generic POST
  static Future<http.Response> post(String path, Map<String, dynamic> body, {bool requireAuth = true}) async {
    final baseUrl = await StorageService.getApiBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    return http.post(url, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 4));
  }

  // Generic PATCH
  static Future<http.Response> patch(String path, Map<String, dynamic> body, {bool requireAuth = true}) async {
    final baseUrl = await StorageService.getApiBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    return http.patch(url, headers: headers, body: jsonEncode(body)).timeout(const Duration(seconds: 4));
  }

  // Generic DELETE
  static Future<http.Response> delete(String path, {bool requireAuth = true}) async {
    final baseUrl = await StorageService.getApiBaseUrl();
    final url = Uri.parse('$baseUrl$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    return http.delete(url, headers: headers).timeout(const Duration(seconds: 4));
  }
}
