class EmergencyRequestModel {
  final String id;
  final String ambulanceId;
  final String junctionId;
  final String direction;
  final String status;
  final String source;
  final String triagePriority;
  final int estimatedArrivalSeconds;
  final String? schedulingReason;
  final int clearanceSeconds;
  final bool isVerifiedHardware;
  final int durationSeconds;
  final String requestedAt;
  final String? acknowledgedAt;
  final String? activatedAt;
  final String expiresAt;
  final String? completedAt;
  final String? cancellationReason;

  EmergencyRequestModel({
    required this.id,
    required this.ambulanceId,
    required this.junctionId,
    required this.direction,
    required this.status,
    required this.source,
    this.triagePriority = 'STANDARD',
    this.estimatedArrivalSeconds = 0,
    this.schedulingReason,
    this.clearanceSeconds = 3,
    required this.isVerifiedHardware,
    required this.durationSeconds,
    required this.requestedAt,
    this.acknowledgedAt,
    this.activatedAt,
    required this.expiresAt,
    this.completedAt,
    this.cancellationReason,
  });

  factory EmergencyRequestModel.fromJson(Map<String, dynamic> json) {
    return EmergencyRequestModel(
      id: json['id'] ?? '',
      ambulanceId: json['ambulance_id'] ?? '',
      junctionId: json['junction_id'] ?? '',
      direction: json['direction'] ?? 'STRAIGHT',
      status: json['status'] ?? 'PENDING',
      source: json['source'] ?? 'MOBILE_APP',
      triagePriority: json['triage_priority'] ?? 'STANDARD',
      estimatedArrivalSeconds: json['estimated_arrival_seconds'] ?? 0,
      schedulingReason: json['scheduling_reason'],
      clearanceSeconds: json['clearance_seconds'] ?? 3,
      isVerifiedHardware: json['is_verified_hardware'] ?? false,
      durationSeconds: json['duration_seconds'] ?? 20,
      requestedAt: json['requested_at'] ?? '',
      acknowledgedAt: json['acknowledged_at'],
      activatedAt: json['activated_at'],
      expiresAt: json['expires_at'] ?? '',
      completedAt: json['completed_at'],
      cancellationReason: json['cancellation_reason'],
    );
  }
}

class JunctionQueueItemModel {
  final String requestId;
  final String ambulanceId;
  final String direction;
  final String triagePriority;
  final int estimatedArrivalSeconds;
  final String? schedulingReason;
  final String status;
  final bool isActivePriority;

  JunctionQueueItemModel({
    required this.requestId,
    required this.ambulanceId,
    required this.direction,
    required this.triagePriority,
    required this.estimatedArrivalSeconds,
    this.schedulingReason,
    required this.status,
    required this.isActivePriority,
  });

  factory JunctionQueueItemModel.fromJson(Map<String, dynamic> json) {
    return JunctionQueueItemModel(
      requestId: json['request_id'] ?? '',
      ambulanceId: json['ambulance_id'] ?? '',
      direction: json['direction'] ?? '',
      triagePriority: json['triage_priority'] ?? 'STANDARD',
      estimatedArrivalSeconds: json['estimated_arrival_seconds'] ?? 0,
      schedulingReason: json['scheduling_reason'],
      status: json['status'] ?? '',
      isActivePriority: json['is_active_priority'] ?? false,
    );
  }
}


class JunctionModel {
  final String id;
  final String name;
  final String code;
  final double latitude;
  final double longitude;
  final String zone;
  final String currentSignalState;
  final String? activeDirection;
  final bool isOnline;

  JunctionModel({
    required this.id,
    required this.name,
    required this.code,
    required this.latitude,
    required this.longitude,
    required this.zone,
    required this.currentSignalState,
    this.activeDirection,
    required this.isOnline,
  });

  factory JunctionModel.fromJson(Map<String, dynamic> json) {
    return JunctionModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      code: json['code'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      zone: json['zone'] ?? '',
      currentSignalState: json['current_signal_state'] ?? 'NORMAL_CYCLE',
      activeDirection: json['active_direction'],
      isOnline: json['is_online'] ?? false,
    );
  }
}

class AlertModel {
  final String id;
  final String requestId;
  final String junctionId;
  final String zone;
  final String message;
  final String approachDirection;
  final bool isTestSimulation;
  final String expiresAt;
  final String createdAt;

  AlertModel({
    required this.id,
    required this.requestId,
    required this.junctionId,
    required this.zone,
    required this.message,
    required this.approachDirection,
    required this.isTestSimulation,
    required this.expiresAt,
    required this.createdAt,
  });

