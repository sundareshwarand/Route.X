import React, { useState } from 'react';
import { 
  Radio, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  AlertTriangle, 
  Filter,
  Check,
  Ban,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { opsService } from '../services/api';

export default function ActiveRequests({ requests = [], onRefresh }) {
  const [filterJunction, setFilterJunction] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('Operator command override');
  const [actionLoading, setActionLoading] = useState(false);

  const filteredRequests = requests.filter(r => {
    if (filterJunction !== 'ALL' && r.junction_id !== filterJunction) return false;
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    return true;
  });

  const handleCancel = async (id) => {
    try {
      setActionLoading(true);
      await opsService.cancelRequest(id, cancelReason);
      setCancellingId(null);
      onRefresh();
    } catch (err) {
      alert(`Error cancelling request: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <div className="bg-command-panel border border-command-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-command-subtle">
        <div className="flex items-center space-x-2 text-command-text text-sm font-semibold">
          <Filter className="w-4 h-4 text-sky-400" />
          <span>Priority Request Queue ({filteredRequests.length})</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={filterJunction}
            onChange={(e) => setFilterJunction(e.target.value)}
            className="bg-command-surface border border-command-border text-command-text rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 transition"
          >
            <option value="ALL">All Municipal Junctions</option>
            <option value="JNC-01">JNC-01 (Central Avenue)</option>
            <option value="JNC-02">JNC-02 (Hospital Way)</option>
            <option value="JNC-03">JNC-03 (Ring Road Flyover)</option>
            <option value="JNC-04">JNC-04 (Tech Park Blvd)</option>
            <option value="JNC-05">JNC-05 (Trauma Corridor)</option>
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-command-surface border border-command-border text-command-text rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 transition"
          >
            <option value="ALL">All Operational Statuses</option>
            <option value="PRIORITY_ACTIVE">Priority Active</option>
            <option value="RECEIVED">Received / Gateway ACK</option>
            <option value="PENDING">Pending Scheduling</option>
            <option value="COMPLETED">Completed Transit</option>
            <option value="CANCELLED">Operator Cancelled</option>
            <option value="EXPIRED">Timeout Expired</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-command-panel border border-command-border rounded-xl p-12 text-center text-command-subtext text-xs space-y-2 shadow-command-subtle">
            <Radio className="w-8 h-8 text-command-muted mx-auto" />
            <p className="font-semibold text-command-text text-sm">No Emergency Preemption Requests</p>
            <p>Queue is idle. Inbound ambulance requests from mobile app or LoRa beacon will appear here.</p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isPriority = req.status === 'PRIORITY_ACTIVE';
            const isReceived = req.status === 'RECEIVED';
            const isDone = req.status === 'COMPLETED';

            const cardBorder = isPriority 
              ? 'border-command-red/50 bg-command-panel shadow-command-glow-red' 
              : isReceived 
              ? 'border-amber-500/40 bg-command-panel' 
              : 'border-command-border bg-command-panel';

            return (
              <div 
                key={req.id} 
                className={`border rounded-xl p-5 transition shadow-command-subtle ${cardBorder}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-command-border/60">
                  <div className="flex items-start sm:items-center space-x-3.5">
                    <div className={`p-2.5 rounded-lg shrink-0 ${
                      isPriority ? 'bg-command-red/15 text-command-red animate-pulse' :
                      isReceived ? 'bg-amber-500/15 text-amber-400' :
                      isDone ? 'bg-emerald-500/15 text-emerald-400' :
                      'bg-command-surface text-command-muted'
                    }`}>
                      <Radio className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-command-text tracking-wide">{req.ambulance_id}</span>
                        <span className="text-xs text-command-muted font-mono">&rarr;</span>
                        <span className="font-mono text-xs text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                          {req.junction_id}
                        </span>

                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                          req.triage_priority === 'CRITICAL' ? 'bg-command-red/20 text-command-red border border-command-red/40 animate-pulse' :
                          req.triage_priority === 'URGENT' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        }`}>
                          {req.triage_priority || 'STANDARD'}
                        </span>

                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          req.is_verified_hardware ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {req.is_verified_hardware ? 'HW VERIFIED' : 'SIMULATED'}
                        </span>
                      </div>

                      <p className="text-[11px] text-command-muted font-mono">
                        UUID: <span className="text-command-subtext">{req.id.slice(0, 18)}...</span> • Origin: <span className="text-command-text">{req.source}</span>
                      </p>

                      {req.scheduling_reason && (
                        <div className="text-[11px] font-mono text-sky-300 bg-command-surface px-2.5 py-1 rounded border border-command-border/50">
                          <span className="text-command-muted uppercase text-[9px] block">Dispatcher Note</span>
                          {req.scheduling_reason}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 self-end md:self-center">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-command-muted block">Selected Approach</span>
                      <span className="font-mono font-bold text-sm text-sky-400">{req.direction}</span>
                    </div>

                    {['PENDING', 'RECEIVED', 'PRIORITY_ACTIVE'].includes(req.status) && (
                      <button 
                        onClick={() => setCancellingId(req.id)}
                        className="px-3 py-1.5 bg-command-red/10 border border-command-red/30 hover:bg-command-red/20 text-command-red rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition font-mono"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>OVERRIDE</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Progression Stepper */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                  {/* 1. Requested */}
                  <div className={`p-2 rounded-lg border ${
                    req.status !== 'FAILED' ? 'border-sky-500/30 bg-command-surface text-command-text' : 'border-command-border text-command-muted'
                  }`}>
                    <span className="block text-[9px] text-command-muted">PHASE 1</span>
                    <span className="font-semibold text-xs">PENDING</span>
                  </div>

                  {/* 2. Received / Gateway ACK */}
                  <div className={`p-2 rounded-lg border ${
                    ['RECEIVED', 'PRIORITY_ACTIVE', 'COMPLETED'].includes(req.status) 
                      ? 'border-amber-500/40 bg-command-surface text-amber-400 font-semibold' 
                      : 'border-command-border text-command-muted'
                  }`}>
                    <span className="block text-[9px] text-command-muted">PHASE 2</span>
                    <span className="font-semibold text-xs">ACKNOWLEDGED</span>
                  </div>

                  {/* 3. Priority Active */}
                  <div className={`p-2 rounded-lg border ${
                    ['PRIORITY_ACTIVE', 'COMPLETED'].includes(req.status) 
                      ? 'border-command-red/40 bg-command-surface text-command-red font-bold' 
                      : 'border-command-border text-command-muted'
                  }`}>
                    <span className="block text-[9px] text-command-muted">PHASE 3</span>
                    <span className="font-bold text-xs">PREEMPTION ACTIVE</span>
                  </div>

                  {/* 4. Terminal State */}
                  <div className={`p-2 rounded-lg border ${
                    req.status === 'COMPLETED' ? 'border-emerald-500/40 bg-command-surface text-emerald-400 font-semibold' :
                    ['CANCELLED', 'EXPIRED', 'FAILED'].includes(req.status) ? 'border-command-red/40 bg-command-surface text-command-red' :
                    'border-command-border text-command-muted'
                  }`}>
                    <span className="block text-[9px] text-command-muted">PHASE 4</span>
                    <span className="font-semibold text-xs">{req.status}</span>
                  </div>
                </div>

                {req.cancellation_reason && (
                  <div className="mt-3 p-2 bg-command-surface border border-amber-500/20 rounded-lg text-xs text-amber-400 font-mono">
                    Cancellation Record: {req.cancellation_reason}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Cancel Override Dialog */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-command-panel border border-command-border rounded-xl p-5 max-w-md w-full space-y-4 shadow-command-card">
            <h4 className="font-bold text-command-text text-sm flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Confirm Priority Override & Safe Reversion</span>
            </h4>
            <p className="text-xs text-command-subtext leading-relaxed">
              Manual cancellation will immediately terminate the green priority signal and initiate a safe all-red clearance phase before returning the junction to normal cycle.
            </p>
            <div>
              <label className="block text-[10px] font-mono uppercase text-command-muted mb-1">Audit Justification</label>
              <input 
                type="text" 
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for manual override..."
                className="w-full bg-command-surface border border-command-border rounded-lg p-2.5 text-xs text-command-text focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button 
                onClick={() => setCancellingId(null)}
                className="px-3 py-1.5 bg-command-surface hover:bg-command-border text-command-subtext rounded-lg text-xs font-mono"
              >
                ABORT
              </button>
              <button 
                disabled={actionLoading}
                onClick={() => handleCancel(cancellingId)}
                className="px-4 py-1.5 bg-command-red hover:bg-rose-600 text-white font-bold rounded-lg text-xs transition font-mono disabled:opacity-50"
              >
                {actionLoading ? 'EXECUTING...' : 'CONFIRM OVERRIDE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
