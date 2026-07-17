import 'dart:collection';

class CacheEntry<T> {
  final T data;
  final DateTime cachedAt;
  final int ttlSeconds;

  CacheEntry(this.data, this.ttlSeconds) : cachedAt = DateTime.now();

  bool get isExpired => DateTime.now().difference(cachedAt).inSeconds > ttlSeconds;
}

class CacheService {
  static final CacheService _instance = CacheService._();
  static CacheService get instance => _instance;
  CacheService._();

  final _cache = HashMap<String, CacheEntry>();

  static const int _defaultTtl = 8;

  T? get<T>(String key) {
    final entry = _cache[key];
    if (entry == null) return null;
    if (entry.isExpired) {
      _cache.remove(key);
      return null;
    }
    return entry.data as T;
  }

  void set<T>(String key, T data, {int ttlSeconds = _defaultTtl}) {
    _cache[key] = CacheEntry(data, ttlSeconds);
  }

  void invalidate(String key) => _cache.remove(key);
  void invalidateAll() => _cache.clear();
}
