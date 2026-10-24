import React, { useState, useEffect } from 'react';
import { ShieldAlert, Activity, Navigation, Radio, Clock, Compass } from 'lucide-react';

export default function IntersectionVisualizer({ junction, activeRequest }) {
  const [timer, setTimer] = useState(20);

  useEffect(() => {
    let interval = null;
    if (activeRequest && activeRequest.status === 'PRIORITY_ACTIVE') {
      setTimer(activeRequest.duration_seconds || 20);
      interval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [activeRequest]);

  const isPriority = activeRequest && activeRequest.status === 'PRIORITY_ACTIVE';
  const direction = activeRequest ? activeRequest.direction : null;

  return (
    <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-command-border mb-4 gap-3">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-lg border ${
            isPriority 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' 
              : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
          }`}>
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase text-command-muted">Signal Visualizer</span>
              <span className="inline-block w-1 h-1 rounded-full bg-sky-400"></span>
              <span className="text-[10px] font-mono text-sky-400 font-semibold">{junction?.zone || 'ZONE-CENTRAL'}</span>
            </div>
            <h3 className="font-bold text-slate-100 text-sm">
              {junction ? junction.name : 'Central Avenue Intersection'}
            </h3>
            <p className="text-xs text-command-subtext">
              Controller Node: <span className="font-mono text-sky-400 font-semibold">{junction ? junction.id : 'JNC-01'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isPriority ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-rose-500/15 border border-rose-500/30 rounded-full text-rose-300 text-xs font-mono font-bold animate-pulse shadow-sm">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>EMERGENCY PREEMPTION ACTIVE: {timer}s</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>NORMAL ROTATION CYCLE</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive SVG Diagram */}
      <div className="relative w-full h-80 flex items-center justify-center bg-[#0A0E17] rounded-xl overflow-hidden border border-command-border/70">
        <svg viewBox="0 0 400 400" className="w-full h-full max-w-sm">
          {/* North-South road */}
          <rect x="150" y="0" width="100" height="400" fill="#111827" />
          {/* East-West road */}
          <rect x="0" y="150" width="400" height="100" fill="#111827" />

          {/* Road markings - Center Dotted Lines */}
          <line x1="200" y1="0" x2="200" y2="140" stroke="#FBBF24" strokeWidth="2" strokeDasharray="8 6" opacity="0.8" />
          <line x1="200" y1="260" x2="200" y2="400" stroke="#FBBF24" strokeWidth="2" strokeDasharray="8 6" opacity="0.8" />
          <line x1="0" y1="200" x2="140" y2="200" stroke="#FBBF24" strokeWidth="2" strokeDasharray="8 6" opacity="0.8" />
          <line x1="260" y1="200" x2="400" y2="200" stroke="#FBBF24" strokeWidth="2" strokeDasharray="8 6" opacity="0.8" />

          {/* Stop Lines */}
          <line x1="150" y1="140" x2="250" y2="140" stroke="#E2E8F0" strokeWidth="3" opacity="0.9" />
          <line x1="150" y1="260" x2="250" y2="260" stroke="#E2E8F0" strokeWidth="3" opacity="0.9" />
          <line x1="140" y1="150" x2="140" y2="250" stroke="#E2E8F0" strokeWidth="3" opacity="0.9" />
          <line x1="260" y1="150" x2="260" y2="250" stroke="#E2E8F0" strokeWidth="3" opacity="0.9" />

          {/* Intersection Box */}
          <rect x="150" y="150" width="100" height="100" fill="#182234" opacity="0.7" />

          {/* Signal Light Posts */}
          {/* South Signal (approaching from South moving North) */}
          <g transform="translate(255, 265)">
            <rect x="0" y="0" width="16" height="36" rx="3" fill="#0A0E17" stroke="#334155" strokeWidth="1" />
            <circle cx="8" cy="8" r="4" fill={isPriority ? "#334155" : "#F87171"} />
            <circle cx="8" cy="18" r="4" fill="#334155" />
            <circle cx="8" cy="28" r="4" fill={isPriority ? "#34D399" : "#334155"} className={isPriority ? "animate-pulse" : ""} />
          </g>

          {/* North Signal */}
          <g transform="translate(128, 98)">
            <rect x="0" y="0" width="16" height="36" rx="3" fill="#0A0E17" stroke="#334155" strokeWidth="1" />
            <circle cx="8" cy="8" r="4" fill={isPriority ? "#F87171" : "#34D399"} />
            <circle cx="8" cy="18" r="4" fill="#334155" />
            <circle cx="8" cy="28" r="4" fill="#334155" />
          </g>

          {/* East Signal */}
          <g transform="translate(265, 128)">
            <rect x="0" y="0" width="36" height="16" rx="3" fill="#0A0E17" stroke="#334155" strokeWidth="1" />
            <circle cx="8" cy="8" r="4" fill="#F87171" />
            <circle cx="18" cy="8" r="4" fill="#334155" />
            <circle cx="28" cy="8" r="4" fill="#334155" />
          </g>

          {/* West Signal */}
          <g transform="translate(98, 255)">
            <rect x="0" y="0" width="36" height="16" rx="3" fill="#0A0E17" stroke="#334155" strokeWidth="1" />
            <circle cx="8" cy="8" r="4" fill="#F87171" />
            <circle cx="18" cy="8" r="4" fill="#334155" />
            <circle cx="28" cy="8" r="4" fill="#334155" />
          </g>

          {/* Approaching Ambulance Representation */}
          {activeRequest && (
            <g transform="translate(180, 310)">
              {/* Vehicle body */}
              <rect x="0" y="0" width="40" height="26" rx="5" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1.5" />
              {/* White Cross */}
              <rect x="17" y="5" width="6" height="16" fill="#FFFFFF" />
              <rect x="12" y="10" width="16" height="6" fill="#FFFFFF" />
              {/* Emergency Beacon */}
              <circle cx="20" cy="2" r="3" fill="#38BDF8" className="animate-ping" />
            </g>
          )}

          {/* Trajectory Vector Arrow */}
          {isPriority && direction === 'STRAIGHT' && (
            <path d="M 200 300 L 200 130" stroke="#38BDF8" strokeWidth="3" strokeDasharray="6 4" />
          )}
          {isPriority && direction === 'LEFT' && (
            <path d="M 200 300 Q 200 200 130 200" fill="none" stroke="#38BDF8" strokeWidth="3" strokeDasharray="6 4" />
          )}
          {isPriority && direction === 'RIGHT' && (
            <path d="M 200 300 Q 200 200 270 200" fill="none" stroke="#38BDF8" strokeWidth="3" strokeDasharray="6 4" />
          )}
        </svg>

        {/* Floating status card */}
        <div className="absolute bottom-3 left-3 bg-command-panel/90 backdrop-blur-md border border-command-border px-3 py-2 rounded-lg text-xs shadow-md">
          <div className="flex items-center space-x-2">
            <Radio className={`w-3.5 h-3.5 ${activeRequest?.is_verified_hardware ? 'text-sky-400' : 'text-amber-400'}`} />
            <span className="text-command-muted">Telemetry Origin:</span>
            <span className="font-semibold font-mono text-slate-200">
              {activeRequest ? (activeRequest.is_verified_hardware ? 'Verified LoRa HW' : 'Virtual Simulator') : 'Standby'}
            </span>
          </div>
        </div>

        {activeRequest && (
          <div className="absolute top-3 right-3 bg-command-panel/90 backdrop-blur-md border border-command-border px-3 py-2 rounded-lg text-xs shadow-md">
            <span className="text-command-muted">Trajectory Vector:</span>
            <span className="ml-2 px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono font-bold border border-sky-500/30">
              {direction}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
