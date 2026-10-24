import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import 'driver_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final ApiService _api = ApiService();
  final _emailController = TextEditingController(text: 'driver1@routex.org');
  final _passwordController = TextEditingController(text: 'driver123');
  bool _loading = false;
  String? _errorMessage;

  Future<void> _handleLogin() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final user = await _api.login(
        _emailController.text.trim(),
        _passwordController.text.trim(),
      );

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => DriverHomeScreen(user: user)),
      );
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showEndpointConfig() async {
    final currentUrl = await _api.getBaseUrl();
    final controller = TextEditingController(text: currentUrl);

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.panel,
        title: const Text('Backend API URL', style: TextStyle(color: AppTheme.text, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Enter server address:\n• Android Emulator: http://10.0.2.2:8000/api\n• Local Windows: http://127.0.0.1:8000/api\n• Physical Device: http://<YOUR_PC_IP>:8000/api',
              style: TextStyle(color: AppTheme.subtext, fontSize: 12),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: const TextStyle(color: AppTheme.text, fontSize: 13),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppTheme.surface,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.subtext)),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = controller.text.trim();
              await _api.setBaseUrl(newUrl);
              if (!ctx.mounted) return;
              Navigator.pop(ctx);
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Endpoint updated successfully')),
              );
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('RouteX Driver Access'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: AppTheme.subtext),
            onPressed: _showEndpointConfig,
            tooltip: 'Server Settings',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            Center(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.panel,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppTheme.teal.withOpacity(0.2)),
                ),
                child: const Icon(Icons.local_hospital, color: AppTheme.teal, size: 48),
              ),
            ),
            const SizedBox(height: 20),
            const Center(
              child: Text(
                'Ambulance Transit Portal',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.text),
              ),
            ),
            const Center(
              child: Text(
                'Sign in with authorized driver credentials',
                style: TextStyle(fontSize: 13, color: AppTheme.subtext),
              ),
            ),
            const SizedBox(height: 32),

            if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: AppTheme.red.withOpacity(0.15),
                  border: Border.all(color: AppTheme.red.withOpacity(0.3)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: AppTheme.red, fontSize: 13),
                ),
              ),

            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              style: const TextStyle(color: AppTheme.text),
              decoration: InputDecoration(
                labelText: 'Operator / Driver Email',
                labelStyle: const TextStyle(color: AppTheme.subtext),
                prefixIcon: const Icon(Icons.email, color: AppTheme.teal),
                filled: true,
                fillColor: AppTheme.panel,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.teal)),
              ),
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _passwordController,
              obscureText: true,
              style: const TextStyle(color: AppTheme.text),
              decoration: InputDecoration(
                labelText: 'Password',
                labelStyle: const TextStyle(color: AppTheme.subtext),
                prefixIcon: const Icon(Icons.lock, color: AppTheme.teal),
                filled: true,
                fillColor: AppTheme.panel,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.border)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.border)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.teal)),
              ),
            ),
            const SizedBox(height: 24),

            ElevatedButton(
              onPressed: _loading ? null : _handleLogin,
              child: _loading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: AppTheme.bg, strokeWidth: 2))
                  : const Text('Authorize Transit Access'),
            ),
            const SizedBox(height: 24),

            const Row(
              children: [
                Expanded(child: Divider(color: AppTheme.border)),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('TEST CREDENTIALS', style: TextStyle(color: AppTheme.subtext, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
                Expanded(child: Divider(color: AppTheme.border)),
              ],
            ),
            const SizedBox(height: 16),

            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _emailController.text = 'driver1@routex.org';
                      _passwordController.text = 'driver123';
                    },
                    child: const Text('Ambulance Driver', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      _emailController.text = 'citizen@routex.org';
                      _passwordController.text = 'citizen123';
                    },
                    child: const Text('Citizen User', style: TextStyle(fontSize: 12)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
