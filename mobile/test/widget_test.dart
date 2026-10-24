import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/models/request_models.dart';
import 'package:mobile/widgets/emergency_route_canvas.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const RouteXMobileApp());
    expect(find.text('RouteX'), findsOneWidget);
    // Advance past the 1500ms splash delay timer
    await tester.pump(const Duration(milliseconds: 2000));
  });

  test('EmergencyRequestModel JSON deserialization test', () {
    final json = {
      'id': 'REQ-TEST-001',
      'ambulance_id': 'AMB-01',
      'junction_id': 'JNC-01',
      'direction': 'STRAIGHT',
      'status': 'PRIORITY_ACTIVE',
      'source': 'MOBILE_APP',
      'triage_priority': 'CRITICAL',
      'estimated_arrival_seconds': 45,
      'scheduling_reason': 'Priority lead: CRITICAL urgency',
      'clearance_seconds': 6,
      'is_verified_hardware': false,
      'duration_seconds': 25,
      'requested_at': '2026-10-19T10:00:00',
      'expires_at': '2026-10-19T10:00:25',
    };

    final model = EmergencyRequestModel.fromJson(json);
    expect(model.id, 'REQ-TEST-001');
    expect(model.ambulanceId, 'AMB-01');
    expect(model.triagePriority, 'CRITICAL');
    expect(model.estimatedArrivalSeconds, 45);
    expect(model.schedulingReason, 'Priority lead: CRITICAL urgency');
    expect(model.isVerifiedHardware, false);
  });

  test('RoutePlanModel JSON deserialization test', () {
    final json = {
      'start_junction': 'JNC-01',
      'destination_junction': 'JNC-04',
      'path': ['JNC-01', 'JNC-02', 'JNC-04'],
      'total_distance_meters': 1150.0,
      'estimated_travel_time_seconds': 138.0,
      'junction_details': [
        {'id': 'JNC-01', 'info': {'name': 'Central Ave', 'zone': 'ZONE-CENTRAL'}},
        {'id': 'JNC-02', 'info': {'name': 'Hospital Int', 'zone': 'ZONE-HOSPITAL'}},
        {'id': 'JNC-04', 'info': {'name': 'Tech Park Gate', 'zone': 'ZONE-EAST'}},
      ],
    };

    final plan = RoutePlanModel.fromJson(json);
    expect(plan.startJunction, 'JNC-01');
    expect(plan.destinationJunction, 'JNC-04');
    expect(plan.path.length, 3);
    expect(plan.totalDistanceMeters, 1150.0);
    expect(plan.estimatedTravelTimeSeconds, 138.0);
  });

  test('ReliabilitySummaryModel JSON deserialization test', () {
    final json = {
      'total_lora_packets': 50,
      'valid_packets': 48,
      'crc_failures': 2,
      'duplicate_packets': 3,
      'packet_delivery_rate': 96.0,
      'avg_hardware_rssi': -68.5,
      'avg_hardware_snr': 8.5,
      'avg_ack_latency_ms': 142.0,
      'heartbeat_freshness_seconds': 4,
      'is_hardware_stream': false,
      'status_label': 'ACTIVE BENCHMARK (SIMULATED STREAM)',
      'notes': 'Simulation stream active',
    };

    final rel = ReliabilitySummaryModel.fromJson(json);
    expect(rel.totalLoraPackets, 50);
    expect(rel.validPackets, 48);
    expect(rel.packetDeliveryRate, 96.0);
    expect(rel.isHardwareStream, false);
    expect(rel.statusLabel, contains('SIMULATED'));
  });

  test('AnalyticsSummaryModel JSON deserialization test', () {
    final json = {
      'total_requests': 15,
      'completed_requests': 12,
      'failed_requests': 0,
      'expired_requests': 1,
      'cancelled_requests': 2,
      'active_requests': 0,
      'avg_ack_duration_seconds': 1.4,
      'avg_priority_duration_seconds': 19.8,
      'total_alerts_issued': 15,
      'online_junctions_count': 5,
      'total_junctions_count': 5,
      'hardware_verified_requests_count': 0,
      'simulated_requests_count': 15,
    };

    final analytics = AnalyticsSummaryModel.fromJson(json);
    expect(analytics.totalRequests, 15);
    expect(analytics.completedRequests, 12);
    expect(analytics.simulatedRequestsCount, 15);
    expect(analytics.hardwareVerifiedRequestsCount, 0);
  });

  test('AuditVerificationModel JSON deserialization test', () {
    final json = {
      'is_ledger_intact': true,
      'total_entries_verified': 42,
      'broken_sequence_index': null,
      'message': 'Cryptographic chain verified',
    };

    final audit = AuditVerificationModel.fromJson(json);
    expect(audit.isLedgerIntact, true);
    expect(audit.totalEntriesVerified, 42);
    expect(audit.brokenSequenceIndex, null);
  });

  testWidgets('EmergencyRouteCanvas renders corridor nodes and simulated tag', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: EmergencyRouteCanvas(
            height: 300,
          ),
        ),
      ),
    );

    expect(find.text('CORRIDOR MAP'), findsOneWidget);
    expect(find.text('SIMULATED'), findsOneWidget);
    expect(find.text('Priority Green'), findsOneWidget);
  });

  test('HospitalModel JSON deserialization test', () {
    final json = {
      'id': 'HOSP-01',
      'name': 'City Emergency Trauma Center',
      'junction_id': 'JNC-05',
      'latitude': 28.63,
      'longitude': 77.23,
      'readiness_status': 'TRAUMA_READY',
      'available_icu_beds': 12,
      'total_icu_beds': 16,
      'specialties': ['Trauma Level 1', 'Neuro Surgery'],
      'is_accepting_emergencies': true,
    };

    final hosp = HospitalModel.fromJson(json);
    expect(hosp.id, 'HOSP-01');
    expect(hosp.name, 'City Emergency Trauma Center');
    expect(hosp.readinessStatus, 'TRAUMA_READY');
    expect(hosp.availableIcuBeds, 12);
    expect(hosp.specialties.contains('Trauma Level 1'), true);
    expect(hosp.isAcceptingEmergencies, true);
  });

  test('RouteComparisonModel JSON deserialization test', () {
    final json = {
      'start_junction': 'JNC-01',
      'destination_junction': 'JNC-05',
      'destination_hospital': {
        'id': 'HOSP-01',
        'name': 'City Emergency Trauma Center',
        'junction_id': 'JNC-05',
        'readiness_status': 'TRAUMA_READY',
        'available_icu_beds': 12,
        'total_icu_beds': 16,
      },
      'standard_distance_route': {
        'start_junction': 'JNC-01',
        'destination_junction': 'JNC-05',
        'path': ['JNC-01', 'JNC-02', 'JNC-04', 'JNC-05'],
        'total_distance_meters': 1550.0,
        'estimated_travel_time_seconds': 145.0,
        'junction_details': [],
      },
      'traffic_optimized_route': {
        'start_junction': 'JNC-01',
        'destination_junction': 'JNC-05',
        'path': ['JNC-01', 'JNC-02', 'JNC-03', 'JNC-05'],
        'total_distance_meters': 1600.0,
        'estimated_travel_time_seconds': 115.0,
        'junction_details': [],
      },
      'time_saved_seconds': 30.0,
      'recommendation': 'TRAFFIC_OPTIMIZED',
      'decision_rationale': 'Diverts around bottleneck via Ring Road Flyover saving 30s.',
      'algorithm_type': 'Dijkstra Graph Shortest-Path / Weighted Edge Transit Model',
    };

    final comp = RouteComparisonModel.fromJson(json);
    expect(comp.startJunction, 'JNC-01');
    expect(comp.destinationJunction, 'JNC-05');
    expect(comp.timeSavedSeconds, 30.0);
    expect(comp.recommendation, 'TRAFFIC_OPTIMIZED');
    expect(comp.standardDistanceRoute.path.length, 4);
    expect(comp.trafficOptimizedRoute.path.length, 4);
    expect(comp.destinationHospital?.id, 'HOSP-01');
  });
}

