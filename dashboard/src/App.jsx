import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  MapPin, 
  Radio, 
  Navigation, 
  Bell, 
  Terminal, 
  BarChart3, 
  Settings, 
  LogOut, 
  ShieldAlert,
  Wifi, 
  WifiOff, 
  User, 
  Clock, 
  RefreshCw, 
  Building2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Layers,
  Lock,
  Mail,
  Menu,
  X as CloseIcon,
  Sparkles
} from 'lucide-react';

import { authService, opsService, getBaseUrl, getWsUrl, aiService } from './services/api';
import Overview from './components/Overview';
import ActiveRequests from './components/ActiveRequests';
import JunctionMonitoring from './components/JunctionMonitoring';
import RoutePlanner from './components/RoutePlanner';
import NearbyVehicleAlerts from './components/NearbyVehicleAlerts';
import DiagnosticsTesting from './components/DiagnosticsTesting';
import AnalyticsReports from './components/AnalyticsReports';
import ReliabilityMonitor from './components/ReliabilityMonitor';
import SystemSettings from './components/SystemSettings';
import HospitalFleetRegistry from './components/HospitalFleetRegistry';

const NAV_GROUPS = [
  {
    title: 'CORRIDOR SURVEILLANCE',
    items: [
      { id: 'overview', label: 'Operations Overview', icon: Activity },
      { id: 'requests', label: 'Priority Requests', icon: Radio, badgeKey: 'active_requests' },
      { id: 'junctions', label: 'Junction Fleet Grid', icon: MapPin },
      { id: 'routes', label: 'Dijkstra Corridor Planner', icon: Navigation }
    ]
  },
  {
    title: 'MUNICIPAL ASSETS',
    items: [
      { id: 'hospitals', label: 'Hospitals & Fleet Hub', icon: Building2 },
      { id: 'alerts', label: 'Advisory Test Alerts', icon: Bell }
    ]
  },
  {
    title: 'ENGINEERING & AUDIT',
    items: [
      { id: 'diagnostics', label: 'Virtual Hardware Lab', icon: Terminal, accent: 'amber' },
      { id: 'reliability', label: 'RF Telemetry Monitor', icon: Wifi },
      { id: 'analytics', label: 'Audit Ledger & Reports', icon: BarChart3 }
    ]
  },
  {
    title: 'SYSTEM CONTROL',
    items: [
      { id: 'settings', label: 'Platform Settings', icon: Settings }
    ]
  }
];

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ROUTEX_USER');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('overview');
  
  // Application Data States
  const [analytics, setAnalytics] = useState(null);
  const [junctions, setJunctions] = useState([]);
  const [activeRequests, setActiveRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [wsState, setWsState] = useState('DISCONNECTED'); // 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DISCONNECTED'
  const [lastTelemetryTime, setLastTelemetryTime] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('operator@routex.org');
  const [loginPassword, setLoginPassword] = useState('operator123');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => localStorage.getItem('ROUTEX_API_URL') || getBaseUrl());
  const [serverSavedNotice, setServerSavedNotice] = useState(false);

  const handleSaveServerUrl = () => {
    const cleaned = serverUrlInput.trim().replace(/\/+$/, '');
    if (cleaned) {
      localStorage.setItem('ROUTEX_API_URL', cleaned);
      setServerSavedNotice(true);
      setTimeout(() => {
        setServerSavedNotice(false);
        setServerModalOpen(false);
      }, 800);
    }
  };

  // Fetch Core Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [anData, jncData, reqData, altData, aiData] = await Promise.all([
        opsService.getAnalytics().catch((err) => { console.warn("Analytics fetch error:", err); return null; }),
        opsService.getJunctions().catch((err) => { console.warn("Junctions fetch error:", err); return null; }),
        opsService.getRequests().catch((err) => { console.warn("Requests fetch error:", err); return null; }),
        opsService.getAlerts().catch((err) => { console.warn("Alerts fetch error:", err); return null; }),
        aiService.getStatus().catch((err) => { console.warn("AI status fetch error:", err); return null; })
      ]);
      if (anData) setAnalytics(anData);
      if (jncData) setJunctions(jncData);
      if (reqData) setActiveRequests(reqData);
      if (altData) setAlerts(altData);
      if (aiData) setAiStatus(aiData);

      if (!anData && !jncData && !reqData && !altData) {
        setFetchError(`Unable to connect to RouteX backend at ${getBaseUrl()}`);
      } else {
        setFetchError(null);
        setLastTelemetryTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Data refresh failed", err);
      setFetchError(`Data refresh error: ${err.message || 'Network error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 6000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // WebSocket for Live Push Events with Backoff Auto-Reconnect
  useEffect(() => {
    if (!user) {
      setWsState('DISCONNECTED');
      return;
    }
    let ws = null;
    let reconnectTimer = null;
    let isSubscribed = true;
    let retryCount = 0;

    const connectWs = () => {
      if (!isSubscribed) return;
      setWsState(retryCount === 0 ? 'CONNECTING' : 'RECONNECTING');
      const wsUrl = getWsUrl();

      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          if (!isSubscribed) return;
          setWsState('LIVE');
          setLastTelemetryTime(new Date().toLocaleTimeString());
          retryCount = 0;
        };
        ws.onclose = () => {
          if (!isSubscribed) return;
          setWsState('RECONNECTING');
          const delay = Math.min(10000, 1500 * Math.pow(1.5, retryCount) + Math.random() * 500);
          retryCount++;
          reconnectTimer = setTimeout(connectWs, delay);
        };
        ws.onerror = () => {
          if (!isSubscribed) return;
          if (ws) ws.close();
        };
        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          setLastTelemetryTime(new Date().toLocaleTimeString());
          try {
            const payload = JSON.parse(event.data);
            if (payload.event) {
              fetchData();
            }
          } catch (e) {}
        };
      } catch (e) {
        setWsState('DISCONNECTED');
        const delay = Math.min(10000, 2000 * Math.pow(1.5, retryCount));
        retryCount++;
        reconnectTimer = setTimeout(connectWs, delay);
      }
    };

    connectWs();

    return () => {
      isSubscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      setWsState('DISCONNECTED');
    };
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoginLoading(true);
      setLoginError('');
      const data = await authService.login(loginEmail, loginPassword);
      setUser(data.user);
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  // Get active tab title for breadcrumbs
  const currentNav = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab);
  const activeTitle = currentNav ? currentNav.label : 'Operations Overview';

  // Enterprise Command Center Authentication Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-command-bg flex flex-col justify-between p-6 antialiased">
        {/* Top Minimal Branding */}
        <div className="flex items-center justify-between max-w-6xl w-full mx-auto py-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wider text-command-text">RouteX</span>
              <span className="text-[10px] text-command-muted font-mono ml-2 border border-command-border px-1.5 py-0.5 rounded">EOC v2.0</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setServerModalOpen(!serverModalOpen)}
            className="flex items-center space-x-2 text-xs font-mono text-command-muted px-2.5 py-1 bg-command-surface border border-command-border hover:border-sky-500/50 rounded-lg transition"
            title="Configure Cloud or Local Backend API URL"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="hidden sm:inline text-slate-300">ENDPOINT:</span>
            <span className="font-semibold text-sky-400 max-w-[150px] sm:max-w-[200px] truncate">{getBaseUrl()}</span>
            <Settings className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Center Card */}
        <div className="w-full max-w-md mx-auto my-auto space-y-4">
          {serverModalOpen && (
            <div className="bg-command-panel border border-sky-500/40 rounded-xl p-4 shadow-command-card space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" /> Backend API Endpoint
                </span>
                <span className="text-[10px] text-sky-400 font-mono">HTTPS Cloud / LAN / Local</span>
              </div>
              <input 
                type="url"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="https://routex-backend.onrender.com/api"
                className="w-full bg-command-surface border border-command-border rounded-lg px-3 py-2 text-xs text-command-text font-mono focus:border-sky-500 focus:outline-none"
              />
              <div className="flex justify-between items-center pt-1">
                <button 
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('ROUTEX_API_URL');
                    setServerUrlInput(getBaseUrl());
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline font-mono"
                >
                  Reset Default
                </button>
                <button 
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition"
                >
                  {serverSavedNotice ? 'Saved!' : 'Apply URL'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-command-panel border border-command-border rounded-2xl p-8 shadow-command-card space-y-6">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto text-sky-400 mb-3 shadow-command-glow-cyan">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-lg font-bold text-command-text tracking-tight">Operations Command Gateway</h1>
              <p className="text-xs text-command-subtext">
                Municipal Emergency Traffic Preemption & LoRa Sensor Network
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-command-red/10 border border-command-red/30 rounded-lg text-xs text-command-red flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-command-subtext mb-1 uppercase tracking-wider font-mono">
                  Operator Identity
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-command-muted absolute left-3 top-3" />
                  <input 
                    type="email" 
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="operator@routex.org"
                    className="w-full bg-command-surface border border-command-border rounded-lg pl-9 pr-3 py-2.5 text-xs text-command-text placeholder-command-muted focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-command-subtext mb-1 uppercase tracking-wider font-mono">
                  Security Passkey
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-command-muted absolute left-3 top-3" />
                  <input 
                    type="password" 
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-command-surface border border-command-border rounded-lg pl-9 pr-3 py-2.5 text-xs text-command-text focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loginLoading}
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs tracking-wide transition shadow-command-glow-cyan flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Authenticate & Open Command Console</span>
                )}
              </button>
            </form>

            {/* Quick Demo Access Bar */}
            <div className="pt-4 border-t border-command-border/60 space-y-2">
              <span className="text-[11px] font-mono text-command-muted block text-center uppercase tracking-wider">
                Authorized Preset Personas
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => { setLoginEmail('operator@routex.org'); setLoginPassword('operator123'); }}
                  className="px-2.5 py-2 bg-command-surface hover:bg-command-border/70 rounded-lg border border-command-border text-center text-xs text-command-text transition flex flex-col items-center space-y-0.5"
                >
                  <span className="font-semibold text-sky-400 text-[11px]">Traffic Commander</span>
                  <span className="text-[9px] text-command-muted font-mono">operator@routex.org</span>
                </button>
                <button 
                  type="button"
                  onClick={() => { setLoginEmail('driver1@routex.org'); setLoginPassword('driver123'); }}
                  className="px-2.5 py-2 bg-command-surface hover:bg-command-border/70 rounded-lg border border-command-border text-center text-xs text-command-text transition flex flex-col items-center space-y-0.5"
                >
                  <span className="font-semibold text-emerald-400 text-[11px]">Fleet Medic (AMB-01)</span>
                  <span className="text-[9px] text-command-muted font-mono">driver1@routex.org</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <div className="max-w-md w-full mx-auto text-center">
          <p className="text-[11px] text-command-muted">
            Municipal IoT Traffic Safety Research Prototype • Fail-Safe Relays Active
          </p>
        </div>
      </div>
    );
  }

  // Authenticated Command Center Shell
  return (
    <div className="min-h-screen bg-command-bg flex flex-col antialiased selection:bg-sky-500 selection:text-slate-950">
      {/* Top Application Bar */}
      <header className="h-14 bg-command-panel border-b border-command-border px-5 flex items-center justify-between sticky top-0 z-40">
        {/* Left: Breadcrumbs & Current Context */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="md:hidden p-1.5 rounded-lg bg-command-surface border border-command-border text-slate-300 hover:text-sky-400 transition"
            title="Toggle Navigation Menu"
          >
            {mobileNavOpen ? <CloseIcon className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-wide text-command-text">RouteX</span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-command-muted hidden sm:block" />

          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-xs font-semibold text-command-text">{activeTitle}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          </div>
        </div>

        {/* Center: Live Telemetry Indicator Pills */}
        <div className="hidden lg:flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1 bg-command-surface rounded-full text-xs border border-command-border">
            <span className={`w-2 h-2 rounded-full ${analytics?.active_requests > 0 ? 'bg-command-red animate-pulse' : 'bg-command-muted'}`}></span>
            <span className="text-command-subtext text-[11px]">Active Emergency Priority:</span>
            <span className={`font-mono font-bold ${analytics?.active_requests > 0 ? 'text-command-red' : 'text-command-text'}`}>
              {analytics?.active_requests ?? 0}
            </span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1 bg-command-surface rounded-full text-xs border border-command-border">
            {wsState === 'LIVE' ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : wsState === 'RECONNECTING' || wsState === 'CONNECTING' ? (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="text-command-subtext text-[11px]">Telemetry Mesh:</span>
            <span className={`font-mono text-[11px] font-bold ${
              wsState === 'LIVE' ? 'text-emerald-400' :
              wsState === 'RECONNECTING' || wsState === 'CONNECTING' ? 'text-amber-400' :
              'text-slate-400'
            }`}>
              {wsState === 'LIVE' ? 'LIVE WS' : wsState}
            </span>
            {lastTelemetryTime && (
              <span className="text-[10px] text-command-muted font-mono hidden xl:inline border-l border-command-border/60 pl-2">
                {lastTelemetryTime}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 px-3 py-1 bg-command-surface rounded-full text-xs border border-command-border">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-command-subtext text-[11px]">AI Advisor:</span>
            <span className={`font-mono text-[11px] font-bold ${aiStatus?.is_configured ? 'text-sky-400' : 'text-slate-400'}`}>
              {aiStatus?.is_configured ? (aiStatus?.model || 'GEMINI 3.5 FLASH') : 'DETERMINISTIC'}
            </span>
          </div>
        </div>

        {/* Right: Actions & User Persona Pill */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={fetchData}
            disabled={loading}
            title="Sync live telemetry"
            className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-command-surface hover:bg-command-border text-command-subtext hover:text-command-text rounded-lg text-xs font-mono transition border border-command-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            <span className="hidden sm:inline text-[11px]">SYNC</span>
          </button>

          <div className="h-4 w-[1px] bg-command-border hidden sm:block"></div>

          <div className="flex items-center space-x-2.5 pl-1">
            <div className="w-7 h-7 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 text-xs font-bold font-mono">
              {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'OP'}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-semibold text-command-text block leading-tight">{user.full_name || 'Operator'}</span>
              <span className="text-[9px] text-sky-400 font-mono uppercase tracking-wider block font-bold">{user.role}</span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            title="Disconnect session"
            className="p-1.5 bg-command-surface hover:bg-command-red/15 rounded-lg text-command-subtext hover:text-command-red transition border border-command-border ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Backend Connection Warning Banner */}
      {fetchError && (
        <div className="bg-command-red/10 border-b border-command-red/30 px-6 py-2 flex items-center justify-between text-xs text-command-red animate-pulse">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{fetchError}</span>
          </div>
          <button 
            onClick={fetchData} 
            className="px-2.5 py-0.5 bg-command-red/20 hover:bg-command-red/30 rounded font-semibold text-[11px] transition font-mono"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Layout: Sidebar + Main Content */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left Professional Command Sidebar */}
        <aside className={`w-full md:w-64 bg-command-panel border-r border-command-border p-3 flex-col justify-between shrink-0 transition-all ${
          mobileNavOpen ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="space-y-4">
            {NAV_GROUPS.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1">
                <span className="px-3 text-[10px] font-mono font-bold text-command-muted uppercase tracking-wider block mb-1">
                  {group.title}
                </span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const badgeCount = item.badgeKey && analytics ? analytics[item.badgeKey] : 0;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition group ${
                        isActive
                          ? 'bg-sky-500/10 text-sky-400 font-semibold border-l-2 border-sky-400 pl-2.5'
                          : 'text-command-subtext hover:bg-command-surface hover:text-command-text'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 transition ${isActive ? 'text-sky-400' : 'text-command-muted group-hover:text-command-text'}`} />
                        <span>{item.label}</span>
                      </div>
                      {badgeCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-command-red/20 text-command-red font-mono text-[10px] font-bold border border-command-red/30">
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Status Footer */}
          <div className="pt-3 border-t border-command-border/60 text-[10px] font-mono text-command-muted space-y-1">
            <div className="flex items-center justify-between">
              <span>SYSTEM WATCHDOG</span>
              <span className="text-emerald-400 font-bold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ARMED</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>CONTROLLERS</span>
              <span className="text-command-text">{junctions.filter(j => j.is_online).length} / {junctions.length || 5} ONLINE</span>
            </div>
          </div>
        </aside>

        {/* Primary Page Canvas */}
        <main className="flex-1 p-5 md:p-6 overflow-y-auto bg-command-bg">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'overview' && (
              <Overview 
                analytics={analytics}
                junctions={junctions}
                activeRequests={activeRequests}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'requests' && (
              <ActiveRequests 
                requests={activeRequests}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'junctions' && (
              <JunctionMonitoring 
                junctions={junctions}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'routes' && (
              <RoutePlanner 
                junctions={junctions}
              />
            )}

            {activeTab === 'hospitals' && (
              <HospitalFleetRegistry 
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'alerts' && (
              <NearbyVehicleAlerts 
                alerts={alerts}
                junctions={junctions}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'diagnostics' && (
              <DiagnosticsTesting 
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'reliability' && (
              <ReliabilityMonitor 
                junctions={junctions}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsReports 
                analytics={analytics}
              />
            )}

            {activeTab === 'settings' && (
              <SystemSettings 
                user={user}
                onLogout={handleLogout}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
