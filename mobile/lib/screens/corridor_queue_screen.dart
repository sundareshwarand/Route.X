import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';
import 'request_form_screen.dart';

class CorridorQueueScreen extends StatefulWidget {
  const CorridorQueueScreen({super.key});

  @override
  State<CorridorQueueScreen> createState() => _CorridorQueueScreenState();
}

class _CorridorQueueScreenState extends State<CorridorQueueScreen> with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late TabController _tabController;

  // Route Planning State
  List<JunctionModel> _junctions = [];
  String _startJunction = 'JNC-01';
  String _destJunction = 'JNC-04';
  RoutePlanModel? _routePlan;
  bool _loadingRoute = false;
  String? _routeError;

  // Queue State
  String _selectedQueueJunction = 'JNC-01';
  Map<String, dynamic>? _queueData;
  bool _loadingQueue = false;
  String? _queueError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadInitialData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    try {
      final list = await _api.getJunctions();
      if (mounted) {
        setState(() {
          _junctions = list;
          if (list.length >= 2) {
            _startJunction = list[0].id;
            _destJunction = list[list.length > 3 ? 3 : list.length - 1].id;
            _selectedQueueJunction = list[0].id;
          }
        });
        _calculateRoute();
        _fetchQueue();
      }
    } catch (_) {
      // Fallback junctions
      if (mounted) {
        setState(() {
          _junctions = [
            JunctionModel(id: 'JNC-01', name: 'Central Avenue - 5th Cross', code: 'CA-5C', latitude: 28.61, longitude: 77.20, zone: 'ZONE-CENTRAL', currentSignalState: 'NORMAL_CYCLE', isOnline: true),
            JunctionModel(id: 'JNC-02', name: 'Metro Hospital Intersection', code: 'MH-INT', latitude: 28.61, longitude: 77.21, zone: 'ZONE-HOSPITAL', currentSignalState: 'NORMAL_CYCLE', isOnline: true),
            JunctionModel(id: 'JNC-03', name: 'North Ring Road - Sector 9', code: 'NR-S9', latitude: 28.63, longitude: 77.19, zone: 'ZONE-NORTH', currentSignalState: 'NORMAL_CYCLE', isOnline: true),
            JunctionModel(id: 'JNC-04', name: 'Tech Park Expressway Gate', code: 'TP-EX', latitude: 28.62, longitude: 77.23, zone: 'ZONE-EAST', currentSignalState: 'NORMAL_CYCLE', isOnline: true),
            JunctionModel(id: 'JNC-05', name: 'Trauma Center Fast Lane', code: 'TC-FL', latitude: 28.60, longitude: 77.22, zone: 'ZONE-SOUTH', currentSignalState: 'NORMAL_CYCLE', isOnline: true),
          ];
        });
        _calculateRoute();
        _fetchQueue();
      }
    }
  }

  Future<void> _calculateRoute() async {
    if (_startJunction == _destJunction) {
      setState(() => _routeError = 'Start and destination junctions must be different.');
      return;
    }

    setState(() {
      _loadingRoute = true;
      _routeError = null;
    });

    try {
      final plan = await _api.planRoute(_startJunction, _destJunction);
      if (mounted) {
        setState(() => _routePlan = plan);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _routeError = e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) {
        setState(() => _loadingRoute = false);
      }
    }
  }

  Future<void> _fetchQueue() async {
    setState(() {
      _loadingQueue = true;
      _queueError = null;
    });

    try {
      final data = await _api.getJunctionQueue(_selectedQueueJunction);
      if (mounted) {
        setState(() => _queueData = data);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _queueError = e.toString().replaceAll('Exception: ', ''));
      }
    } finally {
      if (mounted) {
        setState(() => _loadingQueue = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Corridor & Queue Management'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.teal,
          labelColor: AppTheme.teal,
          unselectedLabelColor: AppTheme.subtext,
          tabs: const [
            Tab(icon: Icon(Icons.route), text: 'Corridor Route & ETA'),
            Tab(icon: Icon(Icons.queue), text: 'Junction Triage Queue'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildRoutePlannerTab(),
          _buildJunctionQueueTab(),
        ],
      ),
    );
  }

  Widget _buildRoutePlannerTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Simulation notice banner
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.teal.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.teal.withOpacity(0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.alt_route, color: AppTheme.teal, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'ESTIMATED CORRIDOR ROUTE (SIMULATED)\nComputed via Dijkstra graph algorithm on virtual road network.',
                    style: TextStyle(fontSize: 11, color: AppTheme.text, fontWeight: FontWeight.w600, height: 1.3),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Junction Selection Card
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
                const Text('CORRIDOR ORIGIN & DESTINATION',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
                const SizedBox(height: 12),

                // Start Junction
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: AppTheme.green.withOpacity(0.2), shape: BoxShape.circle),
                      child: const Icon(Icons.trip_origin, color: AppTheme.green, size: 16),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _startJunction,
                          isExpanded: true,
                          dropdownColor: AppTheme.panel,
                          items: _junctions.map((j) {
                            return DropdownMenuItem<String>(
                              value: j.id,
                              child: Text('${j.id} • ${j.name}',
                                  style: const TextStyle(color: AppTheme.text, fontSize: 13, fontWeight: FontWeight.w600)),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _startJunction = val);
                              _calculateRoute();
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ),
                const Divider(color: AppTheme.border, height: 24),

                // Destination Junction
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: AppTheme.red.withOpacity(0.2), shape: BoxShape.circle),
                      child: const Icon(Icons.location_on, color: AppTheme.red, size: 16),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _destJunction,
                          isExpanded: true,
                          dropdownColor: AppTheme.panel,
                          items: _junctions.map((j) {
                            return DropdownMenuItem<String>(
                              value: j.id,
                              child: Text('${j.id} • ${j.name}',
                                  style: const TextStyle(color: AppTheme.text, fontSize: 13, fontWeight: FontWeight.w600)),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _destJunction = val);
                              _calculateRoute();
                            }
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_loadingRoute)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(color: AppTheme.teal)))
          else if (_routeError != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.red.withOpacity(0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: AppTheme.red),
                  const SizedBox(width: 10),
                  Expanded(child: Text(_routeError!, style: const TextStyle(color: AppTheme.red, fontSize: 12))),
                  IconButton(icon: const Icon(Icons.refresh, color: AppTheme.teal), onPressed: _calculateRoute),
                ],
              ),
            )
          else if (_routePlan != null) ...[
            // Route Metrics KPI Cards
            Row(
              children: [
                Expanded(
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
                        const Text('Total Transit Distance', style: TextStyle(fontSize: 11, color: AppTheme.subtext)),
                        const SizedBox(height: 4),
                        Text(
                          '${(_routePlan!.totalDistanceMeters / 1000).toStringAsFixed(2)} km',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.teal),
                        ),
                        Text('${_routePlan!.totalDistanceMeters.toInt()} meters',
                            style: const TextStyle(fontSize: 10, color: AppTheme.subtext)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
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
                        const Text('Estimated Transit ETA', style: TextStyle(fontSize: 11, color: AppTheme.subtext)),
                        const SizedBox(height: 4),
                        Text(
                          '${(_routePlan!.estimatedTravelTimeSeconds / 60).toStringAsFixed(1)} min',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.amber),
                        ),
                        Text('${_routePlan!.estimatedTravelTimeSeconds.toInt()}s travel time',
                            style: const TextStyle(fontSize: 10, color: AppTheme.subtext)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Step-by-Step Corridor Stepper
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
                  const Text('OPTIMIZED TRANSIT CORRIDOR',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
                  const SizedBox(height: 12),

                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _routePlan!.path.length,
                    itemBuilder: (context, index) {
                      final jncId = _routePlan!.path[index];
                      final isFirst = index == 0;
                      final isLast = index == _routePlan!.path.length - 1;

                      final detail = _routePlan!.junctionDetails.firstWhere(
                        (d) => d['id'] == jncId,
                        orElse: () => {'id': jncId, 'info': {}},
                      );
                      final info = detail['info'] as Map? ?? {};
                      final name = info['name'] ?? jncId;
                      final zone = info['zone'] ?? 'ZONE-CENTRAL';
                      final signal = info['signal'] ?? 'NORMAL_CYCLE';

                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Column(
                            children: [
                              Container(
                                width: 22,
                                height: 22,
                                decoration: BoxDecoration(
                                  color: isFirst
                                      ? AppTheme.green
                                      : (isLast ? AppTheme.red : AppTheme.teal),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    '${index + 1}',
                                    style: const TextStyle(color: AppTheme.bg, fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ),
                              if (!isLast)
                                Container(
                                  width: 2,
                                  height: 36,
                                  color: AppTheme.border,
                                ),
                            ],
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        jncId,
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.text),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: signal == 'PRIORITY_ACTIVE'
                                              ? AppTheme.red.withOpacity(0.15)
                                              : AppTheme.surface,
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          signal,
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                            color: signal == 'PRIORITY_ACTIVE' ? AppTheme.red : AppTheme.subtext,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  Text(
                                    '$name • $zone',
                                    style: const TextStyle(fontSize: 11, color: AppTheme.subtext),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Dispatch Button with Pre-filled target
            ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const RequestFormScreen()),
                );
              },
              icon: const Icon(Icons.flash_on),
              label: const Text('DISPATCH SIGNAL PRIORITY'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.teal,
                foregroundColor: AppTheme.bg,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildJunctionQueueTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Junction Selector Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.panel,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.border),
            ),
            child: Row(
              children: [
                const Icon(Icons.traffic, color: AppTheme.teal, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedQueueJunction,
                      isExpanded: true,
                      dropdownColor: AppTheme.panel,
                      items: _junctions.map((j) {
                        return DropdownMenuItem<String>(
                          value: j.id,
                          child: Text('${j.id} • ${j.name}',
                              style: const TextStyle(color: AppTheme.text, fontSize: 13, fontWeight: FontWeight.w600)),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedQueueJunction = val);
                          _fetchQueue();
                        }
                      },
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh, color: AppTheme.subtext, size: 20),
                  onPressed: _fetchQueue,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_loadingQueue)
            const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: AppTheme.teal)))
          else if (_queueError != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.red.withOpacity(0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: AppTheme.red),
                  const SizedBox(width: 10),
                  Expanded(child: Text(_queueError!, style: const TextStyle(color: AppTheme.red, fontSize: 12))),
                  IconButton(icon: const Icon(Icons.refresh, color: AppTheme.teal), onPressed: _fetchQueue),
                ],
              ),
            )
          else if (_queueData != null) ...[
            // Junction Signal State Banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _queueData!['current_signal_state'] == 'PRIORITY_ACTIVE'
                    ? AppTheme.red.withOpacity(0.15)
                    : AppTheme.panel,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _queueData!['current_signal_state'] == 'PRIORITY_ACTIVE' ? AppTheme.red : AppTheme.border,
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: _queueData!['current_signal_state'] == 'PRIORITY_ACTIVE' ? AppTheme.red : AppTheme.green,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Signal: ${_queueData!['current_signal_state']}',
                        style: const TextStyle(color: AppTheme.text, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ],
                  ),
                  Text(
                    'Queue Length: ${_queueData!['queue_length'] ?? 0}',
                    style: const TextStyle(color: AppTheme.teal, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Active Priority Request Card
            const Text('1. CURRENTLY ACTIVE PRIORITY VEHICLE',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
            const SizedBox(height: 8),

            if (_queueData!['active_request'] == null)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.border),
                ),
                child: const Center(
                  child: Text('No active priority vehicle executing. Normal rotation cycle armed.',
                      style: TextStyle(color: AppTheme.subtext, fontSize: 12)),
                ),
              )
            else
              _buildVehicleCard(_queueData!['active_request'], isActive: true),

            const SizedBox(height: 20),

            // Queued Requests List
            const Text('2. MULTI-AMBULANCE QUEUED ORDER (SAFE NON-PREEMPTION)',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.subtext, letterSpacing: 0.8)),
            const SizedBox(height: 8),

            if ((_queueData!['queued_requests'] as List?)?.isEmpty ?? true)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.border),
                ),
                child: const Center(
                  child: Text('No vehicles currently waiting in queue for this junction.',
                      style: TextStyle(color: AppTheme.subtext, fontSize: 12)),
                ),
              )
            else
              ...(_queueData!['queued_requests'] as List).asMap().entries.map((entry) {
                final index = entry.key;
                final req = entry.value;
                return _buildVehicleCard(req, position: index + 1);
              }),
          ],
        ],
      ),
    );
  }

  Widget _buildVehicleCard(Map<String, dynamic> req, {bool isActive = false, int? position}) {
    final triage = req['triage_priority'] ?? 'STANDARD';
    Color triageColor;
    if (triage == 'CRITICAL') {
      triageColor = AppTheme.red;
    } else if (triage == 'URGENT') {
      triageColor = AppTheme.amber;
    } else {
      triageColor = AppTheme.teal;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isActive ? AppTheme.red.withOpacity(0.08) : AppTheme.panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isActive ? AppTheme.red.withOpacity(0.4) : AppTheme.border,
          width: isActive ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  if (position != null)
                    Container(
                      padding: const EdgeInsets.all(6),
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(color: AppTheme.surface, borderRadius: BorderRadius.circular(6)),
                      child: Text('#$position', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppTheme.teal)),
                    ),
                  Text(
                    req['ambulance_id'] ?? 'AMB',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.text),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: triageColor.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: triageColor.withOpacity(0.4)),
                    ),
                    child: Text(
                      triage,
                      style: TextStyle(color: triageColor, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              Text(
                'Lane: ${req['direction']}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.teal),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Scheduling Rationale Banner
          if (req['scheduling_reason'] != null && req['scheduling_reason'].toString().isNotEmpty)
            Container(
              padding: const EdgeInsets.all(8),
              margin: const EdgeInsets.only(top: 4, bottom: 4),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 14, color: AppTheme.amber),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      req['scheduling_reason'],
                      style: const TextStyle(fontSize: 10, color: AppTheme.subtext, height: 1.3),
                    ),
                  ),
                ],
              ),
            ),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Status: ${req['status']}',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isActive ? AppTheme.red : AppTheme.subtext,
                ),
              ),
              if (req['estimated_arrival_seconds'] != null && req['estimated_arrival_seconds'] > 0)
                Text(
                  'ETA: ${req['estimated_arrival_seconds']}s',
                  style: const TextStyle(fontSize: 11, color: AppTheme.amber),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
