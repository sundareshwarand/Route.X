/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        command: {
          bg: '#0A0E17',
          panel: '#111827',
          surface: '#182234',
          border: '#243247',
          'border-subtle': '#1B2638',
          accent: '#0284C7',
          cyan: '#38BDF8',
          teal: '#2DD4BF',
          red: '#F43F5E',
          amber: '#F59E0B',
          green: '#10B981',
          text: '#F8FAFC',
          subtext: '#94A3B8',
          muted: '#64748B'
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        'command-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
        'command-card': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
        'command-glow-cyan': '0 0 15px -3px rgba(56, 189, 248, 0.15)',
        'command-glow-red': '0 0 15px -3px rgba(244, 63, 94, 0.25)',
      }
    },
  },
  plugins: [],
}
