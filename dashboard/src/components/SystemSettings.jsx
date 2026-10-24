import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  AlertTriangle, 
  Shield, 
  User, 
  LogOut, 
  Check, 
  Server, 
  Key, 
  Lock, 
  Globe, 
  Sparkles,
  Cpu,
  Info,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Terminal
} from 'lucide-react';
import { authService, getBaseUrl, aiService } from '../services/api';

export default function SystemSettings({ user, onLogout }) {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('ROUTEX_API_URL') || getBaseUrl());
  const [saved, setSaved] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [refreshingAi, setRefreshingAi] = useState(false);

  const fetchAiStatus = () => {
    setRefreshingAi(true);
    aiService.getStatus()
      .then(res => setAiStatus(res))
      .catch(() => setAiStatus({ is_configured: false, status_label: 'UNAVAILABLE' }))
      .finally(() => setTimeout(() => setRefreshingAi(false), 500));
  };

  useEffect(() => {
    fetchAiStatus();
  }, []);

  const handleSave = () => {
    localStorage.setItem('ROUTEX_API_URL', apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isAiActive = aiStatus?.is_configured ?? false;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest uppercase text-command-muted">Administration</span>
            <span className="inline-block w-1 h-1 rounded-full bg-sky-400"></span>
            <span className="text-[10px] font-mono text-sky-400 font-semibold">Security &amp; AI Architecture</span>
          </div>
          <h2 className="text-base font-bold text-slate-100">System Configuration &amp; Safety Parameters</h2>
          <p className="text-xs text-command-subtext">
            Operational thresholds, backend connectivity, Gemini AI configuration, and session controls
          </p>
        </div>
      </div>

      {/* Safety Notice Card */}
      <div className="bg-command-panel border border-rose-500/30 rounded-xl p-5 shadow-command-card space-y-2.5 text-xs">
        <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span>Research Prototype Safety Constraint</span>
        </div>
        <p className="text-command-subtext leading-relaxed">
          RouteX is an educational and empirical prototype designed to switch localized test LEDs and evaluate LoRa mesh latency under controlled laboratory conditions. 
          It must <strong className="text-rose-300">NEVER</strong> be wired directly into real-world municipal solid-state or electro-mechanical traffic signal controllers without formal DOT certification, dual failover interlocking relays, and municipal traffic engineering approval.
        </p>
      </div>

      {/* Google Gemini AI Advisory Configuration Card */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-command-border/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Google Gemini AI Advisory Module</h3>
              <p className="text-[11px] text-command-subtext">Explainable routing insights &amp; incident forensics</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${
              isAiActive 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}>
              {isAiActive ? 'ONLINE & CONFIGURED' : 'RULE-BASED FALLBACK (UNCONFIGURED)'}
            </span>
            <button
              onClick={fetchAiStatus}
              disabled={refreshingAi}
              className="p-1.5 bg-command-surface hover:bg-command-border border border-command-border text-slate-300 hover:text-sky-400 rounded-lg transition disabled:opacity-50"
              title="Refresh AI Status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingAi ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-command-surface p-4 rounded-lg border border-command-border/70">
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">AI Provider</span>
            <span className="font-semibold text-slate-200">{aiStatus?.provider || 'Google Gemini'}</span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Active Model</span>
            <span className="font-mono font-bold text-sky-400">{aiStatus?.model || 'gemini-2.5-flash'}</span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Operational Mode</span>
            <span className={isAiActive ? "text-emerald-300 font-semibold" : "text-amber-300 font-semibold"}>
              {isAiActive ? "Live Gemini Generation (Advisory)" : "Deterministic Rule Engine (Fallback)"}
            </span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Key Storage</span>
            <span className="text-emerald-400 font-semibold font-mono">backend/.env (Local Only)</span>
          </div>
        </div>

        {/* Local Setup Instructions Card */}
        <div className="p-4 bg-command-surface/50 rounded-lg border border-command-border/60 text-xs text-command-subtext space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold text-[11px]">
              <Key className="w-3.5 h-3.5 text-sky-400" />
              <span>Easy &amp; Secure Local Activation</span>
            </div>
            <a 
              href="https://aistudio.google.com/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-mono"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          
          <p className="text-[11px] leading-relaxed">
            API keys are strictly managed on your machine in <code className="text-slate-300">backend/.env</code> and never exposed to the frontend or version control.
          </p>

          <div className="bg-command-bg/90 p-3 rounded-md border border-command-border/80 font-mono text-[11px] space-y-2">
            <div className="flex items-center space-x-2 text-sky-400 font-semibold">
              <Terminal className="w-3.5 h-3.5" />
              <span>Run the Local PowerShell Setup Helper:</span>
            </div>
            <div className="bg-black/40 px-3 py-2 rounded text-emerald-300 select-all overflow-x-auto text-[10px]">
              powershell -ExecutionPolicy Bypass -File &quot;scripts\setup_routex_gemini.ps1&quot;
            </div>
            <p className="text-[10px] text-command-muted">
              Prompts for your key with masked input, verifies Git ignore, and restarts the RouteX backend safely.
            </p>
          </div>
        </div>
      </div>

      {/* Multi-Tier Zero-Billing GIS & Basemap Configuration Card */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-command-border/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Zero-Billing GIS &amp; Map Engine Architecture</h3>
              <p className="text-[11px] text-command-subtext">OpenStreetMap (Default Free), Google Maps Demo Key &amp; Offline SVG</p>
            </div>
          </div>
          <div>
            {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
              <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                GOOGLE MAPS DEMO CONFIGURED
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold border bg-sky-500/15 text-sky-300 border-sky-500/30">
                OPENSTREETMAP (100% FREE &amp; ZERO-BILLING)
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-command-surface p-4 rounded-lg border border-command-border/70">
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Primary Basemap Engine</span>
            <span className="font-semibold text-slate-200">
              {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? 'Google Maps JavaScript API' : 'Leaflet + OpenStreetMap (Official Raster)'}
            </span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Billing &amp; Payment Risk</span>
            <span className="font-mono font-bold text-emerald-400">Zero Billing Required (No Card / No UPI)</span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Map Theme</span>
            <span className="text-slate-200 font-semibold font-mono">Midnight Obsidian / OSM Dark Mode</span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Offline Safeguard</span>
            <span className="text-sky-400 font-semibold font-mono">Tactical SVG Vector Grid Fallback</span>
          </div>
        </div>

        <div className="p-4 bg-command-surface/50 rounded-lg border border-command-border/60 text-xs text-command-subtext space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-200 font-semibold flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-sky-400" />
              <span>Official Google Maps Free Demo Key (Zero Billing)</span>
            </span>
            <a 
              href="https://developers.google.com/maps/documentation/javascript/demo-key" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-mono"
            >
              <span>Google Maps Demo Key Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-[11px] leading-relaxed">
            Google provides a dedicated <strong className="text-slate-200">Maps Demo Key</strong> for testing without requiring a Google Cloud billing account or credit card. If you obtain one, add it to <code className="text-slate-200">dashboard/.env.local</code>:
          </p>
          <div className="bg-command-bg/90 p-2.5 rounded font-mono text-[11px] text-sky-300 select-all border border-command-border/80">
            VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your_demo_key_here
          </div>
          <p className="text-[10px] text-emerald-300/90">
            ✓ Out of the box, RouteX automatically loads free OpenStreetMap tiles with zero configuration or keys needed.
          </p>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-command-border/60">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">Backend Communication Configuration</h3>
            <p className="text-[11px] text-command-subtext">Base route used for REST API requests and telemetry streams</p>
          </div>
        </div>

        <div>
          <label className="block text-xs text-command-muted font-medium mb-1.5">FastAPI Backend Endpoint URL</label>
          <div className="relative">
            <Globe className="w-4 h-4 text-command-muted absolute left-3 top-3 pointer-events-none" />
            <input 
              type="text" 
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-command-surface border border-command-border rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-500 placeholder-slate-600"
              placeholder="http://192.168.1.50:8000/api"
            />
          </div>
          <span className="text-[11px] text-command-muted mt-1.5 block">
            For phone or LAN testing, ensure this resolves to your host machine's local IP address (e.g., <code className="text-sky-300 font-mono">http://192.168.x.x:8000/api</code>).
          </span>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-command-border/50">
          <span className="text-xs text-command-subtext">Changes persist in local browser storage across dashboard sessions.</span>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs flex items-center space-x-1.5 shadow-sm transition"
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Saved Successfully' : 'Save Endpoint'}</span>
          </button>
        </div>
      </div>

      {/* Current User Session */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-command-border/60">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">Current Active Operator Session</h3>
            <p className="text-[11px] text-command-subtext">Cryptographically authenticated role credentials</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-command-surface p-4 rounded-lg border border-command-border/70">
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Email Identifier</span>
            <span className="font-mono font-semibold text-slate-200">{user?.email || 'operator@routex.org'}</span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Assigned Security Role</span>
            <span className="font-mono font-bold text-sky-400 uppercase">{user?.role || 'OPERATOR'}</span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Operator Full Name</span>
            <span className="font-semibold text-slate-200">{user?.full_name || 'Traffic Operations Commander'}</span>
          </div>
          <div>
            <span className="text-command-muted block text-[10px] font-mono uppercase">Session Status</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Active &amp; Authenticated</span>
            </span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button 
            onClick={onLogout}
            className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 font-semibold rounded-lg text-xs flex items-center space-x-1.5 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Terminate Session (Logout)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
