import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class EmergencyRouteCanvas extends StatefulWidget {
  final List<Map<String, dynamic>>? junctions;
  final Map<String, dynamic>? ambulance;
  final List<String>? activeRoute;
  final double height;

  const EmergencyRouteCanvas({
    super.key,
    this.junctions,
    this.ambulance,
    this.activeRoute,
    this.height = 320.0,
  });

  @override
  State<EmergencyRouteCanvas> createState() => _EmergencyRouteCanvasState();
}

class _EmergencyRouteCanvasState extends State<EmergencyRouteCanvas> with SingleTickerProviderStateMixin {
  late AnimationController _animController;

  static const List<Map<String, dynamic>> _defaultJunctions = [
    {'id': 'JNC-01', 'name': 'Central Ave', 'lat': 28.6139, 'lon': 77.2090, 'signal_state': 'NORMAL_CYCLE'},
    {'id': 'JNC-02', 'name': 'Metro Hospital', 'lat': 28.6180, 'lon': 77.2140, 'signal_state': 'NORMAL_CYCLE'},
    {'id': 'JNC-03', 'name': 'Ring Road', 'lat': 28.6220, 'lon': 77.2190, 'signal_state': 'NORMAL_CYCLE'},
    {'id': 'JNC-04', 'name': 'Tech Blvd', 'lat': 28.6250, 'lon': 77.2250, 'signal_state': 'NORMAL_CYCLE'},
    {'id': 'JNC-05', 'name': 'Trauma Corridor Exit', 'lat': 28.6300, 'lon': 77.2300, 'signal_state': 'NORMAL_CYCLE'},
  ];

  static const List<List<String>> _roadEdges = [
    ['JNC-01', 'JNC-02'],
    ['JNC-01', 'JNC-03'],
    ['JNC-02', 'JNC-03'],
    ['JNC-02', 'JNC-04'],
    ['JNC-03', 'JNC-05'],
    ['JNC-04', 'JNC-05'],
  ];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final junctionList = (widget.junctions != null && widget.junctions!.isNotEmpty)
        ? widget.junctions!
        : _defaultJunctions;

    final amb = widget.ambulance;
    final route = widget.activeRoute ?? (amb?['route'] as List?)?.cast<String>() ?? ['JNC-01', 'JNC-02', 'JNC-03', 'JNC-05'];

    return Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Interactive Pan & Zoom Canvas
          InteractiveViewer(
            minScale: 0.8,
            maxScale: 2.5,
            boundaryMargin: const EdgeInsets.all(24),
            child: AnimatedBuilder(
              animation: _animController,
              builder: (context, _) {
                return CustomPaint(
                  size: Size(double.infinity, widget.height),
                  painter: _CorridorMapPainter(
                    junctions: junctionList,
                    edges: _roadEdges,
                    ambulance: amb,
                    activeRoute: route,
                    pulseValue: _animController.value,
                  ),
                );
              },
            ),
          ),

          // Header Overlay Strip
          Positioned(
            top: 10,
            left: 12,
            right: 12,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.panel.withOpacity(0.9),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: AppTheme.teal,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        "CORRIDOR MAP",
                        style: TextStyle(color: AppTheme.text, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppTheme.amber.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text(
                          "SIMULATED",
                          style: TextStyle(color: AppTheme.amber, fontSize: 8, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                if (amb != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.panel.withOpacity(0.9),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Text(
                      "ETA: ${amb['eta_seconds'] ?? 0}s",
                      style: const TextStyle(color: AppTheme.teal, fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                    ),
                  ),
              ],
            ),
          ),

          // Footer Legend Strip
          Positioned(
            bottom: 8,
            left: 12,
            right: 12,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    _buildLegendItem(AppTheme.green, "Priority Green"),
                    const SizedBox(width: 10),
                    _buildLegendItem(AppTheme.red, "Clearance"),
                    const SizedBox(width: 10),
                    _buildLegendItem(AppTheme.teal, "Normal"),
                  ],
                ),
                const Text(
                  "Pinch to zoom",
                  style: TextStyle(color: AppTheme.subtext, fontSize: 9),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(color: AppTheme.subtext, fontSize: 9)),
      ],
    );
  }
}