  factory AlertModel.fromJson(Map<String, dynamic> json) {
    return AlertModel(
      id: json['id'] ?? '',
      requestId: json['request_id'] ?? '',
      junctionId: json['junction_id'] ?? '',
      zone: json['zone'] ?? '',
      message: json['message'] ?? '',
      approachDirection: json['approach_direction'] ?? '',
      isTestSimulation: json['is_test_simulation'] ?? true,
      expiresAt: json['expires_at'] ?? '',
      createdAt: json['created_at'] ?? '',
    );
  }
}

class UserModel {
  final String id;
  final String email;
  final String fullName;
  final String role;

  UserModel({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      fullName: json['full_name'] ?? '',
      role: json['role'] ?? 'citizen',
    );
  }
}

class RoutePlanModel {
  final String startJunction;
  final String destinationJunction;
  final List<String> path;
  final double totalDistanceMeters;
  final double estimatedTravelTimeSeconds;
  final List<Map<String, dynamic>> junctionDetails;

  RoutePlanModel({
    required this.startJunction,
    required this.destinationJunction,
    required this.path,
    required this.totalDistanceMeters,
    required this.estimatedTravelTimeSeconds,
    required this.junctionDetails,
  });

  factory RoutePlanModel.fromJson(Map<String, dynamic> json) {
    return RoutePlanModel(
      startJunction: json['start_junction'] ?? '',
      destinationJunction: json['destination_junction'] ?? '',
      path: (json['path'] as List?)?.map((e) => e.toString()).toList() ?? [],
      totalDistanceMeters: (json['total_distance_meters'] as num?)?.toDouble() ?? 0.0,
      estimatedTravelTimeSeconds: (json['estimated_travel_time_seconds'] as num?)?.toDouble() ?? 0.0,
      junctionDetails: (json['junction_details'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [],
    );
  }
}

class ReliabilitySummaryModel {
  final String? junctionId;
  final int totalLoraPackets;
  final int validPackets;
  final int crcFailures;
  final int duplicatePackets;
  final double packetDeliveryRate;
  final double? avgHardwareRssi;
  final double? avgHardwareSnr;
  final double? avgAckLatencyMs;
  final int? heartbeatFreshnessSeconds;
  final bool isHardwareStream;
  final String statusLabel;
  final String notes;

  ReliabilitySummaryModel({
    this.junctionId,
    required this.totalLoraPackets,
    required this.validPackets,
    required this.crcFailures,
    required this.duplicatePackets,
    required this.packetDeliveryRate,
    this.avgHardwareRssi,
    this.avgHardwareSnr,
    this.avgAckLatencyMs,
    this.heartbeatFreshnessSeconds,
    required this.isHardwareStream,
    required this.statusLabel,
    required this.notes,
  });

  factory ReliabilitySummaryModel.fromJson(Map<String, dynamic> json) {
    return ReliabilitySummaryModel(
      junctionId: json['junction_id'],
      totalLoraPackets: json['total_lora_packets'] ?? 0,
      validPackets: json['valid_packets'] ?? 0,
      crcFailures: json['crc_failures'] ?? 0,
      duplicatePackets: json['duplicate_packets'] ?? 0,
      packetDeliveryRate: (json['packet_delivery_rate'] as num?)?.toDouble() ?? 100.0,
      avgHardwareRssi: (json['avg_hardware_rssi'] as num?)?.toDouble(),
      avgHardwareSnr: (json['avg_hardware_snr'] as num?)?.toDouble(),
      avgAckLatencyMs: (json['avg_ack_latency_ms'] as num?)?.toDouble(),
      heartbeatFreshnessSeconds: json['heartbeat_freshness_seconds'],
      isHardwareStream: json['is_hardware_stream'] ?? false,
      statusLabel: json['status_label'] ?? 'ACTIVE BENCHMARK (SIMULATED STREAM)',
      notes: json['notes'] ?? '',
    );
  }
}

class AnalyticsSummaryModel {
  final int totalRequests;
  final int completedRequests;
  final int failedRequests;
  final int expiredRequests;
  final int cancelledRequests;
  final int activeRequests;
  final double avgAckDurationSeconds;
  final double avgPriorityDurationSeconds;
  final int totalAlertsIssued;
  final int onlineJunctionsCount;
  final int totalJunctionsCount;
  final int hardwareVerifiedRequestsCount;
  final int simulatedRequestsCount;

  AnalyticsSummaryModel({
    required this.totalRequests,
    required this.completedRequests,
    required this.failedRequests,
    required this.expiredRequests,
    required this.cancelledRequests,
    required this.activeRequests,
    required this.avgAckDurationSeconds,
    required this.avgPriorityDurationSeconds,
    required this.totalAlertsIssued,
    required this.onlineJunctionsCount,
    required this.totalJunctionsCount,
    required this.hardwareVerifiedRequestsCount,
    required this.simulatedRequestsCount,
  });

  factory AnalyticsSummaryModel.fromJson(Map<String, dynamic> json) {
    return AnalyticsSummaryModel(
      totalRequests: json['total_requests'] ?? 0,
      completedRequests: json['completed_requests'] ?? 0,
      failedRequests: json['failed_requests'] ?? 0,
      expiredRequests: json['expired_requests'] ?? 0,
      cancelledRequests: json['cancelled_requests'] ?? 0,
      activeRequests: json['active_requests'] ?? 0,
      avgAckDurationSeconds: (json['avg_ack_duration_seconds'] as num?)?.toDouble() ?? 0.0,
      avgPriorityDurationSeconds: (json['avg_priority_duration_seconds'] as num?)?.toDouble() ?? 0.0,
      totalAlertsIssued: json['total_alerts_issued'] ?? 0,
      onlineJunctionsCount: json['online_junctions_count'] ?? 0,
      totalJunctionsCount: json['total_junctions_count'] ?? 0,
      hardwareVerifiedRequestsCount: json['hardware_verified_requests_count'] ?? 0,
      simulatedRequestsCount: json['simulated_requests_count'] ?? 0,
    );
  }
}

class AuditVerificationModel {
  final bool isLedgerIntact;
  final int totalEntriesVerified;
  final int? brokenSequenceIndex;
  final String message;

  AuditVerificationModel({
    required this.isLedgerIntact,
    required this.totalEntriesVerified,
    this.brokenSequenceIndex,
    required this.message,
  });

  factory AuditVerificationModel.fromJson(Map<String, dynamic> json) {
    return AuditVerificationModel(
      isLedgerIntact: json['is_ledger_intact'] ?? false,
      totalEntriesVerified: json['total_entries_verified'] ?? 0,
      brokenSequenceIndex: json['broken_sequence_index'],
      message: json['message'] ?? '',
    );
  }
}

class HospitalModel {
  final String id;
  final String name;
  final String junctionId;
  final double latitude;
  final double longitude;
  final String readinessStatus;
  final int availableIcuBeds;
  final int totalIcuBeds;
  final List<String> specialties;
  final bool isAcceptingEmergencies;

  HospitalModel({
    required this.id,
    required this.name,
    required this.junctionId,
    required this.latitude,
    required this.longitude,
    required this.readinessStatus,
    required this.availableIcuBeds,
    required this.totalIcuBeds,
    required this.specialties,
    required this.isAcceptingEmergencies,
  });

  factory HospitalModel.fromJson(Map<String, dynamic> json) {
    return HospitalModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      junctionId: json['junction_id'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      readinessStatus: json['readiness_status'] ?? 'CAPACITY_NOMINAL',
      availableIcuBeds: json['available_icu_beds'] ?? 0,
      totalIcuBeds: json['total_icu_beds'] ?? 0,
      specialties: (json['specialties'] as List?)?.map((e) => e.toString()).toList() ?? [],
      isAcceptingEmergencies: json['is_accepting_emergencies'] ?? true,
    );
  }
}

class RouteComparisonModel {
  final String startJunction;
  final String destinationJunction;
  final HospitalModel? destinationHospital;
  final RoutePlanModel standardDistanceRoute;
  final RoutePlanModel trafficOptimizedRoute;
  final double timeSavedSeconds;
  final String recommendation;
  final String decisionRationale;
  final String algorithmType;

  RouteComparisonModel({
    required this.startJunction,
    required this.destinationJunction,
    this.destinationHospital,
    required this.standardDistanceRoute,
    required this.trafficOptimizedRoute,
    required this.timeSavedSeconds,
    required this.recommendation,
    required this.decisionRationale,
    required this.algorithmType,
  });

  factory RouteComparisonModel.fromJson(Map<String, dynamic> json) {
    return RouteComparisonModel(
      startJunction: json['start_junction'] ?? '',
      destinationJunction: json['destination_junction'] ?? '',
      destinationHospital: json['destination_hospital'] != null 
          ? HospitalModel.fromJson(Map<String, dynamic>.from(json['destination_hospital']))
          : null,
      standardDistanceRoute: RoutePlanModel.fromJson(Map<String, dynamic>.from(json['standard_distance_route'] ?? {})),
      trafficOptimizedRoute: RoutePlanModel.fromJson(Map<String, dynamic>.from(json['traffic_optimized_route'] ?? {})),
      timeSavedSeconds: (json['time_saved_seconds'] as num?)?.toDouble() ?? 0.0,
      recommendation: json['recommendation'] ?? 'STANDARD_DISTANCE',
      decisionRationale: json['decision_rationale'] ?? '',
      algorithmType: json['algorithm_type'] ?? 'Dijkstra Graph Shortest-Path / Weighted Edge Transit Model',
    );
  }
}


