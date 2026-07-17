import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user_model.dart';
import 'storage_service.dart';

class AuthService {
  static const String supabaseUrl = 'https://rxcyrjrflhqfkajubuvr.supabase.co';
  static const String supabaseAnonKey = 'sb_publishable_zjsmqwrxo4iwnXVqeU9Kgw_PqinAiwt';

  static Future<UserModel?> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$supabaseUrl/auth/v1/token?grant_type=password'),
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['access_token'] != null) {
          await StorageService.saveToken(data['access_token']);
        }
        if (data['user'] != null) {
          final userMap = data['user'];
          final String? name = userMap['user_metadata']?['full_name'];
          final user = UserModel(
            id: userMap['id'].toString(),
            email: userMap['email'] as String,
            name: name,
          );
          await StorageService.saveUserInfo(jsonEncode(user.toJson()));
          return user;
        }
      }
      return null;
    } catch (e) {
      print('[AUTH SERVICE] Error logging in: $e');
      return null;
    }
  }

  static Future<UserModel?> getCurrentUser() async {
    try {
      final cachedUser = await StorageService.getUserInfo();
      if (cachedUser != null) {
        return UserModel.fromJson(jsonDecode(cachedUser));
      }

      final token = await StorageService.getToken();
      if (token == null) return null;

      final response = await http.get(
        Uri.parse('$supabaseUrl/auth/v1/user'),
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final userMap = jsonDecode(response.body);
        final String? name = userMap['user_metadata']?['full_name'];
        final user = UserModel(
          id: userMap['id'].toString(),
          email: userMap['email'] as String,
          name: name,
        );
        await StorageService.saveUserInfo(jsonEncode(user.toJson()));
        return user;
      }
      return null;
    } catch (e) {
      print('[AUTH SERVICE] Error fetching current user: $e');
      return null;
    }
  }

  static Future<void> logout() async {
    try {
      final token = await StorageService.getToken();
      if (token != null) {
        await http.post(
          Uri.parse('$supabaseUrl/auth/v1/logout'),
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': 'Bearer $token',
          },
        );
      }
    } catch (e) {
      print('[AUTH SERVICE] Error logging out: $e');
    }
    await StorageService.clearToken();
    await StorageService.clearUserInfo();
  }
}