class _CorridorMapPainter extends CustomPainter {
  final List<Map<String, dynamic>> junctions;
  final List<List<String>> edges;
  final Map<String, dynamic>? ambulance;
  final List<String> activeRoute;
  final double pulseValue;

  _CorridorMapPainter({
    required this.junctions,
    required this.edges,
    required this.ambulance,
    required this.activeRoute,
    required this.pulseValue,
  });

  // Bounding box for testbed
  static const double minLat = 28.6110;
  static const double maxLat = 28.6330;
  static const double minLon = 28.6110 < 0 ? 0 : 77.2060;
  static const double maxLon = 77.2330;

  Offset _project(double lat, double lon, Size size) {
    const double padX = 36.0;
    const double padY = 46.0;
    final double availW = size.width - 2 * padX;
    final double availH = size.height - 2 * padY;

    final double normX = (lon - minLon) / (maxLon - minLon);
    final double normY = (lat - minLat) / (maxLat - minLat);

    final double x = padX + normX * availW;
    final double y = size.height - padY - normY * availH;
    return Offset(x, y);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final Map<String, Offset> jPoints = {};
    final Map<String, Map<String, dynamic>> jData = {};

    for (final j in junctions) {
      final double lat = (j['lat'] as num?)?.toDouble() ?? 28.62;
      final double lon = (j['lon'] as num?)?.toDouble() ?? 77.21;
      final String id = j['id']?.toString() ?? '';
      jPoints[id] = _project(lat, lon, size);
      jData[id] = j;
    }

    // 1. Draw Blueprint Background Grid
    final gridPaint = Paint()
      ..color = const Color(0xFF1E293B).withOpacity(0.4)
      ..strokeWidth = 1.0;
    const double gridSpacing = 30.0;
    for (double x = 0; x < size.width; x += gridSpacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += gridSpacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 2. Draw Road Corridors (Base Asphalt)
    final roadBasePaint = Paint()
      ..color = const Color(0xFF1E293B)
      ..strokeWidth = 14.0
      ..strokeCap = StrokeCap.round;

    final roadDashPaint = Paint()
      ..color = const Color(0xFF334155)
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;

    for (final edge in edges) {
      final p1 = jPoints[edge[0]];
      final p2 = jPoints[edge[1]];
      if (p1 != null && p2 != null) {
        canvas.drawLine(p1, p2, roadBasePaint);
        canvas.drawLine(p1, p2, roadDashPaint);
      }
    }

    // 3. Draw Active Emergency Route Green Wave Glow
    if (activeRoute.length >= 2) {
      final routeGlowPaint = Paint()
        ..color = AppTheme.green.withOpacity(0.35)
        ..strokeWidth = 9.0
        ..strokeCap = StrokeCap.round;

      final routeLinePaint = Paint()
        ..color = AppTheme.green
        ..strokeWidth = 4.0
        ..strokeCap = StrokeCap.round;

      for (int i = 0; i < activeRoute.length - 1; i++) {
        final p1 = jPoints[activeRoute[i]];
        final p2 = jPoints[activeRoute[i + 1]];
        if (p1 != null && p2 != null) {
          canvas.drawLine(p1, p2, routeGlowPaint);
          canvas.drawLine(p1, p2, routeLinePaint);
        }
      }
    }

    // 4. Draw Junction Pins with Signal Halos
    for (final entry in jPoints.entries) {
      final id = entry.key;
      final point = entry.value;
      final data = jData[id];
      final signal = data?['signal_state']?.toString() ?? 'NORMAL_CYCLE';
      final bool isPriority = signal == 'PRIORITY_ACTIVE';
      final bool isClearance = signal == 'FAILSAFE_ALL_RED';

      // Pulse Halo for Priority or Clearance
      if (isPriority || isClearance) {
        final haloColor = isPriority ? AppTheme.green : AppTheme.red;
        final double haloRadius = 16.0 + (pulseValue * 8.0);
        final haloPaint = Paint()
          ..color = haloColor.withOpacity((1.0 - pulseValue) * 0.45)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.0;
        canvas.drawCircle(point, haloRadius, haloPaint);
      }

      // Outer Node Ring
      final Color nodeColor = isPriority
          ? AppTheme.green
          : isClearance
              ? AppTheme.red
              : AppTheme.teal;

      final ringPaint = Paint()
        ..color = nodeColor
        ..style = PaintingStyle.fill;
      canvas.drawCircle(point, 11.0, ringPaint);

      // Inner Core
      final corePaint = Paint()
        ..color = const Color(0xFF0F172A)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(point, 8.0, corePaint);

      // Junction ID Label
      final shortId = id.replaceAll('JNC-', 'J');
      final textPainter = TextPainter(
        text: TextSpan(
          text: shortId,
          style: TextStyle(color: nodeColor, fontSize: 8, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, point - Offset(textPainter.width / 2, textPainter.height / 2));

      // Destination Hospital Icon Badge at JNC-05
      if (id == 'JNC-05') {
        final crossPaint = Paint()
          ..color = AppTheme.green
          ..strokeWidth = 2.0;
        canvas.drawLine(point + const Offset(14, -6), point + const Offset(14, 6), crossPaint);
        canvas.drawLine(point + const Offset(8, 0), point + const Offset(20, 0), crossPaint);
      }
    }

    // 5. Draw Animated Ambulance Vector Marker
    if (ambulance != null && ambulance!['status'] != 'ARRIVED') {
      final double lat = (ambulance!['current_lat'] as num?)?.toDouble() ?? 28.6139;
      final double lon = (ambulance!['current_lon'] as num?)?.toDouble() ?? 77.2090;
      final double heading = (ambulance!['heading'] as num?)?.toDouble() ?? 0.0;
      final ambPos = _project(lat, lon, size);

      // Siren Radar Ring
      final sirenPaint = Paint()
        ..color = AppTheme.red.withOpacity((1.0 - pulseValue) * 0.5)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5;
      canvas.drawCircle(ambPos, 14.0 + (pulseValue * 10.0), sirenPaint);

      // Vehicle Marker Body
      final bodyPaint = Paint()
        ..color = AppTheme.red
        ..style = PaintingStyle.fill;
      canvas.drawCircle(ambPos, 10.0, bodyPaint);

      final borderPaint = Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0;
      canvas.drawCircle(ambPos, 10.0, borderPaint);

      // Directional Heading Indicator Arrow
      final double rad = (heading - 90.0) * (math.pi / 180.0);
      final arrowTip = ambPos + Offset(math.cos(rad) * 16.0, math.sin(rad) * 16.0);
      final arrowPaint = Paint()
        ..color = Colors.white
        ..strokeWidth = 2.0
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(ambPos, arrowTip, arrowPaint);

      // Call Sign Pill Label
      final callSign = ambulance!['call_sign']?.toString() ?? 'AMB';
      final speed = ambulance!['speed_kmh']?.toString() ?? '50';
      final pillText = '$callSign ($speed km/h)';

      final pillPainter = TextPainter(
        text: TextSpan(
          text: pillText,
          style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
        ),
        textDirection: TextDirection.ltr,
      )..layout();

      final pillRect = Rect.fromCenter(
        center: ambPos - const Offset(0, 20),
        width: pillPainter.width + 10,
        height: pillPainter.height + 4,
      );
      final pillBgPaint = Paint()
        ..color = AppTheme.red
        ..style = PaintingStyle.fill;
      canvas.drawRRect(RRect.fromRectAndRadius(pillRect, const Radius.circular(4)), pillBgPaint);
      pillPainter.paint(canvas, ambPos - Offset(pillPainter.width / 2, 20 + pillPainter.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant _CorridorMapPainter oldDelegate) {
    return true; // Continuously animated pulse
  }
}
