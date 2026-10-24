import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../models/request_models.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  final UserModel user;
  const SettingsScreen({super.key, required this.user});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final ApiService _api = ApiService();
  final _urlController = TextEditingController();
  bool _testingConnection = false;
  String? _testResult;
  bool _testSuccess = false;

  @override
  void initState() {
    super.initState();
    _loadUrl();
  }

  Future<void> _loadUrl() async {
    final url = await _api.getBaseUrl();
    _urlController.text = url;
  }

  Future<void> _saveUrl() async {
    final cleanUrl = _urlController.text.trim();
    await _api.setBaseUrl(cleanUrl);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Endpoint saved successfully')),
    );
  }

  Future<void> _testConnection() async {
    setState(() {
      _testingConnection = true;
      _testResult = null;
    });

    final targetUrl = _urlController.text.trim();
    final stopwatch = Stopwatch()..start();

    try {
      final rootUrl = targetUrl.replaceAll('/api', '');
      final response = await http.get(Uri.parse(rootUrl)).timeout(const Duration(seconds: 5));
      stopwatch.stop();

      if (response.statusCode == 200) {
        setState(() {
          _testSuccess = true;
          _testResult = 'Connected (HTTP 200) • ${stopwatch.elapsedMilliseconds} ms latency';
        });
      } else {
        setState(() {
          _testSuccess = false;
          _testResult = 'HTTP ${response.statusCode}: Unexpected response';
        });
      }
    } catch (e) {
      stopwatch.stop();
      setState(() {
        _testSuccess = false;
        _testResult = 'Connection failed: ${e.toString().replaceAll('Exception: ', '')}';
      });
    } finally {
      if (mounted) setState(() => _testingConnection = false);
    }
  }

  Future<void> _logout() async {
    await _api.logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('App & Driver Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // User Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.panel,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.border),
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: AppTheme.surface,
                    radius: 24,
                    child: Icon(Icons.person, color: AppTheme.teal),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.user.fullName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.text)),
                        Text(widget.user.email, style: const TextStyle(color: AppTheme.subtext, fontSize: 12)),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: AppTheme.teal.withOpacity(0.15), borderRadius: BorderRadius.circular(6)),
                          child: Text(widget.user.role.toUpperCase(), style: const TextStyle(color: AppTheme.teal, fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Endpoint Settings
            const Text('BACKEND API ENDPOINT', style: TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.8)),
            const SizedBox(height: 8),

            TextField(
              controller: _urlController,
              style: const TextStyle(color: AppTheme.text, fontSize: 13, fontFamily: 'monospace'),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppTheme.panel,
                suffixIcon: IconButton(
                  icon: const Icon(Icons.save, color: AppTheme.teal), 
                  onPressed: _saveUrl,
                  tooltip: 'Save Endpoint',
                ),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.border)),
              ),
            ),
            const SizedBox(height: 10),

            // Quick Preset Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _urlController.text = "http://localhost:8000/api";
                      _saveUrl();
                    },
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.border),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: const Text('Localhost (Web)', style: TextStyle(fontSize: 10, color: AppTheme.subtext)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _urlController.text = "http://10.0.2.2:8000/api";
                      _saveUrl();
                    },
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppTheme.border),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    child: const Text('Emulator', style: TextStyle(fontSize: 10, color: AppTheme.subtext)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Ping Connection Test Button
            ElevatedButton.icon(
              onPressed: _testingConnection ? null : _testConnection,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.surface,
                foregroundColor: AppTheme.teal,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: const BorderSide(color: AppTheme.border)),
              ),
              icon: _testingConnection 
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.teal))
                  : const Icon(Icons.network_check, size: 16),
              label: Text(_testingConnection ? 'Testing Gateway Reachability...' : 'Test Connection & Ping Server'),
            ),

            if (_testResult != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _testSuccess ? AppTheme.green.withOpacity(0.12) : AppTheme.red.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _testSuccess ? AppTheme.green.withOpacity(0.3) : AppTheme.red.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(_testSuccess ? Icons.check_circle : Icons.error_outline, size: 18, color: _testSuccess ? AppTheme.green : AppTheme.red),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _testResult!,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _testSuccess ? AppTheme.green : AppTheme.red,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 20),

            // Physical Phone LAN Guide Card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.surface.withOpacity(0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.border.withOpacity(0.6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.wifi, size: 15, color: AppTheme.teal),
                      SizedBox(width: 6),
                      Text('Physical Android Device Setup (Same Wi-Fi)', style: TextStyle(color: AppTheme.text, fontSize: 11, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '1. Find PC LAN IP: open PowerShell, run "ipconfig" (e.g. 192.168.1.105)\n'
                    '2. Start backend bound to 0.0.0.0:\n'
                    '   uvicorn app.main:app --host 0.0.0.0 --port 8000\n'
                    '3. Enter URL above: http://<PC-LAN-IP>:8000/api and tap Save.',
                    style: TextStyle(color: AppTheme.subtext, fontSize: 10, height: 1.4, fontFamily: 'monospace'),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 32),

            OutlinedButton.icon(
              onPressed: _logout,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.red,
                side: const BorderSide(color: AppTheme.red),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.logout),
              label: const Text('Sign Out'),
            ),
          ],
        ),
      ),
    );
  }
}
