import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';
import 'request_form_screen.dart';
import 'request_tracking_screen.dart';
import 'request_history_screen.dart';
import 'nearby_alerts_screen.dart';
import 'corridor_queue_screen.dart';
import 'reliability_analytics_screen.dart';
import 'connection_status_screen.dart';
import 'settings_screen.dart';

class DriverHomeScreen extends StatefulWidget {
  final UserModel user;
  const DriverHomeScreen({super.key, required this.user});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _DriverDashboardTab(
            user: widget.user,
            onNavigateToTab: (idx) => setState(() => _currentIndex = idx),
          ),
          const CorridorQueueScreen(),
          const NearbyAlertsScreen(),
          const ReliabilityAnalyticsScreen(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppTheme.panel,
          border: Border(top: BorderSide(color: AppTheme.border)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          backgroundColor: AppTheme.panel,
          selectedItemColor: AppTheme.teal,
          unselectedItemColor: AppTheme.subtext,
          type: BottomNavigationBarType.fixed,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.flash_on),
              label: 'Dispatch',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.alt_route),
              label: 'Route & Queue',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.notifications_active),
              label: 'Advisories',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.insights),
              label: 'Telemetry',
            ),
          ],
        ),
      ),
    );
  }
}

class _DriverDashboardTab extends StatefulWidget {
  final UserModel user;
  final Function(int) onNavigateToTab;
  const _DriverDashboardTab({required this.user, required this.onNavigateToTab});

  @override
  State<_DriverDashboardTab> createState() => _DriverDashboardTabState();
}

