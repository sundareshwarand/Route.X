import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Activity, 
  ShieldAlert, 
  Bed, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  Navigation, 
  ArrowRight, 
  Compass, 
  Clock, 
  RefreshCw,
  GitBranch,
  Layers,
  HeartPulse,
  Truck,
  Check
} from 'lucide-react';
import { opsService } from '../services/api';

export default function HospitalFleetRegistry({ onRefresh }) {
  const [hospitals, setHospitals] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [loading, setLoading] = useState(false);

  // Route Comparison Sandbox States
  const [startJunction, setStartJunction] = useState('JNC-01');
  const [selectedHospitalId, setSelectedHospitalId] = useState('HOSP-01');
  const [simulateCongestion, setSimulateCongestion] = useState(true);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparing, setComparing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hospData, ambData] = await Promise.all([
        opsService.getHospitals().catch(() => []),
        opsService.getAmbulances().catch(() => [])
      ]);
      setHospitals(hospData || []);
      setAmbulances(ambData || []);
    } catch (err) {
      console.warn("Failed to load hospital fleet data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCompareRoutes = async () => {
    try {
      setComparing(true);
      const payload = {
        start_junction_id: startJunction,
        destination_hospital_id: selectedHospitalId,
        congested_edges: simulateCongestion ? [
          { from_junction: 'JNC-02', to_junction: 'JNC-04', congestion_multiplier: 4.5 }
        ] : []
      };
      const res = await opsService.compareRoutes(payload);
      setComparisonResult(res);
    } catch (err) {
      alert(`Route comparison failed: ${err.message}`);
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-command-panel border border-command-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-command-subtle">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-command-text tracking-tight">Hospital Receiving Network & Fleet Staging</h2>
            <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-mono font-bold border border-sky-500/20">
              TRAUMA DISPATCH COORDINATION
            </span>
          </div>
          <p className="text-xs text-command-subtext">
            Real-time trauma readiness, ICU bed capacity, emergency divert status, and algorithmic routing decision support.
          </p>
        </div>

        <button 
          onClick={fetchData}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-command-surface hover:bg-command-border text-command-text rounded-lg text-xs font-mono font-medium transition border border-command-border"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${loading ? 'animate-spin' : ''}`} />
          <span>REFRESH FLEET</span>
        </button>
      </div>

      {/* Hospital Network Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading && hospitals.length === 0 ? (
          <div className="col-span-full bg-command-panel border border-command-border rounded-xl p-8 text-center text-xs text-command-subtext font-mono">
            Loading hospital network data...
          </div>
        ) : hospitals.length === 0 ? (
          <div className="col-span-full bg-command-panel border border-command-border rounded-xl p-8 text-center text-xs text-command-subtext font-mono">
            No hospital facilities registered in network database.
          </div>
        ) : hospitals.map((hosp) => {
          const isTrauma = hosp.readiness_status === 'TRAUMA_READY';
          const isNominal = hosp.readiness_status === 'CAPACITY_NOMINAL';
          const badgeClass = isTrauma ? 'bg-command-red/15 text-command-red border-command-red/30' :
            isNominal ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

          const pct = Math.round((hosp.available_icu_beds / Math.max(1, hosp.total_icu_beds)) * 100);

          return (
            <div key={hosp.id} className="bg-command-panel border border-command-border rounded-xl p-4 space-y-3 shadow-command-subtle hover:border-sky-500/30 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🏥</span>
                    <h3 className="font-bold text-sm text-command-text tracking-tight">{hosp.name}</h3>
                  </div>
                  <span className="font-mono text-[10px] text-command-muted block mt-0.5">
                    ID: <span className="text-command-subtext">{hosp.id}</span> • Node: <span className="text-sky-400">{hosp.junction_id}</span>
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badgeClass}`}>
                  {hosp.readiness_status}
                </span>
              </div>

              {/* ICU Bed Capacity Meter */}
              <div className="space-y-1.5 bg-command-surface p-2.5 rounded-lg border border-command-border/50 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-command-muted flex items-center space-x-1.5 text-[11px]">
                    <Bed className="w-3.5 h-3.5" />
                    <span>ICU Bed Availability</span>
                  </span>
                  <span className="text-command-text font-bold">
                    {hosp.available_icu_beds} / {hosp.total_icu_beds} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-command-panel rounded-full overflow-hidden border border-command-border/60">
                  <div 
                    className={`h-full transition-all duration-500 ${isTrauma ? 'bg-command-red' : isNominal ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Specialties */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-command-muted uppercase block">Trauma Specialties</span>
                <div className="flex flex-wrap gap-1">
                  {hosp.specialties?.map((spec, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-command-surface border border-command-border text-[10px] font-mono text-command-subtext">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-command-border/50 flex items-center justify-between text-[11px] font-mono">
                <span className="text-command-muted">Emergency Inbound:</span>
                <span className={`font-semibold flex items-center space-x-1 ${hosp.is_accepting_emergencies ? 'text-emerald-400' : 'text-command-red'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{hosp.is_accepting_emergencies ? 'ACCEPTING' : 'DIVERTING'}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fleet Coordination Roster */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 space-y-4 shadow-command-subtle">
        <div className="flex items-center justify-between border-b border-command-border pb-3">
          <div className="flex items-center space-x-2">
            <Truck className="w-4 h-4 text-sky-400" />
            <h3 className="font-bold text-sm text-command-text tracking-tight">Active Ambulance Fleet Roster</h3>
          </div>
          <span className="text-xs font-mono text-command-muted">
            {ambulances.length} Registered Units
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {loading && ambulances.length === 0 ? (
            <div className="col-span-full p-6 text-center text-xs text-command-subtext font-mono">
              Loading active fleet telemetry...
            </div>
          ) : ambulances.length === 0 ? (
            <div className="col-span-full p-6 text-center text-xs text-command-subtext font-mono">
              No ambulance vehicles registered in fleet.
            </div>
          ) : ambulances.map((amb) => {
            const isEnRoute = amb.status === 'EN_ROUTE';
            const isMaint = amb.status === 'MAINTENANCE';
            const badgeClass = isEnRoute
              ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 animate-pulse'
              : isMaint
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';

            return (
              <div key={amb.id} className="p-3.5 bg-command-surface rounded-xl border border-command-border space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${isEnRoute ? 'bg-sky-400 animate-ping' : isMaint ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                    <span className="font-mono text-xs font-bold text-command-text">{amb.call_sign}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold border ${badgeClass}`}>
                    {amb.status}
                  </span>
                </div>

                <div className="text-[11px] font-mono space-y-0.5 text-command-muted">
                  <div>Type: <span className="text-command-text">{amb.vehicle_type}</span></div>
                  <div>Plate: <span className="text-command-text">{amb.plate_number}</span></div>
                  <div>Base: <span className="text-command-text">{amb.base_station}</span></div>
                </div>

                <div className="pt-2 border-t border-command-border/50 flex items-center justify-between">
                  <span className="text-[10px] text-command-muted font-mono">State Override:</span>
                  {isMaint ? (
                    <button
                      onClick={async () => {
                        await opsService.updateAmbulanceStatus(amb.id, 'IDLE');
                        fetchData();
                      }}
                      className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 font-mono font-bold transition"
                    >
                      Clear Maint
                    </button>
                  ) : (
                    <button
                      disabled={isEnRoute}
                      onClick={async () => {
                        await opsService.updateAmbulanceStatus(amb.id, 'MAINTENANCE');
                        fetchData();
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition ${isEnRoute ? 'bg-command-panel text-command-muted/40 border border-command-border cursor-not-allowed' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'}`}
                      title={isEnRoute ? 'Cannot set maintenance while ambulance is active EN_ROUTE' : 'Mark ambulance as under maintenance'}
                    >
                      Set Maint
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Route Decision Support & Comparison Sandbox */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 space-y-5 shadow-command-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-command-border pb-3 gap-2">
          <div>
            <h3 className="font-bold text-sm text-command-text flex items-center space-x-2 tracking-tight">
              <Compass className="w-4 h-4 text-sky-400" />
              <span>Dijkstra Shortest Path vs Traffic-Weighted Routing</span>
            </h3>
            <p className="text-xs text-command-subtext mt-0.5">
              Mathematical graph pathfinder comparing physical length vs real-time congestion delay.
            </p>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px] font-bold border border-amber-500/30 self-start sm:self-auto">
            DETERMINISTIC GRAPH EVALUATION
          </span>
        </div>

        {/* Input Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-mono text-command-muted uppercase mb-1">ORIGIN JUNCTION</label>
            <select
              value={startJunction}
              onChange={(e) => setStartJunction(e.target.value)}
              className="w-full bg-command-surface border border-command-border rounded-lg p-2 text-xs font-mono text-command-text focus:outline-none focus:border-sky-500"
            >
              <option value="JNC-01">JNC-01 (Central Ave - 5th Cross)</option>
              <option value="JNC-02">JNC-02 (Metro Hospital Int)</option>
              <option value="JNC-03">JNC-03 (Ring Road Flyover)</option>
              <option value="JNC-04">JNC-04 (Tech Blvd Crossing)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-command-muted uppercase mb-1">DESTINATION HOSPITAL</label>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="w-full bg-command-surface border border-command-border rounded-lg p-2 text-xs font-mono text-command-text focus:outline-none focus:border-sky-500"
            >
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.junction_id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-command-muted uppercase mb-1">SIMULATE BOTTLENECK</label>
            <label className="flex items-center space-x-2 bg-command-surface border border-command-border rounded-lg p-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={simulateCongestion}
                onChange={(e) => setSimulateCongestion(e.target.checked)}
                className="rounded border-command-border text-sky-500 focus:ring-0"
              />
              <span className="text-command-text font-mono text-[11px]">Congestion JNC-02 → JNC-04 (4.5x)</span>
            </label>
          </div>

          <button
            onClick={handleCompareRoutes}
            disabled={comparing}
            className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Compass className={`w-3.5 h-3.5 ${comparing ? 'animate-spin' : ''}`} />
            <span>{comparing ? 'EVALUATING GRAPH...' : 'COMPARE CORRIDORS'}</span>
          </button>
        </div>

        {/* Results Display */}
        {comparisonResult && (
          <div className="space-y-4 pt-3 border-t border-command-border">
            {/* Recommendation Banner */}
            <div className="p-3.5 bg-command-surface rounded-xl border border-sky-500/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 font-mono uppercase flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  <span>Recommendation: {comparisonResult.recommendation}</span>
                </span>
                {comparisonResult.time_saved_seconds > 0 && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[11px] font-bold border border-emerald-500/30">
                    Saves {comparisonResult.time_saved_seconds} seconds
                  </span>
                )}
              </div>
              <p className="text-xs text-command-subtext leading-relaxed">
                {comparisonResult.decision_rationale}
              </p>
              <div className="text-[10px] font-mono text-command-muted pt-1">
                Model: <span className="text-sky-400">{comparisonResult.algorithm_type}</span> • Edge Weight Travel-Time Cost
              </div>
            </div>

            {/* Side by side comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Standard Physical Shortest */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                comparisonResult.recommendation === 'STANDARD_DISTANCE' 
                  ? 'bg-sky-500/10 border-sky-500/50' 
                  : 'bg-command-surface border-command-border'
              }`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs font-bold text-command-text flex items-center space-x-1.5">
                    <Navigation className="w-3.5 h-3.5 text-command-muted" />
                    <span>Option A: Physical Shortest Path</span>
                  </h4>
                  {comparisonResult.recommendation === 'STANDARD_DISTANCE' && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono text-[9px] font-bold">
                      OPTIMAL
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1 font-mono text-xs text-command-text font-semibold flex-wrap">
                  {comparisonResult.standard_distance_route.path.map((node, i) => (
                    <React.Fragment key={i}>
                      <span className="px-2 py-0.5 rounded bg-command-panel border border-command-border text-[11px]">{node}</span>
                      {i < comparisonResult.standard_distance_route.path.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-command-muted inline" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div>
                    <span className="text-[10px] text-command-muted block">DISTANCE</span>
                    <span className="text-command-text font-bold">{comparisonResult.standard_distance_route.total_distance_meters} m</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-command-muted block">TRANSIT TIME</span>
                    <span className={`font-bold ${comparisonResult.standard_distance_route.has_congestion ? 'text-amber-400' : 'text-command-text'}`}>
                      {comparisonResult.standard_distance_route.estimated_travel_time_seconds} s
                    </span>
                  </div>
                </div>

                {comparisonResult.standard_distance_route.has_congestion && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-400 font-mono flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span>Traverses congested segments: {comparisonResult.standard_distance_route.congested_segments.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Option B: Traffic Weighted */}
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                comparisonResult.recommendation === 'TRAFFIC_OPTIMIZED' 
                  ? 'bg-emerald-500/10 border-emerald-500/50' 
                  : 'bg-command-surface border-command-border'
              }`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs font-bold text-command-text flex items-center space-x-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Option B: Dynamic Traffic-Weighted Route</span>
                  </h4>
                  {comparisonResult.recommendation === 'TRAFFIC_OPTIMIZED' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                      RECOMMENDED
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1 font-mono text-xs text-command-text font-semibold flex-wrap">
                  {comparisonResult.traffic_optimized_route.path.map((node, i) => (
                    <React.Fragment key={i}>
                      <span className="px-2 py-0.5 rounded bg-command-panel border border-command-border text-[11px]">{node}</span>
                      {i < comparisonResult.traffic_optimized_route.path.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-command-muted inline" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div>
                    <span className="text-[10px] text-command-muted block">DISTANCE</span>
                    <span className="text-command-text font-bold">{comparisonResult.traffic_optimized_route.total_distance_meters} m</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-command-muted block">TRANSIT TIME</span>
                    <span className="text-emerald-400 font-bold">
                      {comparisonResult.traffic_optimized_route.estimated_travel_time_seconds} s
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-command-muted font-mono">
                  {comparisonResult.time_saved_seconds > 0 
                    ? `Bypasses bottleneck, providing net ${comparisonResult.time_saved_seconds}s transit advantage.` 
                    : 'Corridor velocity nominal. Shortest path matches weighted transit time.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
