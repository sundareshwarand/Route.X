import React from 'react';
import { 
  Clock, 
  ShieldAlert, 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  WifiOff, 
  Layers, 
  ArrowRight,
  Flame,
  Activity
} from 'lucide-react';

export default function IncidentTimeline({ timeline = [] }) {
  const getEventMeta = (type) => {
    switch (type) {
      case 'PRIORITY_GREEN':
        return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
      case 'ALL_RED_CLEARANCE':
        return { icon: ShieldAlert, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
      case 'CONFLICT_DETECTED':
        return { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
      case 'COMM_LOSS_WARNING':
        return { icon: WifiOff, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
      case 'COMM_RESTORED':
        return { icon: Radio, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' };
      case 'REROUTE_COMPLETED':
        return { icon: Layers, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' };
      case 'DISPATCH':
        return { icon: Flame, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
      case 'ARRIVAL':
        return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
      default:
        return { icon: Activity, color: 'text-command-muted', bg: 'bg-command-surface', border: 'border-command-border' };
    }
  };

  return (
    <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-command-border mb-3">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-sky-400" />
          <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider">
            Live Incident Timeline &amp; State Transitions
          </h3>
        </div>
        <span className="text-[10px] font-mono text-command-muted bg-command-surface px-2 py-0.5 rounded border border-command-border/60">
          {timeline.length} Events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px] custom-scrollbar">
        {timeline.length === 0 ? (
          <div className="py-12 text-center text-command-muted text-xs">
            No incident events recorded yet. Start a scenario to observe real-time state machine transitions.
          </div>
        ) : (
          timeline.map((evt) => {
            const meta = getEventMeta(evt.type);
            const Icon = meta.icon;

            return (
              <div 
                key={evt.id}
                className="p-3 bg-command-surface border border-command-border/70 rounded-lg flex items-start space-x-3 text-xs hover:border-command-border transition-all"
              >
                <div className={`p-1.5 rounded-md ${meta.bg} ${meta.color} ${meta.border} border shrink-0 mt-0.5`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[11px] text-slate-200 truncate">
                      {evt.type.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-command-panel text-sky-400 font-mono text-[9px] font-semibold border border-command-border">
                        T+{evt.sim_time}s
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[9px] font-semibold border border-amber-500/30">
                        {evt.source}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-command-subtext mt-1 leading-snug">
                    {evt.description}
                  </p>

                  {(evt.junction_id || evt.ambulance_id) && (
                    <div className="mt-1.5 flex items-center space-x-2 text-[10px] font-mono text-sky-400">
                      {evt.ambulance_id && <span className="bg-command-panel px-1.5 py-0.5 rounded border border-command-border">Amb: {evt.ambulance_id}</span>}
                      {evt.junction_id && <span className="bg-command-panel px-1.5 py-0.5 rounded border border-command-border">Jnc: {evt.junction_id}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-3 border-t border-command-border mt-3 flex items-center justify-between text-[10px] text-command-muted font-mono">
        <span>Deterministic Finite State Machine</span>
        <span className="text-sky-400">Chained Hash Linked</span>
      </div>
    </div>
  );
}
