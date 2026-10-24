import 'package:flutter/material.dart';

class AppTheme {
  // Midnight Command Design System Palette
  static const Color bg = Color(0xFF101827);
  static const Color panel = Color(0xFF1B293D);
  static const Color surface = Color(0xFF263449);
  static const Color border = Color(0xFF334155);
  static const Color teal = Color(0xFF5EEAD4);
  static const Color red = Color(0xFFF87171);
  static const Color amber = Color(0xFFFBBF24);
  static const Color green = Color(0xFF34D399);
  static const Color text = Color(0xFFE5EDF8);
  static const Color subtext = Color(0xFFA8B6C9);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      primaryColor: teal,
      colorScheme: const ColorScheme.dark(
        primary: teal,
        secondary: amber,
        error: red,
        surface: panel,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: panel,
        foregroundColor: text,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: text,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: panel,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: border, width: 1),
        ),
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(color: text, fontWeight: FontWeight.bold),
        titleLarge: TextStyle(color: text, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(color: text),
        bodyMedium: TextStyle(color: subtext),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: teal,
          foregroundColor: bg,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          side: const BorderSide(color: border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}
