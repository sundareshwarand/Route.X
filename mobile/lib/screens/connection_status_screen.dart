import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class ConnectionStatusScreen extends StatefulWidget {
  const ConnectionStatusScreen({super.key});

  @override
  State<ConnectionStatusScreen> createState() => _ConnectionStatusScreenState();
}

class _ConnectionStatusScreenState extends State<ConnectionStatusScreen> {
  final ApiService _api = ApiService();
  bool _checking = false;
  bool? _backendOnline;
  String _currentUrl = '';

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  Future<void> _checkStatus() async {
    setState(() => _checking = true);
    final url = await _api.getBaseUrl();
    final ok = await _api.checkConnection();
    if (mounted) {
      setState(() {
        _currentUrl = url;
        _backendOnline = ok;
        _checking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Network & Gateway Diagnostics'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.border),
              ),
              child: Column(
                children: [
                  Icon(
                    _backendOnline == true ? Icons.check_circle : Icons.error_outline,
                    size: 48,
                    color: _backendOnline == true ? AppTheme.green : AppTheme.red,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _backendOnline == true ? 'Backend Reachable' : 'Backend Disconnected',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: _backendOnline == true ? AppTheme.green : AppTheme.red,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _currentUrl,
                    style: const TextStyle(fontSize: 12, color: AppTheme.subtext, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            _buildDiagnosticRow(
              title: 'FastAPI Backend Core',
              status: _backendOnline == true ? 'Online (HTTP 200)' : 'Offline / Timeout',
              ok: _backendOnline == true,
            ),
            const SizedBox(height: 10),
            _buildDiagnosticRow(
              title: 'Ambulance RF Unit',
              status: 'Mobile Standalone Mode (Simulated LoRa)',
              ok: true,
            ),
            const SizedBox(height: 10),
            _buildDiagnosticRow(
              title: 'Junction Gateway Controller',
              status: 'REST API Synchronization (Virtual Gateway)',
              ok: true,
            ),
            const SizedBox(height: 10),
            _buildDiagnosticRow(
              title: 'Physical Microcontroller Link',
              status: 'Not Connected (Mobile Standalone Mode)',
              ok: false,
            ),
            const Spacer(),

            ElevatedButton.icon(
              onPressed: _checking ? null : _checkStatus,
              icon: _checking
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: AppTheme.bg, strokeWidth: 2))
                  : const Icon(Icons.refresh),
              label: Text(_checking ? 'Pinging Services...' : 'Re-test Connectivity'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDiagnosticRow({required String title, required String status, required bool ok}) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.panel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(color: AppTheme.text, fontSize: 13, fontWeight: FontWeight.w600)),
          Text(status, style: TextStyle(color: ok ? AppTheme.green : AppTheme.red, fontSize: 11, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
