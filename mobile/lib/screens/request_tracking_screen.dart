import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';
import '../widgets/emergency_route_canvas.dart';

class RequestTrackingScreen extends StatefulWidget {
  final String requestId;
  const RequestTrackingScreen({super.key, required this.requestId});

  @override
  State<RequestTrackingScreen> createState() => _RequestTrackingScreenState();
}

class _RequestTrackingScreenState extends State<RequestTrackingScreen> {
  final ApiService _api = ApiService();
  EmergencyRequestModel? _request;
  Map<String, dynamic>? _simData;
  Timer? _pollingTimer;
  int _remainingSeconds = 20;
  Timer? _countdownTimer;
  bool _cancelling = false;
  bool _completing = false;

  @override
  void initState() {
    super.initState();
    _fetchDetails();
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (_) => _fetchDetails());
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchDetails() async {
    try {
      final reqs = await _api.getRequests();
      final match = reqs.firstWhere((r) => r.id == widget.requestId);
      final sim = await _api.getSimulationStatus();

      if (mounted) {
        setState(() {
          _request = match;
          if (sim != null) _simData = sim;
        });

        if (match.status == 'PRIORITY_ACTIVE' && _countdownTimer == null) {
          _remainingSeconds = match.durationSeconds;
          _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
            if (_remainingSeconds > 0) {
              setState(() => _remainingSeconds--);
            } else {
              t.cancel();
            }
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _handleCancel() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.panel,
        title: const Text('Confirm Emergency Cancellation', style: TextStyle(color: AppTheme.text, fontSize: 16)),
        content: const Text(
          'This will immediately cancel priority signal status and revert the junction to normal cycle.',
          style: TextStyle(color: AppTheme.subtext, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Dismiss', style: TextStyle(color: AppTheme.subtext)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.red),
            child: const Text('Confirm Cancel', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _cancelling = true);
    try {
      await _api.cancelRequest(widget.requestId, "Cancelled by ambulance operator via mobile app.");
      await _fetchDetails();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  Future<void> _handleComplete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.panel,
        title: const Text('Confirm Transit Completion', style: TextStyle(color: AppTheme.text, fontSize: 16)),
        content: const Text(
          'Confirm arrival at receiving hospital. Priority signal holds will be released safely and junction queue advanced.',
          style: TextStyle(color: AppTheme.subtext, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Dismiss', style: TextStyle(color: AppTheme.subtext)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
            child: const Text('Confirm Arrival', style: TextStyle(color: AppTheme.bg, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _completing = true);
    try {
      await _api.completeEmergencyRequest(widget.requestId);
      await _fetchDetails();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _request?.status ?? 'PENDING';
    final isPriority = status == 'PRIORITY_ACTIVE';
    final isCompleted = status == 'COMPLETED';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Transit Tracker'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Workflow mode badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              margin: const EdgeInsets.only(bottom: 16),
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
                      'MOBILE-APP WORKFLOW (SIMULATED PRIORITY)',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.teal, letterSpacing: 0.5),
                    ),
                  ),
                ],
              ),
            ),

            // Real-Time Municipal Corridor Vector Canvas
            EmergencyRouteCanvas(
              junctions: (_simData?['junctions'] as List?)
                  ?.map((item) => Map<String, dynamic>.from(item as Map))
                  .toList(),
              ambulance: (_simData?['ambulances'] as List?)?.isNotEmpty == true
                  ? Map<String, dynamic>.from(_simData!['ambulances'][0] as Map)
                  : null,
              activeRoute: const ['JNC-01', 'JNC-02', 'JNC-03', 'JNC-05'],
              height: 240,
            ),
            const SizedBox(height: 16),

            // Status Hero Card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: isPriority ? AppTheme.red.withOpacity(0.12) : AppTheme.panel,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isPriority ? AppTheme.red : AppTheme.border,
                  width: isPriority ? 2 : 1,
                ),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isPriority ? AppTheme.red.withOpacity(0.2) : AppTheme.surface,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isPriority ? Icons.traffic : (isCompleted ? Icons.check_circle : Icons.hourglass_top),
                      size: 48,
                      color: isPriority ? AppTheme.red : (isCompleted ? AppTheme.green : AppTheme.amber),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    status,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: isPriority ? AppTheme.red : (isCompleted ? AppTheme.green : AppTheme.text),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    isPriority
                        ? 'Traffic signal outputs locked on PRIORITY GREEN'
                        : (isCompleted ? 'Transit cleared. Signal safely reverted to normal rotation.' : 'Awaiting confirmation from junction gateway...'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: AppTheme.subtext),
                  ),

                  // Triage Badge
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: _request?.triagePriority == 'CRITICAL'
                          ? AppTheme.red.withOpacity(0.2)
                          : (_request?.triagePriority == 'URGENT' ? AppTheme.amber.withOpacity(0.2) : AppTheme.teal.withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _request?.triagePriority == 'CRITICAL'
                            ? AppTheme.red
                            : (_request?.triagePriority == 'URGENT' ? AppTheme.amber : AppTheme.teal),
                      ),
                    ),
                    child: Text(
                      'TRIAGE: ${_request?.triagePriority ?? 'STANDARD'}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _request?.triagePriority == 'CRITICAL'
                            ? AppTheme.red
                            : (_request?.triagePriority == 'URGENT' ? AppTheme.amber : AppTheme.teal),
                      ),
                    ),
                  ),

