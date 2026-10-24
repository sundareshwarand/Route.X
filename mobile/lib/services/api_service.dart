import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/request_models.dart';

class ApiService {
  static String get _defaultUrl => kIsWeb ? "http://localhost:8000/api" : "http://10.0.2.2:8000/api";
  static const String _prefUrlKey = "routex_api_url";
  static const String _prefTokenKey = "routex_auth_token";
  static const String _prefUserKey = "routex_user_data";

  Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefUrlKey) ?? _defaultUrl;
  }

  Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefUrlKey, url);
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefTokenKey);
  }

  Future<void> saveSession(String token, UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefTokenKey, token);
    await prefs.setString(_prefUserKey, jsonEncode({
      'id': user.id,
      'email': user.email,
      'full_name': user.fullName,
      'role': user.role,
    }));
  }

  Future<UserModel?> getCachedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_prefUserKey);
    if (data == null) return null;
    return UserModel.fromJson(jsonDecode(data));
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefTokenKey);
    await prefs.remove(_prefUserKey);
  }

  Future<Map<String, String>> _headers() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  Future<UserModel> login(String email, String password) async {
    final baseUrl = await getBaseUrl();
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login/json'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final token = data['access_token'];
      final user = UserModel.fromJson(data['user']);
      await saveSession(token, user);
      return user;
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Login failed');
    }
  }

  Future<EmergencyRequestModel> submitEmergencyRequest({
    required String ambulanceId,
    required String junctionId,
    required String direction,
    String triagePriority = 'STANDARD',
    int estimatedArrivalSeconds = 0,
    int clearanceSeconds = 3,
    int durationSeconds = 20,
  }) async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.post(
      Uri.parse('$baseUrl/emergency/request'),
      headers: headers,
      body: jsonEncode({
        'ambulance_id': ambulanceId,
        'junction_id': junctionId,
        'direction': direction,
        'triage_priority': triagePriority,
        'estimated_arrival_seconds': estimatedArrivalSeconds,
        'clearance_seconds': clearanceSeconds,
        'duration_seconds': durationSeconds,
        'source': 'MOBILE_APP',
      }),
    );

    if (response.statusCode == 201) {
      return EmergencyRequestModel.fromJson(jsonDecode(response.body));
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Failed to submit emergency request');
    }
  }

  Future<void> acknowledgeAlert(String alertId, String clientIdentifier) async {
    final baseUrl = await getBaseUrl();
    await http.post(
      Uri.parse('$baseUrl/alerts/$alertId/acknowledge'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'client_identifier': clientIdentifier}),
    );
  }

  Future<Map<String, dynamic>> getJunctionQueue(String junctionId) async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/emergency/junction/$junctionId/queue'),
      headers: headers,
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    return {};
  }


  Future<List<EmergencyRequestModel>> getRequests() async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/emergency/requests'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final List list = jsonDecode(response.body);
      return list.map((e) => EmergencyRequestModel.fromJson(e)).toList();
    }
    return [];
  }

  Future<EmergencyRequestModel> cancelRequest(String requestId, String reason) async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.post(
      Uri.parse('$baseUrl/emergency/requests/$requestId/cancel'),
      headers: headers,
      body: jsonEncode({'cancellation_reason': reason}),
    );

    if (response.statusCode == 200) {
      return EmergencyRequestModel.fromJson(jsonDecode(response.body));
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Failed to cancel request');
    }
  }

  Future<List<JunctionModel>> getJunctions() async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/junctions'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final List list = jsonDecode(response.body);
      return list.map((e) => JunctionModel.fromJson(e)).toList();
    }
    return [];
  }

  Future<List<AlertModel>> getAlerts() async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/alerts'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final List list = jsonDecode(response.body);
      return list.map((e) => AlertModel.fromJson(e)).toList();
    }
    return [];
  }

  Future<bool> checkConnection() async {
    try {
      final baseUrl = await getBaseUrl();
      final rootUrl = baseUrl.replaceAll('/api', '');
      final response = await http.get(Uri.parse(rootUrl)).timeout(const Duration(seconds: 4));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<RoutePlanModel> planRoute(String startJunctionId, String destinationJunctionId) async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.post(
      Uri.parse('$baseUrl/junctions/route/shortest-path'),
      headers: headers,
      body: jsonEncode({
        'start_junction_id': startJunctionId,
        'destination_junction_id': destinationJunctionId,
      }),
    );

    if (response.statusCode == 200) {
      return RoutePlanModel.fromJson(jsonDecode(response.body));
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Route planning failed');
    }
  }

  Future<ReliabilitySummaryModel> getReliabilitySummary() async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/reliability/summary'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return ReliabilitySummaryModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to load reliability metrics');
    }
  }

  Future<AnalyticsSummaryModel> getAnalyticsSummary() async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/analytics/summary'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return AnalyticsSummaryModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to load analytics summary');
    }
  }

  Future<AuditVerificationModel> verifyAuditLedger() async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/analytics/audit-ledger/verify'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return AuditVerificationModel.fromJson(jsonDecode(response.body));
    } else {
      throw Exception('Failed to verify audit ledger');
    }
  }

  Future<Map<String, dynamic>> checkProximity({
    required double latitude,
    required double longitude,
    double maxRadiusMeters = 1000.0,
  }) async {
    final baseUrl = await getBaseUrl();
    final response = await http.post(
      Uri.parse('$baseUrl/alerts/proximity-check'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'client_latitude': latitude,
        'client_longitude': longitude,
        'max_radius_meters': maxRadiusMeters,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Proximity check failed');
    }
  }

  Future<void> subscribeToZone({
    required String clientUuid,
    required String zone,
    double? latitude,
    double? longitude,
  }) async {
    final baseUrl = await getBaseUrl();
    await http.post(
      Uri.parse('$baseUrl/alerts/subscribe'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'client_uuid': clientUuid,
        'zone': zone,
        'latitude': latitude,
        'longitude': longitude,
        'is_simulation': true,
      }),
    );
  }

  Future<Map<String, dynamic>?> getSimulationStatus() async {
    try {
      final baseUrl = await getBaseUrl();
      final response = await http.get(Uri.parse('$baseUrl/simulation/status'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      }
    } catch (_) {}
    return null;
  }

  Future<List<HospitalModel>> getHospitals() async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.get(
      Uri.parse('$baseUrl/hospitals'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final List list = jsonDecode(response.body);
      return list.map((e) => HospitalModel.fromJson(e)).toList();
    }
    return [];
  }

  Future<RouteComparisonModel> compareRoutes({
    required String startJunctionId,
    String? destinationJunctionId,
    String? destinationHospitalId,
    List<Map<String, dynamic>>? congestedEdges,
  }) async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final Map<String, dynamic> payload = {
      'start_junction_id': startJunctionId,
      'destination_junction_id': destinationJunctionId,
      'destination_hospital_id': destinationHospitalId,
    };
    if (congestedEdges != null) {
      payload['congested_edges'] = congestedEdges;
    }

    final response = await http.post(
      Uri.parse('$baseUrl/hospitals/route/compare'),
      headers: headers,
      body: jsonEncode(payload),
    );

    if (response.statusCode == 200) {
      return RouteComparisonModel.fromJson(jsonDecode(response.body));
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Route comparison failed');
    }
  }

  Future<EmergencyRequestModel> completeEmergencyRequest(String requestId) async {
    final baseUrl = await getBaseUrl();
    final headers = await _headers();
    final response = await http.post(
      Uri.parse('$baseUrl/emergency/requests/$requestId/complete'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      return EmergencyRequestModel.fromJson(jsonDecode(response.body));
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['detail'] ?? 'Failed to complete emergency request');
    }
  }
}

