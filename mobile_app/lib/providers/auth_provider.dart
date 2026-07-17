import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  UserModel? _user;
  bool _isAuthenticated = false;
  bool _isLoading = false;

  UserModel? get user => _user;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    final currentUser = await AuthService.getCurrentUser();
    if (currentUser != null) {
      _user = currentUser;
      _isAuthenticated = true;
    } else {
      _user = null;
      _isAuthenticated = false;
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    final currentUser = await AuthService.login(email, password);
    bool success = false;
    if (currentUser != null) {
      _user = currentUser;
      _isAuthenticated = true;
      success = true;
    } else {
      _user = null;
      _isAuthenticated = false;
    }

    _isLoading = false;
    notifyListeners();
    return success;
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    await AuthService.logout();
    _user = null;
    _isAuthenticated = false;

    _isLoading = false;
    notifyListeners();
  }

  void loginAsGuest() {
    _user = UserModel(
      id: '0',
      email: 'guest@smartcontainers.com',
      name: 'Invitado Operador',
    );
    _isAuthenticated = true;
    notifyListeners();
  }
}
