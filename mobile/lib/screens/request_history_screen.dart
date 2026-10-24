import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';

class RequestHistoryScreen extends StatefulWidget {
  const RequestHistoryScreen({super.key});

  @override
  State<RequestHistoryScreen> createState() => _RequestHistoryScreenState();
}

class _RequestHistoryScreenState extends State<RequestHistoryScreen> {
  final ApiService _api = ApiService();
  List<EmergencyRequestModel> _requests = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    setState(() => _loading = true);
    try {
      final list = await _api.getRequests();
      if (mounted) setState(() => _requests = list);
    } catch (_) {}
    finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Transit Request Logs'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadHistory,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
          : _requests.isEmpty
              ? const Center(
                  child: Text('No request history found.', style: TextStyle(color: AppTheme.subtext)),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _requests.length,
                  itemBuilder: (context, index) {
                    final req = _requests[index];
                    final isComp = req.status == 'COMPLETED';
                    final isPrio = req.status == 'PRIORITY_ACTIVE';

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
                                    Text(
                                      req.ambulanceId,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.text),
                                    ),
                                    const SizedBox(width: 8),
                                    const Text('→', style: TextStyle(color: AppTheme.subtext)),
                                    const SizedBox(width: 8),
                                    Text(
                                      req.junctionId,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.teal),
                                    ),
                                  ],
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: isComp ? AppTheme.green.withOpacity(0.15) : (isPrio ? AppTheme.red.withOpacity(0.15) : AppTheme.surface),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isComp ? AppTheme.green : (isPrio ? AppTheme.red : AppTheme.border),
                                    ),
                                  ),
                                  child: Text(
                                    req.status,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: isComp ? AppTheme.green : (isPrio ? AppTheme.red : AppTheme.subtext),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Lane Approach: ${req.direction} | ${req.durationSeconds}s duration',
                              style: const TextStyle(color: AppTheme.subtext, fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Requested: ${req.requestedAt}',
                              style: const TextStyle(color: AppTheme.subtext, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
