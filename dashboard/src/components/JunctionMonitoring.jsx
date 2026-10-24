import React from 'react';
import { 
  MapPin, 
  Wifi, 
  WifiOff, 
  Activity, 
  ShieldAlert, 
  Clock, 
  Radio, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Cpu
} from 'lucide-react';

export default function JunctionMonitoring({ junctions = [], onRefresh }) {
  const onlineCount = junctions.filter(j => j.is_online).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-command-panel border border-command-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-command-subtle">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold text-command-text tracking-tight">Municipal Junction Fleet Telemetry</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
              {onlineCount} OF {junctions.length} OPERATIONAL
            </span>
          </div>
          <p className="text-xs text-command-subtext">
            NodeMCU ESP8266 Local Gateways • LoRa SX1278 433MHz Transceivers • Optical Signal Relays
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono text-command-muted">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>HEARTBEAT: 30s WATCHDOG</span>
          </span>
        </div>
      </div>

      {junctions.length === 0 ? (
        <div className="bg-command-panel border border-command-border rounded-xl p-12 text-center text-command-subtext text-xs space-y-2 shadow-command-subtle">
          <MapPin className="w-8 h-8 text-command-muted mx-auto" />
          <p className="font-semibold text-command-text text-sm">No Junction Controllers Online</p>
          <p>Waiting for NodeMCU / LoRa gateway telemetry heartbeat beacon...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {junctions.map((j) => {
            const isPriority = j.current_signal_state === 'PRIORITY_ACTIVE';
            const isFailsafe = j.current_signal_state === 'FAILSAFE_ALL_RED';

            const cardBorder = isPriority 
              ? 'border-command-red/50 bg-command-panel shadow-command-glow-red' 
              : isFailsafe 
              ? 'border-amber-500/40 bg-command-panel' 
              : 'border-command-border bg-command-panel hover:border-sky-500/30';

            return (
              <div 
                key={j.id} 
                className={`border rounded-xl p-5 transition space-y-4 shadow-command-subtle ${cardBorder}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-lg shrink-0 ${j.is_online ? 'bg-emerald-500/10 text-emerald-400' : 'bg-command-red/10 text-command-red'}`}>
                      {j.is_online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-command-text tracking-tight">{j.name}</h3>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-xs font-mono text-sky-400 font-bold">{j.id}</span>
                        <span className="text-[10px] text-command-muted font-mono">({j.code})</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${
                    j.is_online 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-command-red/10 text-command-red border-command-red/30'
                  }`}>
                    {j.is_online ? 'CONNECTED' : 'OFFLINE'}
                  </span>
                </div>

                {/* Grid Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-command-surface p-3 rounded-lg border border-command-border/50 font-mono">
                  <div>
                    <span className="text-command-muted block text-[10px] uppercase">Zone Sector</span>
                    <span className="font-semibold text-command-text">{j.zone}</span>
                  </div>
                  <div>
                    <span className="text-command-muted block text-[10px] uppercase">Signal Cycle</span>
                    <span className={`font-bold flex items-center space-x-1 ${
                      isPriority ? 'text-command-red animate-pulse' :
                      isFailsafe ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isPriority ? 'bg-command-red' : isFailsafe ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                      <span>{j.current_signal_state}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-command-muted block text-[10px] uppercase">GPS Coordinates</span>
                    <span className="text-command-subtext text-[11px]">{j.latitude.toFixed(4)}, {j.longitude.toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-command-muted block text-[10px] uppercase">Preempted Lane</span>
                    <span className="text-sky-400 font-bold">{j.active_direction || 'STANDBY'}</span>
                  </div>
                </div>

                {/* Footer Hardware Status */}
                <div className="flex items-center justify-between text-xs text-command-muted pt-2 border-t border-command-border/40 font-mono">
                  <span className="flex items-center space-x-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-command-muted" />
                    <span>Ping: {j.last_heartbeat ? new Date(j.last_heartbeat).toLocaleTimeString() : 'Active'}</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    RF 433MHz RX
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
