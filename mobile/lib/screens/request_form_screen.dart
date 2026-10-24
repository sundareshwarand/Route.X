import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';
import 'request_tracking_screen.dart';

class RequestFormScreen extends StatefulWidget {
  const RequestFormScreen({super.key});

  @override
  State<RequestFormScreen> createState() => _RequestFormScreenState();
}

class _RequestFormScreenState extends State<RequestFormScreen> {
  final ApiService _api = ApiService();
  String _selectedDirection = 'STRAIGHT';
  String _selectedJunction = 'JNC-01';
  String _selectedHospitalId = 'HOSP-01';
  String _selectedTriage = 'CRITICAL';
  int _selectedDuration = 20;
  List<JunctionModel> _junctions = [];
  List<HospitalModel> _hospitals = [];
  RouteComparisonModel? _routeComparison;
  bool _loading = false;
  bool _evaluatingRoute = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _loading = true);
    try {
      final jList = await _api.getJunctions();
      final hList = await _api.getHospitals();
      if (mounted) {
        setState(() {
          _junctions = jList;
          _hospitals = hList;
          if (jList.isNotEmpty) _selectedJunction = jList.first.id;
          if (hList.isNotEmpty) _selectedHospitalId = hList.first.id;
        });
        _evaluateRoute();
      }
    } catch (_) {
      // Fallback defaults
      if (mounted) {
        setState(() {
          _junctions = [
            JunctionModel(id: 'JNC-01', name: 'Central Avenue - 5th Cross', code: 'CA-5C', latitude: 28.61, longitude: 77.20, zone: 'ZONE-CENTRAL', currentSignalState: 'NORMAL_CYCLE', isOnline: true),
            JunctionModel(id: 'JNC-02', name: 'Metro Hospital Intersection', code: 'MH-INT', latitude: 28.61, longitude: 77.21, zone: 'ZONE-HOSPITAL', currentSignalState: 'NORMAL_CYCLE', isOnline: true),
          ];
          _hospitals = [
            HospitalModel(id: 'HOSP-01', name: 'City Emergency Trauma Center', junctionId: 'JNC-05', latitude: 28.63, longitude: 77.23, readinessStatus: 'TRAUMA_READY', availableIcuBeds: 12, totalIcuBeds: 16, specialties: ['Trauma Level 1'], isAcceptingEmergencies: true),
            HospitalModel(id: 'HOSP-02', name: 'Metro General Hospital', junctionId: 'JNC-02', latitude: 28.618, longitude: 77.214, readinessStatus: 'CAPACITY_NOMINAL', availableIcuBeds: 6, totalIcuBeds: 10, specialties: ['Cardiology'], isAcceptingEmergencies: true),
          ];
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _evaluateRoute() async {
    setState(() => _evaluatingRoute = true);
    try {
      final comp = await _api.compareRoutes(
        startJunctionId: _selectedJunction,
        destinationHospitalId: _selectedHospitalId,
      );
      if (mounted) setState(() => _routeComparison = comp);
    } catch (_) {}
    finally {
      if (mounted) setState(() => _evaluatingRoute = false);
    }
  }

  Future<void> _submitRequest() async {
    setState(() => _submitting = true);
    try {
      final req = await _api.submitEmergencyRequest(
        ambulanceId: 'AMB-01',
        junctionId: _selectedJunction,
        direction: _selectedDirection,
        triagePriority: _selectedTriage,
        durationSeconds: _selectedDuration,
      );

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => RequestTrackingScreen(requestId: req.id),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: AppTheme.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Priority Request Dispatch'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Simulation Workflow Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.teal.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.teal.withOpacity(0.3)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: AppTheme.teal, size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'SIMULATED DISPATCH (NO PHYSICAL HARDWARE REQUIRED)',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.teal, letterSpacing: 0.5),
                    ),
                  ),
                ],
              ),
            ),

            // Target Junction Selector
            const Text(
              '1. SELECT ORIGIN APPROACH JUNCTION',
              style: TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.border),
              ),
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: AppTheme.teal, strokeWidth: 2))),
                    )
                  : DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedJunction,
                        isExpanded: true,
                        dropdownColor: AppTheme.panel,
                        icon: const Icon(Icons.keyboard_arrow_down, color: AppTheme.teal),
                        items: _junctions.map((j) {
                          return DropdownMenuItem<String>(
                            value: j.id,
                            child: Text(
                              '${j.id} • ${j.name}',
                              style: const TextStyle(color: AppTheme.text, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _selectedJunction = val);
                            _evaluateRoute();
                          }
                        },
                      ),
                    ),
            ),
            const SizedBox(height: 20),

            // Destination Hospital Selector
            const Text(
              '2. SELECT RECEIVING HOSPITAL DESTINATION',
              style: TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),

            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.border),
              ),
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: Center(child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: AppTheme.teal, strokeWidth: 2))),
                    )
                  : DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedHospitalId,
                        isExpanded: true,
                        dropdownColor: AppTheme.panel,
                        icon: const Icon(Icons.keyboard_arrow_down, color: AppTheme.teal),
                        items: _hospitals.map((h) {
                          final isTrauma = h.readinessStatus == 'TRAUMA_READY';
                          return DropdownMenuItem<String>(
                            value: h.id,
                            child: Row(
                              children: [
                                const Text('🏥 ', style: TextStyle(fontSize: 14)),
                                Expanded(
                                  child: Text(
                                    '${h.name} (${h.junctionId})',
                                    style: const TextStyle(color: AppTheme.text, fontSize: 12, fontWeight: FontWeight.w600),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isTrauma ? AppTheme.red.withOpacity(0.2) : AppTheme.green.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    isTrauma ? 'TRAUMA' : 'NOMINAL',
                                    style: TextStyle(
                                      color: isTrauma ? AppTheme.red : AppTheme.green,
                                      fontSize: 9,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() => _selectedHospitalId = val);
                            _evaluateRoute();
                          }
                        },
                      ),
                    ),
            ),
            const SizedBox(height: 20),

            // Route Preview & Algorithmic Comparison Card
            if (_evaluatingRoute)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.border),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal)),
                    SizedBox(width: 10),
                    Text('Evaluating Dijkstra Shortest Path...', style: TextStyle(color: AppTheme.subtext, fontSize: 11)),
                  ],
                ),
              )
            else if (_routeComparison != null)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.teal.withOpacity(0.4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.alt_route, color: AppTheme.teal, size: 16),
                            SizedBox(width: 6),
                            Text(
                              'CORRIDOR TRANSIT PREVIEW',
                              style: TextStyle(color: AppTheme.teal, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.teal.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            _routeComparison!.recommendation,
                            style: const TextStyle(color: AppTheme.teal, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: _routeComparison!.standardDistanceRoute.path.map((node) {
                        return Chip(
                          label: Text(node, style: const TextStyle(fontSize: 10, color: AppTheme.text, fontWeight: FontWeight.bold)),
                          backgroundColor: AppTheme.surface,
                          padding: EdgeInsets.zero,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Distance: ${_routeComparison!.standardDistanceRoute.totalDistanceMeters.round()} m',
                          style: const TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                        Text(
                          'Estimated ETA: ${_routeComparison!.standardDistanceRoute.estimatedTravelTimeSeconds.round()} s',
                          style: const TextStyle(color: AppTheme.amber, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 20),

            // Triage Urgency Level
            const Text(
              '2. PATIENT TRIAGE URGENCY LEVEL',
              style: TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _selectedTriage = 'CRITICAL'),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: _selectedTriage == 'CRITICAL' ? AppTheme.red.withOpacity(0.2) : AppTheme.panel,
                      side: BorderSide(color: _selectedTriage == 'CRITICAL' ? AppTheme.red : AppTheme.border, width: _selectedTriage == 'CRITICAL' ? 2 : 1),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(
                      'CRITICAL',
                      style: TextStyle(color: _selectedTriage == 'CRITICAL' ? AppTheme.red : AppTheme.text, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _selectedTriage = 'URGENT'),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: _selectedTriage == 'URGENT' ? AppTheme.amber.withOpacity(0.2) : AppTheme.panel,
                      side: BorderSide(color: _selectedTriage == 'URGENT' ? AppTheme.amber : AppTheme.border, width: _selectedTriage == 'URGENT' ? 2 : 1),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(
                      'URGENT',
                      style: TextStyle(color: _selectedTriage == 'URGENT' ? AppTheme.amber : AppTheme.text, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _selectedTriage = 'STANDARD'),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: _selectedTriage == 'STANDARD' ? AppTheme.teal.withOpacity(0.2) : AppTheme.panel,
                      side: BorderSide(color: _selectedTriage == 'STANDARD' ? AppTheme.teal : AppTheme.border, width: _selectedTriage == 'STANDARD' ? 2 : 1),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(
                      'STANDARD',
                      style: TextStyle(color: _selectedTriage == 'STANDARD' ? AppTheme.teal : AppTheme.text, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Tactile Direction Selector
            const Text(
              '3. SELECT APPROACH DIRECTION',
              style: TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),


            Row(
              children: [
                Expanded(
                  child: _buildDirectionTile(
                    label: 'LEFT',
                    icon: Icons.arrow_back,
                    selected: _selectedDirection == 'LEFT',
                    onTap: () => setState(() => _selectedDirection = 'LEFT'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildDirectionTile(
                    label: 'STRAIGHT',
                    icon: Icons.arrow_upward,
                    selected: _selectedDirection == 'STRAIGHT',
                    onTap: () => setState(() => _selectedDirection = 'STRAIGHT'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildDirectionTile(
                    label: 'RIGHT',
                    icon: Icons.arrow_forward,
                    selected: _selectedDirection == 'RIGHT',
                    onTap: () => setState(() => _selectedDirection = 'RIGHT'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Priority Duration Selector
            const Text(
              '3. PRIORITY INTERVAL TIMEOUT',
              style: TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),

            Row(
              children: [15, 20, 30].map((dur) {
                final isSelected = _selectedDuration == dur;
                return Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    child: OutlinedButton(
                      onPressed: () => setState(() => _selectedDuration = dur),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: isSelected ? AppTheme.teal.withOpacity(0.15) : AppTheme.panel,
                        side: BorderSide(color: isSelected ? AppTheme.teal : AppTheme.border, width: isSelected ? 2 : 1),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: Text(
                        '${dur}s',
                        style: TextStyle(
                          color: isSelected ? AppTheme.teal : AppTheme.text,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 32),

            // Safety Warning Notice
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.amber.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.amber.withOpacity(0.3)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: AppTheme.amber, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Safe Transit Policy: Request will queue in PENDING state until NodeMCU traffic gateway confirms priority green output.',
                      style: TextStyle(color: AppTheme.amber, fontSize: 11, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            ElevatedButton(
              onPressed: _submitting ? null : _submitRequest,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.red,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: _submitting
                  ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text(
                      'TRANSMIT EMERGENCY PRIORITY',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDirectionTile({
    required String label,
    required IconData icon,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 110,
        decoration: BoxDecoration(
          color: selected ? AppTheme.teal.withOpacity(0.15) : AppTheme.panel,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? AppTheme.teal : AppTheme.border,
            width: selected ? 2.5 : 1,
          ),
          boxShadow: selected
              ? [BoxShadow(color: AppTheme.teal.withOpacity(0.2), blurRadius: 12, spreadRadius: 1)]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: selected ? AppTheme.teal : AppTheme.subtext, size: 36),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: selected ? AppTheme.teal : AppTheme.text,
                fontSize: 13,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
