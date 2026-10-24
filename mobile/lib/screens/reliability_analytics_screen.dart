import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';

class ReliabilityAnalyticsScreen extends StatefulWidget {
  const ReliabilityAnalyticsScreen({super.key});

  @override
  State<ReliabilityAnalyticsScreen> createState() => _ReliabilityAnalyticsScreenState();
}

class _ReliabilityAnalyticsScreenState extends State<ReliabilityAnalyticsScreen> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;

  // Reliability state
  ReliabilitySummaryModel? _reliability;
  bool _loadingReliability = false;
  String? _reliabilityError;

  // Analytics state
  AnalyticsSummaryModel? _analytics;
  bool _loadingAnalytics = false;
  String? _analyticsError;

  // Ledger verification state
  AuditVerificationModel? _ledgerVerification;
  bool _verifyingLedger = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    _fetchReliability();
    _fetchAnalytics();
  }

  Future<void> _fetchReliability() async {
    setState(() {
      _loadingReliability = true;
      _reliabilityError = null;
    });

    try {
      final res = await _api.getReliabilitySummary();
      if (mounted) setState(() => _reliability = res);
    } catch (e) {
      if (mounted) setState(() => _reliabilityError = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loadingReliability = false);
    }
  }

  Future<void> _fetchAnalytics() async {
    setState(() {
      _loadingAnalytics = true;
      _analyticsError = null;
    });

    try {
      final res = await _api.getAnalyticsSummary();
      if (mounted) setState(() => _analytics = res);
    } catch (e) {
      if (mounted) setState(() => _analyticsError = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loadingAnalytics = false);
    }
  }

  Future<void> _verifyLedger() async {
    setState(() => _verifyingLedger = true);
    try {
      final res = await _api.verifyAuditLedger();
      if (mounted) setState(() => _ledgerVerification = res);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ledger verification failed: $e'), backgroundColor: AppTheme.red),
        );
      }
    } finally {
      if (mounted) setState(() => _verifyingLedger = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reliability & Incident Analytics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppTheme.teal),
            onPressed: _loadAll,
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.teal,
          labelColor: AppTheme.teal,
          unselectedLabelColor: AppTheme.subtext,
          tabs: const [
            Tab(icon: Icon(Icons.wifi_tethering), text: 'RF Reliability'),
            Tab(icon: Icon(Icons.analytics), text: 'Incident Analytics'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildReliabilityTab(),
          _buildAnalyticsTab(),
        ],
      ),
    );
  }

  Widget _buildReliabilityTab() {
    if (_loadingReliability) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    }
    if (_reliabilityError != null) {
      return _buildErrorCard(_reliabilityError!, _fetchReliability);
    }
    if (_reliability == null) {
      return const Center(child: Text('No telemetry available', style: TextStyle(color: AppTheme.subtext)));
    }

    final pdr = _reliability!.packetDeliveryRate;
    final isHw = _reliability!.isHardwareStream;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Stream Label Banner
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isHw ? AppTheme.green.withOpacity(0.12) : AppTheme.amber.withOpacity(0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: isHw ? AppTheme.green.withOpacity(0.3) : AppTheme.amber.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Icon(isHw ? Icons.shield : Icons.info_outline, color: isHw ? AppTheme.green : AppTheme.amber, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isHw ? 'ESP32+ESP8266 PHYSICAL RF STREAM' : 'SIMULATION STREAM BENCHMARK',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: isHw ? AppTheme.green : AppTheme.amber,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _reliability!.notes,
                        style: const TextStyle(fontSize: 11, color: AppTheme.subtext, height: 1.3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // PDR Large Gauge Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.panel,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(
              children: [
                const Text('WINDOWED PACKET DELIVERY RATE (24H)',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
                const SizedBox(height: 12),
                Text(
                  '${pdr.toStringAsFixed(1)}%',
                  style: TextStyle(
                    fontSize: 42,
                    fontWeight: FontWeight.w900,
                    color: pdr >= 95 ? AppTheme.green : (pdr >= 80 ? AppTheme.amber : AppTheme.red),
                  ),
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: (pdr / 100.0).clamp(0.0, 1.0),
                    backgroundColor: AppTheme.surface,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      pdr >= 95 ? AppTheme.green : (pdr >= 80 ? AppTheme.amber : AppTheme.red),
                    ),
                    minHeight: 8,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _reliability!.statusLabel,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.subtext),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Frames Breakdown Grid
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  title: 'Valid Packets',
                  value: '${_reliability!.validPackets}',
                  color: AppTheme.green,
                  icon: Icons.check_circle_outline,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricTile(
                  title: 'CRC Rejections',
                  value: '${_reliability!.crcFailures}',
                  color: AppTheme.red,
                  icon: Icons.cancel_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  title: 'Duplicate Frames',
                  value: '${_reliability!.duplicatePackets}',
                  color: AppTheme.amber,
                  icon: Icons.content_copy,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricTile(
                  title: 'Round-Trip Latency',
                  value: _reliability!.avgAckLatencyMs != null
                      ? '${_reliability!.avgAckLatencyMs!.toStringAsFixed(0)} ms'
                      : 'N/A',
                  color: AppTheme.teal,
                  icon: Icons.timer_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Heartbeat Freshness Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.panel,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.favorite, color: AppTheme.teal, size: 20),
                    SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Gateway Heartbeat Freshness',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.text)),
                        Text('Junction controller synchronization',
                            style: TextStyle(fontSize: 10, color: AppTheme.subtext)),
                      ],
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.surface,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _reliability!.heartbeatFreshnessSeconds != null
                        ? '${_reliability!.heartbeatFreshnessSeconds}s ago'
                        : 'Simulated',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.teal),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnalyticsTab() {
    if (_loadingAnalytics) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    }
    if (_analyticsError != null) {
      return _buildErrorCard(_analyticsError!, _fetchAnalytics);
    }
    if (_analytics == null) {
      return const Center(child: Text('No analytics data available', style: TextStyle(color: AppTheme.subtext)));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Total Incidents Grid
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.panel,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('LIFECYCLE INCIDENT METRICS',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatCol('Total', '${_analytics!.totalRequests}', AppTheme.text),
                    _buildStatCol('Completed', '${_analytics!.completedRequests}', AppTheme.green),
                    _buildStatCol('Active', '${_analytics!.activeRequests}', AppTheme.red),
                    _buildStatCol('Cancelled', '${_analytics!.cancelledRequests}', AppTheme.amber),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Operational Durations
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  title: 'Avg ACK Latency',
                  value: '${_analytics!.avgAckDurationSeconds.toStringAsFixed(1)}s',
                  color: AppTheme.teal,
                  icon: Icons.timer,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildMetricTile(
                  title: 'Avg Priority Duration',
                  value: '${_analytics!.avgPriorityDurationSeconds.toStringAsFixed(1)}s',
                  color: AppTheme.amber,
                  icon: Icons.traffic,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Cryptographic Audit Ledger Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.panel,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.lock, color: AppTheme.teal, size: 20),
                    SizedBox(width: 8),
                    Text('CRYPTOGRAPHIC AUDIT LEDGER',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Every emergency transit event is chained via SHA-256 cryptographic hashes to guarantee complete tamper-evidence.',
                  style: TextStyle(fontSize: 11, color: AppTheme.subtext, height: 1.3),
                ),
                const SizedBox(height: 14),

                if (_ledgerVerification != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _ledgerVerification!.isLedgerIntact
                          ? AppTheme.green.withOpacity(0.12)
                          : AppTheme.red.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _ledgerVerification!.isLedgerIntact ? AppTheme.green : AppTheme.red,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _ledgerVerification!.isLedgerIntact ? Icons.verified : Icons.warning,
                          color: _ledgerVerification!.isLedgerIntact ? AppTheme.green : AppTheme.red,
                          size: 24,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _ledgerVerification!.isLedgerIntact
                                    ? 'LEDGER INTEGRITY VERIFIED'
                                    : 'TAMPER DETECTED',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                  color: _ledgerVerification!.isLedgerIntact ? AppTheme.green : AppTheme.red,
                                ),
                              ),
                              Text(
                                '${_ledgerVerification!.totalEntriesVerified} sequential events verified mathematically.',
                                style: const TextStyle(fontSize: 10, color: AppTheme.subtext),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                ElevatedButton.icon(
                  onPressed: _verifyingLedger ? null : _verifyLedger,
                  icon: _verifyingLedger
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.bg))
                      : const Icon(Icons.security, size: 18),
                  label: const Text('VERIFY LEDGER INTEGRITY'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.teal,
                    foregroundColor: AppTheme.bg,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(fontSize: 11, color: AppTheme.subtext)),
              Icon(icon, size: 16, color: color),
            ],
          ),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildStatCol(String label, String count, Color color) {
    return Column(
      children: [
        Text(count, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.subtext)),
      ],
    );
  }

  Widget _buildErrorCard(String error, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: AppTheme.subtext),
            const SizedBox(height: 12),
            Text(error, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.subtext, fontSize: 13)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry Connection'),
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.teal, foregroundColor: AppTheme.bg),
            ),
          ],
        ),
      ),
    );
  }
}
