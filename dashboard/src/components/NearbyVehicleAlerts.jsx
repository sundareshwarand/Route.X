import React, { useState } from 'react';
import { 
  Bell, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Radio, 
  Info,
  Clock,
  ShieldCheck,
  Megaphone
} from 'lucide-react';
import { opsService } from '../services/api';

export default function NearbyVehicleAlerts({ alerts = [], junctions = [], onRefresh }) {
  const [selectedJunction, setSelectedJunction] = useState('JNC-01');
  const [selectedZone, setSelectedZone] = useState('ZONE-CENTRAL');
  const [selectedDirection, setSelectedDirection] = useState('STRAIGHT');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const handleBroadcast = async () => {
    try {
      setBroadcasting(true);
      await opsService.broadcastTestAlert(selectedJunction, selectedZone, selectedDirection);
      setBroadcastSuccess(true);
      setTimeout(() => setBroadcastSuccess(false), 4000);
      onRefresh();
    } catch (err) {
      alert(`Broadcast failed: ${err.response?.data?.detail || err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Protocol Notice Banner */}
      <div className="bg-command-panel border border-amber-500/30 rounded-xl p-4 flex items-start space-x-3 text-xs shadow-command-subtle">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
        <div className="space-y-0.5">
          <h4 className="font-bold text-sm text-command-text tracking-tight">Phase A: Advisory Test-Zone Alert Broadcast System</h4>
          <p className="text-command-subtext leading-relaxed">
            All notifications dispatched below are simulated, zone-targeted advisory alerts intended for road user awareness testing. 
            They are non-coercive advisories instructing drivers to give way safely.
          </p>
        </div>
      </div>

      {/* Manual Test Dispatch Card */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 space-y-4 shadow-command-subtle">
        <h3 className="font-bold text-sm text-command-text flex items-center space-x-2 tracking-tight">
          <Send className="w-4 h-4 text-sky-400" />
          <span>Dispatch Zone Test Advisory</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-mono text-command-muted uppercase mb-1">Target Junction</label>
            <select 
              value={selectedJunction}
              onChange={(e) => setSelectedJunction(e.target.value)}
              className="w-full bg-command-surface border border-command-border rounded-lg p-2.5 text-xs font-mono text-command-text focus:outline-none focus:border-sky-500 transition"
            >
              {junctions.map(j => (
                <option key={j.id} value={j.id}>{j.id} - {j.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-command-muted uppercase mb-1">Target Test Zone</label>
            <select 
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full bg-command-surface border border-command-border rounded-lg p-2.5 text-xs font-mono text-command-text focus:outline-none focus:border-sky-500 transition"
            >
              <option value="ZONE-CENTRAL">ZONE-CENTRAL</option>
              <option value="ZONE-HOSPITAL">ZONE-HOSPITAL</option>
              <option value="ZONE-NORTH">ZONE-NORTH</option>
              <option value="ZONE-TECH">ZONE-TECH</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-command-muted uppercase mb-1">Approaching Direction</label>
            <select 
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value)}
              className="w-full bg-command-surface border border-command-border rounded-lg p-2.5 text-xs font-mono text-command-text focus:outline-none focus:border-sky-500 transition"
            >
              <option value="STRAIGHT">STRAIGHT (Main Arterial)</option>
              <option value="LEFT">LEFT (Cross Avenue)</option>
              <option value="RIGHT">RIGHT (Exit Ramp)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-3 border-t border-command-border/50">
          <span className="text-xs text-command-muted font-mono">
            Simulates instant alert push to registered mobile clients in {selectedZone}.
          </span>
          <button 
            disabled={broadcasting}
            onClick={handleBroadcast}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs font-mono tracking-wide flex items-center space-x-1.5 transition shadow-command-glow-cyan disabled:opacity-50 shrink-0 self-end sm:self-auto"
          >
            <Send className={`w-3.5 h-3.5 ${broadcasting ? 'animate-spin' : ''}`} />
            <span>{broadcasting ? 'BROADCASTING...' : 'TRANSMIT TEST ADVISORY'}</span>
          </button>
        </div>

        {broadcastSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center space-x-2 font-mono">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Advisory broadcast packet successfully recorded and delivered to subscribers!</span>
          </div>
        )}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-command-text flex items-center space-x-2 tracking-tight">
            <Bell className="w-4 h-4 text-sky-400" />
            <span>Recent Advisory Alerts Feed ({alerts.length})</span>
          </h3>
          <span className="text-xs font-mono text-command-muted">Zone WebSocket Delivery</span>
        </div>

        {alerts.length === 0 ? (
          <div className="bg-command-panel border border-command-border rounded-xl p-8 text-center text-xs text-command-subtext font-mono shadow-command-subtle">
            No advisory alerts recorded. Broadcast a test advisory above to populate this feed.
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className="bg-command-panel border border-command-border rounded-xl p-4 flex flex-col sm:flex-row items-start justify-between gap-3 shadow-command-subtle hover:border-sky-500/20 transition">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5 shrink-0">
                  <Radio className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-command-text">{alert.zone}</span>
                    <span className="text-xs text-command-muted font-mono">via {alert.junction_id}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono font-bold border border-amber-500/20">
                      TEST SIMULATION
                    </span>
                  </div>
                  <p className="text-xs text-command-text font-medium leading-relaxed">{alert.message}</p>
                  <p className="text-[11px] text-command-muted font-mono flex items-center space-x-2 pt-0.5">
                    <span>Approach: <span className="text-command-subtext">{alert.approach_direction}</span></span>
                    <span>•</span>
                    <span>Dispatched: <span className="text-command-subtext">{new Date(alert.created_at).toLocaleTimeString()}</span></span>
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs shrink-0 font-mono">
                <span className="text-command-muted block text-[10px] uppercase">Expires At</span>
                <span className="text-command-text font-bold">{new Date(alert.expires_at).toLocaleTimeString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