                  if (_request?.schedulingReason != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppTheme.border),
                      ),
                      child: Text(
                        'Scheduling: ${_request!.schedulingReason}',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 11, color: AppTheme.teal, fontFamily: 'monospace'),
                      ),
                    ),
                  ],

                  if (isPriority) ...[
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppTheme.red.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: AppTheme.red.withOpacity(0.4)),
                      ),
                      child: Text(
                        'PRIORITY HOLD: ${_remainingSeconds}s',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.red),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Stepper Progression Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.border),
              ),
              child: Column(
                children: [
                  _buildStepRow(
                    step: 1,
                    title: 'Request Queued (Backend)',
                    subtitle: 'Origin: ${_request?.source ?? 'MOBILE_APP'} (Simulated)',
                    active: true,
                    completed: ['RECEIVED', 'PRIORITY_ACTIVE', 'COMPLETED'].contains(status),
                  ),
                  const Divider(color: AppTheme.border, height: 20),
                  _buildStepRow(
                    step: 2,
                    title: 'Gateway / Controller Acknowledgment',
                    subtitle: 'Target: ${_request?.junctionId ?? 'JNC-01'}',
                    active: ['RECEIVED', 'PRIORITY_ACTIVE', 'COMPLETED'].contains(status),
                    completed: ['PRIORITY_ACTIVE', 'COMPLETED'].contains(status),
                  ),
                  const Divider(color: AppTheme.border, height: 20),
                  _buildStepRow(
                    step: 3,
                    title: 'Signal Priority Active (${_request?.isVerifiedHardware == true ? "HW VERIFIED" : "SIMULATED"})',
                    subtitle: 'Approach Lane: ${_request?.direction ?? 'STRAIGHT'}',
                    active: ['PRIORITY_ACTIVE', 'COMPLETED'].contains(status),
                    completed: status == 'COMPLETED',
                  ),
                  const Divider(color: AppTheme.border, height: 20),
                  _buildStepRow(
                    step: 4,
                    title: 'Safe Reversion / Completed',
                    subtitle: 'Safe normal rotation restored',
                    active: isCompleted,
                    completed: isCompleted,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Actions: Complete or Cancel
            if (['PENDING', 'RECEIVED', 'PRIORITY_ACTIVE'].contains(status)) ...[
              ElevatedButton.icon(
                onPressed: _completing ? null : _handleComplete,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.green,
                  foregroundColor: AppTheme.bg,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: _completing
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: AppTheme.bg, strokeWidth: 2))
                    : const Icon(Icons.check_circle, size: 20),
                label: Text(
                  _completing ? 'Completing Transit...' : 'Complete Transit (Arrived at Hospital)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _cancelling ? null : _handleCancel,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.red,
                  side: const BorderSide(color: AppTheme.red),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                icon: const Icon(Icons.cancel, size: 20),
                label: Text(_cancelling ? 'Reverting Signal...' : 'Cancel Priority / Safe Standby'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStepRow({
    required int step,
    required String title,
    required String subtitle,
    required bool active,
    required bool completed,
  }) {
    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: completed ? AppTheme.green : (active ? AppTheme.teal : AppTheme.surface),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: completed
                ? const Icon(Icons.check, size: 16, color: AppTheme.bg)
                : Text(
                    '$step',
                    style: TextStyle(
                      color: active ? AppTheme.bg : AppTheme.subtext,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: active ? AppTheme.text : AppTheme.subtext,
                  fontWeight: active ? FontWeight.bold : FontWeight.normal,
                  fontSize: 13,
                ),
              ),
              Text(
                subtitle,
                style: const TextStyle(color: AppTheme.subtext, fontSize: 11),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
