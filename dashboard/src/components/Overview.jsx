import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  ArrowUpRight, 
  Cpu, 
  MapPin,
  RefreshCw,
  Compass,
  Layers,
  Map as MapIcon,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
  Truck,
  Sparkles,
  ChevronRight,
  Shield
} from 'lucide-react';
import IntersectionVisualizer from './IntersectionVisualizer';
import InteractiveMap from './InteractiveMap';
import ScenarioLab from './ScenarioLab';
import IncidentTimeline from './IncidentTimeline';
import ConflictVisualizer from './ConflictVisualizer';
import AIInsightsPanel from './AIInsightsPanel';
import { opsService } from '../services/api';

export default function Overview({ analytics, junctions = [], activeRequests = [], onRefresh }) {
  const [simulationStatus, setSimulationStatus] = useState(null);
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'intersection'
  const [selectedJunction, setSelectedJunction] = useState(null);
  const [ambulances, setAmbulances] = useState([]);

  const fetchSimulationState = async () => {
    try {
      const data = await opsService.getSimulationStatus();
      setSimulationStatus(data);
    } catch (err) {
      console.warn("Could not fetch simulation status:", err);
    }
  };

  const fetchFleet = async () => {
    try {
      const ambData = await opsService.getAmbulances();
      if (Array.isArray(ambData)) setAmbulances(ambData);
    } catch (err) {
      console.warn("Could not fetch fleet:", err);
    }
  };

  useEffect(() => {
    fetchSimulationState();
    fetchFleet();
    const interval = setInterval(fetchSimulationState, 1500);
    return () => clearInterval(interval);
  }, []);

  const latestActive = activeRequests.find(r => r.status === 'PRIORITY_ACTIVE' || r.status === 'RECEIVED') || activeRequests[0];
  const targetJunction = junctions.find(j => latestActive && j.id === latestActive.junction_id) || junctions[0];

  const activeTransitsCount = simulationStatus?.ambulances?.filter(a => a.status !== 'ARRIVED').length 
    ?? analytics?.active_requests 
    ?? activeRequests.filter(r => r.status === 'PRIORITY_ACTIVE').length 
    ?? 0;

  const onlineJunctionsCount = simulationStatus?.junctions?.filter(j => j.is_online).length 
    ?? analytics?.online_junctions_count 
    ?? junctions.filter(j => j.is_online).length 
    ?? junctions.length;

  const idleAmbulancesCount = ambulances.filter(a => a.status === 'IDLE').length;
  const maintenanceAmbulancesCount = ambulances.filter(a => a.status === 'MAINTENANCE').length;
  const enRouteAmbulancesCount = ambulances.filter(a => a.status === 'EN_ROUTE' || a.status === 'RETURNING').length;

  return (
    <div className="space-y-6">
      {/* Operations Command Header Strip */}
      <div className="bg-command-panel border border-command-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-command-card">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-base font-bold text-slate-100 tracking-tight">Operations Command Center</h2>
            <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-mono font-bold border border-sky-500/30">
              ARTERIAL GRID ACTIVE
            </span>
          </div>
          <p className="text-xs text-command-subtext">
            Municipal Emergency Transit Preemption Engine • LoRa Mesh Relay &amp; AI Decision Support Active
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* View Toggle */}
          <div className="flex items-center bg-command-surface border border-command-border rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'map' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-command-muted hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Corridor Map</span>
            </button>
            <button
              onClick={() => setViewMode('intersection')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                viewMode === 'intersection' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-command-muted hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Junction SVG</span>
            </button>
          </div>

          <button 
            onClick={() => { onRefresh(); fetchSimulationState(); fetchFleet(); }}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-command-surface hover:bg-command-border text-slate-200 rounded-lg text-xs font-mono font-medium transition border border-command-border"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Scenario Lab Bar */}
      <ScenarioLab 
        simulationStatus={simulationStatus}
        onRefresh={() => { onRefresh(); fetchSimulationState(); }}
      />

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Emergency Transits */}
        <div className={`bg-command-panel border rounded-xl p-4 transition shadow-command-card ${
          activeTransitsCount > 0 ? 'border-rose-500/40 bg-rose-500/5' : 'border-command-border'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-command-muted uppercase tracking-wider font-mono">Active Corridors</span>
            <div className={`p-2 rounded-lg ${activeTransitsCount > 0 ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-command-surface text-command-muted'}`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className={`text-3xl font-bold font-mono tracking-tight ${activeTransitsCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
              {activeTransitsCount}
            </span>
            <span className={`text-xs font-semibold ${activeTransitsCount > 0 ? 'text-rose-400' : 'text-command-muted'}`}>
              {activeTransitsCount > 0 ? 'Preemption Active' : 'Standby Mode'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-command-muted flex items-center justify-between border-t border-command-border/50 pt-2 font-mono">
            <span>Completed: {analytics?.completed_requests ?? 0}</span>
            <span>Speed: {simulationStatus?.speed_multiplier ?? 1}x</span>
          </div>
        </div>

        {/* Monitored Junctions */}
        <div className="bg-command-panel border border-command-border rounded-xl p-4 transition shadow-command-card hover:border-sky-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-command-muted uppercase tracking-wider font-mono">Monitored Junctions</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-slate-100 tracking-tight">
              {onlineJunctionsCount}
            </span>
            <span className="text-xs text-command-muted font-mono">/ {junctions.length || 5} Online</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 flex items-center space-x-1.5 border-t border-command-border/50 pt-2 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Wi-Fi &amp; LoRa Gateways Nominal</span>
          </div>
        </div>

        {/* Fleet Availability */}
        <div className="bg-command-panel border border-command-border rounded-xl p-4 transition shadow-command-card hover:border-sky-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-command-muted uppercase tracking-wider font-mono">Ambulance Fleet</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold font-mono text-sky-400 tracking-tight">
              {idleAmbulancesCount || (ambulances.length > 0 ? idleAmbulancesCount : 2)}
            </span>
            <span className="text-xs text-command-muted font-mono">Ready / {ambulances.length || 3} Total</span>
          </div>
          <div className="mt-2 text-[11px] text-command-muted flex items-center justify-between border-t border-command-border/50 pt-2 font-mono">
            <span className="text-emerald-400">En Route: {enRouteAmbulancesCount || (activeTransitsCount > 0 ? 1 : 0)}</span>
            <span className="text-amber-400">Maint: {maintenanceAmbulancesCount}</span>
          </div>
        </div>

        {/* Telemetry Provenance */}
        <div className="bg-command-panel border border-command-border rounded-xl p-4 transition shadow-command-card hover:border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-command-muted uppercase tracking-wider font-mono">Telemetry Mode</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-xl font-bold font-mono text-amber-300 tracking-tight">
              SIMULATED
            </span>
            <span className="text-[10px] text-command-muted font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              BENCHMARK
            </span>
          </div>
          <div className="mt-2 text-[11px] text-command-muted flex items-center justify-between border-t border-command-border/50 pt-2 font-mono">
            <span>Hardware Armed: YES</span>
            <span>Non-Public Lab</span>
          </div>
        </div>
      </div>

      {/* Primary Visual Display: Interactive Map vs Intersection Visualizer */}
      <div className="bg-command-panel border border-command-border rounded-xl overflow-hidden shadow-command-card">
        <div className="px-4 py-2.5 border-b border-command-border flex items-center justify-between bg-command-surface/50">
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            <span className="font-semibold text-slate-100">
              {viewMode === 'map' ? 'MUNICIPAL EMERGENCY CORRIDOR GIS [LEAFLET OSM / GOOGLE MAPS / VECTOR]' : 'JUNCTION PHASE CONTROLLER SVG'}
            </span>
          </div>
          <span className="text-[11px] text-command-muted font-mono">
            {viewMode === 'map' ? 'Real-Time Edge Weights & Ambulance Position' : `Target: ${targetJunction?.name || 'JNC-01'}`}
          </span>
        </div>

        <div>
          {viewMode === 'map' ? (
            <InteractiveMap 
              simulationStatus={simulationStatus}
              junctions={junctions}
              onSelectJunction={(j) => setSelectedJunction(j)}
            />
          ) : (
            <IntersectionVisualizer 
              junction={targetJunction} 
              activeRequest={latestActive} 
            />
          )}
        </div>
      </div>

      {/* AI Operations Insights Panel (Compact, Explainable, Strictly Advisory) */}
      <AIInsightsPanel 
        activeRequest={latestActive}
        simulationStatus={simulationStatus}
      />

      {/* Real API-backed Priority Request Queue Snapshot */}
      <div className="bg-command-panel border border-command-border rounded-xl p-4 shadow-command-card space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-command-border/60">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-sky-400" />
            <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider">
              Emergency Preemption Request Queue (Live API Feed)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-command-muted">
            {activeRequests.length} Active in System
          </span>
        </div>

        {activeRequests.length === 0 ? (
          <div className="py-4 text-center text-xs text-command-muted font-mono bg-command-surface/40 rounded-lg border border-command-border/50">
            No active emergency requests in transit. System in standby rotation.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-command-border/70">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-command-surface text-command-muted text-[10px] border-b border-command-border">
                <tr>
                  <th className="py-2 px-3">Vehicle</th>
                  <th className="py-2 px-3">Priority</th>
                  <th className="py-2 px-3">Junction Target</th>
                  <th className="py-2 px-3">Direction</th>
                  <th className="py-2 px-3">Preemption Status</th>
                  <th className="py-2 px-3">Clearance Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-command-border/40 text-[11px]">
                {activeRequests.slice(0, 5).map((req) => (
                  <tr key={req.id} className="hover:bg-command-surface/40 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-100">{req.ambulance_id || 'AMB-01'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                        req.triage_priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                        req.triage_priority === 'URGENT' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                        'bg-sky-500/10 text-sky-300 border-sky-500/30'
                      }`}>
                        {req.triage_priority || 'NORMAL'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sky-400 font-semibold">{req.junction_id}</td>
                    <td className="py-2.5 px-3 text-slate-300">{req.direction}</td>
                    <td className="py-2.5 px-3">
                      <span className={`font-semibold ${
                        req.status === 'PRIORITY_ACTIVE' ? 'text-emerald-400' :
                        req.status === 'RECEIVED' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-command-muted text-[10px] truncate max-w-xs">
                      {req.scheduling_reason || 'Sequential clearance interval enforced'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Section: Live Incident Timeline + Conflict Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <IncidentTimeline 
            timeline={simulationStatus?.timeline || []}
          />
        </div>

        <div className="lg:col-span-6">
          <ConflictVisualizer 
            simulationStatus={simulationStatus}
          />
        </div>
      </div>
    </div>
  );
}
