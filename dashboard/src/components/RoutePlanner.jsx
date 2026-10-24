import React, { useState } from 'react';
import { 
  Navigation, 
  MapPin, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  Route, 
  Gauge, 
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import AIInsightsPanel from './AIInsightsPanel';
import { opsService } from '../services/api';

export default function RoutePlanner({ junctions = [] }) {
  const [startJunction, setStartJunction] = useState('JNC-01');
  const [destJunction, setDestJunction] = useState('JNC-05');
  const [routeResult, setRouteResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const calculateShortestPath = async () => {
    if (!startJunction || !destJunction) {
      setErrorMessage("Please select both origin and destination junctions.");
      return;
    }
    if (startJunction === destJunction) {
      setErrorMessage("Origin and Destination cannot be the same junction for corridor routing.");
      return;
    }
    setErrorMessage(null);
    try {
      setLoading(true);
      const res = await opsService.calculateRoute(startJunction, destJunction);
      setRouteResult(res);
    } catch (err) {
      setErrorMessage(`Routing calculation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-command-muted">Corridor Optimization</span>
                <span className="inline-block w-1 h-1 rounded-full bg-sky-400"></span>
                <span className="text-[10px] font-mono text-sky-400 font-semibold">Dijkstra Graph Engine</span>
              </div>
              <h2 className="text-base font-bold text-slate-100 tracking-tight">Intelligent Emergency Corridor Planner</h2>
            </div>
          </div>
          <p className="text-xs text-command-subtext">
            Weighted arterial shortest-path optimization based on road distance, signal cycle latency, and congestion multipliers.
          </p>
        </div>

        <div className="px-3.5 py-1.5 bg-command-surface border border-command-border rounded-lg text-xs font-mono text-sky-400 font-semibold">
          Velocity Model: 50 km/h Emergency Clearance
        </div>
      </div>

      {/* Origin & Destination Config Card */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 space-y-5 shadow-command-card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-medium text-command-muted uppercase tracking-wider">
              Ambulance Origin Junction
            </label>
            <div className="relative">
              <select 
                value={startJunction}
                onChange={(e) => setStartJunction(e.target.value)}
                className="w-full bg-command-surface border border-command-border rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono transition"
              >
                {junctions.length === 0 ? (
                  <option value="">Loading junctions...</option>
                ) : (
                  junctions.map(j => (
                    <option key={j.id} value={j.id}>{j.id} — {j.name} ({j.zone})</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-medium text-command-muted uppercase tracking-wider">
              Hospital Destination Junction
            </label>
            <div className="relative">
              <select 
                value={destJunction}
                onChange={(e) => setDestJunction(e.target.value)}
                className="w-full bg-command-surface border border-command-border rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono transition"
              >
                {junctions.length === 0 ? (
                  <option value="">Loading junctions...</option>
                ) : (
                  junctions.map(j => (
                    <option key={j.id} value={j.id}>{j.id} — {j.name} ({j.zone})</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-mono text-xs">✕</button>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button 
            disabled={loading || junctions.length === 0}
            onClick={calculateShortestPath}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs font-mono tracking-wide flex items-center space-x-2 transition shadow-sm disabled:opacity-50"
          >
            <Navigation className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'COMPUTING GRAPH...' : 'COMPUTE DIJKSTRA CORRIDOR'}</span>
          </button>
        </div>

        {/* Route Calculation Result */}
        {routeResult && (
          <div className="mt-6 pt-5 border-t border-command-border/60 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 bg-command-surface rounded-xl border border-command-border/80">
                <span className="text-[10px] font-mono text-command-muted uppercase block">Corridor Length</span>
                <span className="text-xl font-bold font-mono text-sky-400 tracking-tight">
                  {routeResult.total_distance_meters} m
                </span>
                <span className="text-[10px] text-command-muted font-mono block mt-0.5">
                  ({(routeResult.total_distance_meters / 1000).toFixed(2)} km total)
                </span>
              </div>

              <div className="p-3.5 bg-command-surface rounded-xl border border-command-border/80">
                <span className="text-[10px] font-mono text-command-muted uppercase block">Estimated Transit Time</span>
                <span className="text-xl font-bold font-mono text-emerald-400 tracking-tight">
                  {routeResult.estimated_travel_time_seconds} s
                </span>
                <span className="text-[10px] text-command-muted font-mono block mt-0.5">
                  (~{Math.round(routeResult.estimated_travel_time_seconds / 60)} min clearance)
                </span>
              </div>

              <div className="p-3.5 bg-command-surface rounded-xl border border-command-border/80">
                <span className="text-[10px] font-mono text-command-muted uppercase block">Preempted Intersections</span>
                <span className="text-xl font-bold font-mono text-slate-100 tracking-tight">
                  {routeResult.path.length} Nodes
                </span>
                <span className="text-[10px] text-command-muted font-mono block mt-0.5">
                  Cascading Green Phase
                </span>
              </div>
            </div>

            {/* Path Nodes Visual Sequence */}
            <div className="p-4 bg-command-surface rounded-xl border border-command-border/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-command-subtext">
                <span className="font-semibold text-slate-100">SEQUENTIAL PREEMPTION CORRIDOR</span>
                <span className="text-[10px] text-sky-400">ORDERED PATH</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {routeResult.path.map((node, index) => (
                  <React.Fragment key={node}>
                    <div className="flex items-center space-x-2 px-3 py-2 bg-command-panel border border-sky-500/30 rounded-lg text-xs font-mono">
                      <MapPin className="w-3.5 h-3.5 text-sky-400" />
                      <span className="font-bold text-slate-100">{node}</span>
                      <span className="text-[10px] text-command-muted">#{index + 1}</span>
                    </div>
                    {index < routeResult.path.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-command-muted" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Integrated AI Explainable Corridor Insights */}
            <div className="pt-2">
              <AIInsightsPanel 
                routeDetails={{
                  origin: startJunction,
                  destination: destJunction,
                  distance: routeResult.total_distance_meters,
                  eta: routeResult.estimated_travel_time_seconds,
                  junctions: routeResult.path
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