class _DriverDashboardTabState extends State<_DriverDashboardTab> {
  final ApiService _api = ApiService();
  EmergencyRequestModel? _activeRequest;
  List<EmergencyRequestModel> _recentRequests = [];
  Timer? _refreshTimer;
  bool _isConnected = true;
  bool _loading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _checkData();
    _refreshTimer = Timer.periodic(const Duration(seconds: 4), (_) => _checkData(silent: true));
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkData({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final connected = await _api.checkConnection();
      final reqs = await _api.getRequests();

      final active = reqs.firstWhere(
        (r) => r.status == 'PENDING' || r.status == 'RECEIVED' || r.status == 'PRIORITY_ACTIVE',
        orElse: () => EmergencyRequestModel(
          id: '',
          ambulanceId: '',
          junctionId: '',
          direction: '',
          status: 'NONE',
          source: '',
          isVerifiedHardware: false,
          durationSeconds: 0,
          requestedAt: '',
          expiresAt: '',
        ),
      );

      if (mounted) {
        setState(() {
          _isConnected = connected;
          _recentRequests = reqs.take(4).toList();
          _activeRequest = active.status != 'NONE' ? active : null;
          _errorMessage = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isConnected = false;
          _errorMessage = 'Backend connection offline: ${e.toString().replaceAll('Exception: ', '')}';
        });
      }
    } finally {
      if (!silent && mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('RouteX Command Hub'),
        actions: [
          IconButton(
            icon: Icon(Icons.wifi, color: _isConnected ? AppTheme.teal : AppTheme.red),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ConnectionStatusScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: AppTheme.subtext),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => SettingsScreen(user: widget.user)),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppTheme.teal,
        onRefresh: () => _checkData(),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Mobile-Only Workflow Notice
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: AppTheme.teal.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.teal.withOpacity(0.3)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.phone_android, color: AppTheme.teal, size: 16),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'MOBILE-APP-ONLY WORKFLOW • SIMULATED DATA LABELED',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.teal, letterSpacing: 0.5),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Offline Alert Banner (if disconnected)
              if (!_isConnected)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: AppTheme.red.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.red),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off, color: AppTheme.red, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _errorMessage ?? 'Backend unreachable. Verify server host in Settings.',
                          style: const TextStyle(fontSize: 11, color: AppTheme.red, fontWeight: FontWeight.w600),
                        ),
                      ),
                      TextButton(
                        onPressed: () => _checkData(),
                        child: const Text('RETRY', style: TextStyle(color: AppTheme.teal, fontSize: 11, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),

              // Vehicle Profile Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.border),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.teal.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.local_hospital, color: AppTheme.teal, size: 28),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'AMB-01 • MEDIC-101',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.text),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppTheme.green.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text('ACTIVE UNIT', style: TextStyle(color: AppTheme.green, fontSize: 9, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Advanced Life Support | Metro Central Base',
                            style: TextStyle(fontSize: 11, color: AppTheme.subtext),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: _isConnected ? AppTheme.green : AppTheme.red,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _isConnected ? 'REST API & WebSocket Connected' : 'Gateway Offline',
                                style: TextStyle(fontSize: 11, color: _isConnected ? AppTheme.green : AppTheme.red, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Active Transit Alert Card (Hero banner when transit is active)
              if (_activeRequest != null)
                GestureDetector(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => RequestTrackingScreen(requestId: _activeRequest!.id),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.red.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppTheme.red, width: 1.5),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning, color: AppTheme.red, size: 32),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Text(
                                    'ACTIVE PRIORITY TRANSIT',
                                    style: TextStyle(color: AppTheme.red, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: AppTheme.red,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text('LIVE', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Target: ${_activeRequest!.junctionId} | Approach: ${_activeRequest!.direction}',
                                style: const TextStyle(color: AppTheme.text, fontSize: 12),
                              ),
                              Text(
                                'Triage: ${_activeRequest!.triagePriority} | Status: ${_activeRequest!.status}',
                                style: const TextStyle(color: AppTheme.amber, fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios, color: AppTheme.red, size: 16),
                      ],
                    ),
                  ),
                ),

              // Emergency Dispatch Action Button
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.teal.withOpacity(0.25),
                      blurRadius: 18,
                      spreadRadius: 1,
                    )
                  ],
                ),
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const RequestFormScreen()),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.teal,
                    foregroundColor: AppTheme.bg,
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                  ),
                  child: const Column(
                    children: [
                      Icon(Icons.traffic, size: 36, color: AppTheme.bg),
                      SizedBox(height: 6),
                      Text(
                        'REQUEST SIGNAL PRIORITY',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 0.8),
                      ),
                      Text(
                        'Tactile Lane & Urgency Selection (Simulated)',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Quick Module Navigation Grid
              const Text(
                'OPERATIONS & CORRIDOR TOOLS',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8),
              ),
              const SizedBox(height: 10),

              Row(
                children: [
                  Expanded(
                    child: _buildNavTile(
                      icon: Icons.alt_route,
                      title: 'Corridor & ETA',
                      subtitle: 'Dijkstra Routing',
                      onTap: () => widget.onNavigateToTab(1),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildNavTile(
                      icon: Icons.queue,
                      title: 'Junction Queue',
                      subtitle: 'Multi-Ambulance',
                      onTap: () => widget.onNavigateToTab(1),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: _buildNavTile(
                      icon: Icons.notifications_active,
                      title: 'Nearby Alerts',
                      subtitle: 'Road Users View',
                      onTap: () => widget.onNavigateToTab(2),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildNavTile(
                      icon: Icons.insights,
                      title: 'Telemetry & PDR',
                      subtitle: 'Reliability Monitor',
                      onTap: () => widget.onNavigateToTab(3),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Recent Transits Preview Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'RECENT TRANSIT LOGS',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const RequestHistoryScreen()),
                    ),
                    child: const Text(
                      'View All',
                      style: TextStyle(fontSize: 11, color: AppTheme.teal, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              if (_loading)
                const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(color: AppTheme.teal, strokeWidth: 2)))
              else if (_recentRequests.isEmpty)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppTheme.panel,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: const Center(
                    child: Text('No transit requests recorded yet.', style: TextStyle(color: AppTheme.subtext, fontSize: 12)),
                  ),
                )
              else
                ..._recentRequests.map((r) => _buildRecentRequestItem(r)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.panel,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: AppTheme.teal, size: 22),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(color: AppTheme.subtext, fontSize: 10)),
          ],
        ),
      ),
    );
  }

  Widget _buildRecentRequestItem(EmergencyRequestModel req) {
    final isComp = req.status == 'COMPLETED';
    final isPrio = req.status == 'PRIORITY_ACTIVE';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.flash_on, color: AppTheme.teal, size: 16),
              const SizedBox(width: 8),
              Text('${req.ambulanceId} → ${req.junctionId}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.text)),
              const SizedBox(width: 8),
              Text('(${req.direction})', style: const TextStyle(fontSize: 11, color: AppTheme.subtext)),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: isComp ? AppTheme.green.withOpacity(0.15) : (isPrio ? AppTheme.red.withOpacity(0.15) : AppTheme.surface),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              req.status,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                color: isComp ? AppTheme.green : (isPrio ? AppTheme.red : AppTheme.subtext),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
