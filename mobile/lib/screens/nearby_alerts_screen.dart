import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';

class NearbyAlertsScreen extends StatefulWidget {
  const NearbyAlertsScreen({super.key});

  @override
  State<NearbyAlertsScreen> createState() => _NearbyAlertsScreenState();
}

class _NearbyAlertsScreenState extends State<NearbyAlertsScreen> {
  final ApiService _api = ApiService();
  List<AlertModel> _alerts = [];
  bool _loading = true;
  String? _error;
  final Set<String> _acknowledgedIds = {};

  // Zone subscription state
  String _selectedZone = 'ZONE-CENTRAL';
  final List<String> _zones = ['ZONE-CENTRAL', 'ZONE-HOSPITAL', 'ZONE-NORTH', 'ZONE-EAST', 'ZONE-SOUTH'];
  bool _subscribing = false;
  String? _subscriptionNotice;

  // Proximity simulator state
  double _simLatitude = 28.6105;
  double _simLongitude = 77.2005;
  Map<String, dynamic>? _proximityResult;
  bool _checkingProximity = false;

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final list = await _api.getAlerts();
      if (mounted) setState(() => _alerts = list);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _subscribeToZone() async {
    setState(() => _subscribing = true);
    try {
      await _api.subscribeToZone(
        clientUuid: 'citizen-mobile-app-client',
        zone: _selectedZone,
        latitude: _simLatitude,
        longitude: _simLongitude,
      );
      if (mounted) {
        setState(() => _subscriptionNotice = 'Subscribed to $_selectedZone test advisories');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Registered for $_selectedZone alerts (Simulated)'), backgroundColor: AppTheme.teal),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Subscription failed: $e'), backgroundColor: AppTheme.red),
        );
      }
    } finally {
      if (mounted) setState(() => _subscribing = false);
    }
  }

  Future<void> _testProximity() async {
    setState(() => _checkingProximity = true);
    try {
      final res = await _api.checkProximity(
        latitude: _simLatitude,
        longitude: _simLongitude,
        maxRadiusMeters: 1000.0,
      );
      if (mounted) setState(() => _proximityResult = res);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Proximity check error: $e'), backgroundColor: AppTheme.red),
        );
      }
    } finally {
      if (mounted) setState(() => _checkingProximity = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Road-User Advisory Alerts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppTheme.teal),
            onPressed: _loadAlerts,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Prominent Prototype Notice
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.amber.withOpacity(0.12),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.amber.withOpacity(0.35)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.warning_amber_rounded, color: AppTheme.amber, size: 22),
                  SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SIMULATED TEST ADVISORY NOTICE',
                          style: TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Advisories shown are demonstrative test notifications for simulated road users. '
                          'In a real-world emergency, always yield right-of-way safely when sirens or emergency lights are visible.',
                          style: TextStyle(color: AppTheme.subtext, fontSize: 11, height: 1.35),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Zone Subscription Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('TEST ZONE SUBSCRIPTION',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: AppTheme.surface,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _selectedZone,
                              isExpanded: true,
                              dropdownColor: AppTheme.panel,
                              items: _zones.map((z) {
                                return DropdownMenuItem<String>(
                                  value: z,
                                  child: Text(z, style: const TextStyle(color: AppTheme.text, fontSize: 12, fontWeight: FontWeight.w600)),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) setState(() => _selectedZone = val);
                              },
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton(
                        onPressed: _subscribing ? null : _subscribeToZone,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.teal,
                          foregroundColor: AppTheme.bg,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: _subscribing
                            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.bg))
                            : const Text('Subscribe', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      ),
                    ],
                  ),
                  if (_subscriptionNotice != null) ...[
                    const SizedBox(height: 6),
                    Text(_subscriptionNotice!, style: const TextStyle(color: AppTheme.green, fontSize: 10, fontWeight: FontWeight.w600)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Simulated Proximity Evaluator Tool
            Container(
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
                      const Text('HAVERSINE PROXIMITY EVALUATION',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(4)),
                        child: const Text('SIMULATED GPS', style: TextStyle(color: AppTheme.teal, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Client Simulated Coordinates: ${_simLatitude.toStringAsFixed(4)}, ${_simLongitude.toStringAsFixed(4)} (Radius: 1000m)',
                    style: const TextStyle(fontSize: 11, color: AppTheme.subtext),
                  ),
                  const SizedBox(height: 10),

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            setState(() {
                              // Move near JNC-01
                              _simLatitude = 28.6108;
                              _simLongitude = 77.2008;
                            });
                            _testProximity();
                          },
                          icon: const Icon(Icons.near_me, size: 14),
                          label: const Text('Set Near JNC-01', style: TextStyle(fontSize: 11)),
                          style: OutlinedButton.styleFrom(foregroundColor: AppTheme.teal),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            setState(() {
                              // Move far away (~50km)
                              _simLatitude = 29.1000;
                              _simLongitude = 78.0000;
                            });
                            _testProximity();
                          },
                          icon: const Icon(Icons.explore_off, size: 14),
                          label: const Text('Set Far Away', style: TextStyle(fontSize: 11)),
                          style: OutlinedButton.styleFrom(foregroundColor: AppTheme.subtext),
                        ),
                      ),
                    ],
                  ),

                  if (_checkingProximity)
                    const Padding(padding: EdgeInsets.all(8), child: Center(child: CircularProgressIndicator(color: AppTheme.teal, strokeWidth: 2)))
                  else if (_proximityResult != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: _proximityResult!['has_nearby_emergency'] == true
                            ? AppTheme.red.withOpacity(0.12)
                            : AppTheme.surface,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _proximityResult!['has_nearby_emergency'] == true ? Icons.warning : Icons.check_circle_outline,
                            color: _proximityResult!['has_nearby_emergency'] == true ? AppTheme.red : AppTheme.green,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _proximityResult!['has_nearby_emergency'] == true
                                  ? 'Emergency vehicle within ${_proximityResult!['distance_meters']}m! Give way safely.'
                                  : 'No active emergency vehicles within 1000m radius.',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _proximityResult!['has_nearby_emergency'] == true ? AppTheme.red : AppTheme.green,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Alerts Feed
            const Text('ACTIVE ADVISORIES FEED',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
            const SizedBox(height: 10),

            if (_loading)
              const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: AppTheme.teal)))
            else if (_error != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppTheme.red.withOpacity(0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.cloud_off, color: AppTheme.red),
                    const SizedBox(width: 10),
                    Expanded(child: Text(_error!, style: const TextStyle(color: AppTheme.red, fontSize: 12))),
                    IconButton(icon: const Icon(Icons.refresh, color: AppTheme.teal), onPressed: _loadAlerts),
                  ],
                ),
              )
            else if (_alerts.isEmpty)
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.border),
                ),
                child: const Center(
                  child: Text(
                    'No active emergency advisories in your vicinity.',
                    style: TextStyle(color: AppTheme.subtext, fontSize: 13),
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _alerts.length,
                itemBuilder: (context, index) {
                  final a = _alerts[index];
                  final isAcked = _acknowledgedIds.contains(a.id);

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.warning, color: AppTheme.amber, size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    a.zone,
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.text, fontSize: 13),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppTheme.amber.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'TEST ADVISORY',
                                  style: TextStyle(color: AppTheme.amber, fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            a.message,
                            style: const TextStyle(color: AppTheme.text, fontSize: 13, height: 1.3),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Approaching Junction: ${a.junctionId} via ${a.approachDirection} lane',
                            style: const TextStyle(color: AppTheme.teal, fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 12),

                          Align(
                            alignment: Alignment.centerRight,
                            child: isAcked
                                ? Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppTheme.green.withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: AppTheme.green.withOpacity(0.4)),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.check, color: AppTheme.green, size: 14),
                                        SizedBox(width: 4),
                                        Text('RECEIPT ACKNOWLEDGED',
                                            style: TextStyle(color: AppTheme.green, fontSize: 10, fontWeight: FontWeight.bold)),
                                      ],
                                    ),
                                  )
                                : ElevatedButton.icon(
                                    onPressed: () async {
                                      final messenger = ScaffoldMessenger.of(context);
                                      try {
                                        await _api.acknowledgeAlert(a.id, 'mobile-client-${a.zone}');
                                        if (!mounted) return;
                                        setState(() => _acknowledgedIds.add(a.id));
                                        messenger.showSnackBar(
                                          const SnackBar(
                                            content: Text('Delivery receipt acknowledged with backend'),
                                            backgroundColor: AppTheme.green,
                                            duration: Duration(seconds: 2),
                                          ),
                                        );
                                      } catch (_) {}
                                    },
                                    icon: const Icon(Icons.check_circle_outline, size: 14),
                                    label: const Text('Confirm Receipt (ACK)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.teal,
                                      foregroundColor: AppTheme.bg,
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    ),
                                  ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
