import React from 'react';
import { 
  GitFork, 
  ShieldAlert, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Activity,
  ShieldCheck
} from 'lucide-react';

export default function ConflictVisualizer({ simulationStatus }) {
  const ambulances = simulationStatus?.ambulances || [];
  const junctions = simulationStatus?.junctions || [];
  const targetJunction = junctions.find(j => j.id === 'JNC-02') || junctions[0];
  const isConflictScenario = simulationStatus?.active_scenario === 'MULTI_AMBULANCE_CONFLICT';

  return (
    <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-command-border">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <GitFork className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider">
              Multi-Ambulance Conflict &amp; Triage Resolution Matrix
            </h3>
            <p className="text-[11px] text-command-subtext">Deterministic arbitration between converging emergency vehicles</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
          NON-PREEMPTIVE QUEUE
        </span>
      </div>

      {/* Side-by-Side Contending Ambulances */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ambulances.length >= 2 ? (
          ambulances.map((amb) => {
            const isGranted = targetJunction?.granted_to === amb.id;
            const isQueued = targetJunction?.queue?.includes(amb.id);

            return (
              <div 
                key={amb.id}
                className={`p-4 rounded-xl border transition-all duration-200 ${
                  isGranted 
                    ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.1)]' 
                    : isQueued 
                    ? 'bg-amber-500/10 border-amber-500/40 shadow-xs' 
                    : 'bg-command-surface border-command-border'
                }`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-command-border/50">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-slate-100">{amb.call_sign}</span>
                    <span className="text-[10px] font-mono text-command-muted">({amb.id})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                    amb.triage_priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                    amb.triage_priority === 'URGENT' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                    'bg-command-surface text-command-muted border-command-border'
                  }`}>
                    {amb.triage_priority}
                  </span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-command-subtext">
                    <span className="text-command-muted">Vehicle Class:</span>
                    <span className="text-slate-200">{amb.vehicle_type}</span>
                  </div>
                  <div className="flex justify-between text-command-subtext">
                    <span className="text-command-muted">Target Intersection:</span>
                    <span className="text-sky-400 font-bold">{amb.approaching_junction || 'JNC-02'}</span>
                  </div>
                  <div className="flex justify-between text-command-subtext">
                    <span className="text-command-muted">Distance to Stop Line:</span>
                    <span className="text-slate-200 font-bold">{Math.round(amb.distance_to_junction || 0)}m</span>
                  </div>
                  <div className="flex justify-between text-command-subtext">
                    <span className="text-command-muted">Speed &amp; Heading:</span>
                    <span className="text-slate-200">{amb.speed_kmh} km/h @ {Math.round(amb.heading || 0)}&deg;</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-command-border/50 flex items-center justify-between">
                  <span className="text-[11px] text-command-subtext font-medium">Controller Assignment:</span>
                  <span className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border ${
                    isGranted ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' :
                    isQueued ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-command-panel text-command-muted border-command-border'
                  }`}>
                    {isGranted ? 'ACTIVE PRIORITY GREEN' : isQueued ? 'QUEUED (STANDBY)' : 'TRANSIT'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-2 py-8 px-4 text-center text-command-muted text-xs bg-command-surface/50 rounded-xl border border-command-border">
            Activate the &quot;Multi-Ambulance Priority Contention&quot; scenario above to observe real-time algorithmic conflict arbitration between converging emergency vehicles.
          </div>
        )}
      </div>

      {/* Safety Protocol Explanation Box */}
      <div className="p-3.5 bg-command-surface border border-command-border rounded-lg text-xs space-y-1.5">
        <div className="flex items-center space-x-2 text-sky-400 font-bold">
          <ShieldAlert className="w-4 h-4 text-sky-400" />
          <span>Non-Preemptive Safety &amp; Clearance Protocol</span>
        </div>
        <p className="text-[11px] text-command-subtext leading-relaxed">
          RouteX never cuts short an active priority green unsafely. When a higher-priority vehicle approaches an already-granted intersection, the system buffers the incoming request, allows the current transit to clear, executes a mandatory <strong className="text-slate-200">2.0-second All-Red Clearance Interval</strong>, and only then switches priority direction.
        </p>
      </div>
    </div>
  );
}
