import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Cpu,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  FileText,
  Key,
  Shield,
  Hash
} from 'lucide-react';
import { opsService } from '../services/api';

export default function AnalyticsReports({ analytics }) {
  const [auditEntries, setAuditEntries] = useState([]);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchLedger = async () => {
    try {
      setLoadingLedger(true);
      const data = await opsService.getAuditLedger();
      setAuditEntries(data || []);
    } catch (err) {
      console.error("Failed to load audit ledger", err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleVerifyLedger = async () => {
    try {
      setVerifying(true);
      const result = await opsService.verifyAuditLedger();
      setVerificationResult(result);
    } catch (err) {
      alert(`Verification check error: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  const handleExportJson = async () => {
    try {
      const data = await opsService.exportReport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `routex-operations-report-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleExportCsv = () => {
    window.open(opsService.exportAnalyticsCsvUrl(), '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Export Actions */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono tracking-widest uppercase text-command-muted">Compliance & Forensics</span>
            <span className="inline-block w-1 h-1 rounded-full bg-sky-400"></span>
            <span className="text-[10px] font-mono text-sky-400 font-semibold">Chained SHA-256 Ledger</span>
          </div>
          <h2 className="text-base font-bold text-slate-100">Operational Analytics & Evidence Records</h2>
          <p className="text-xs text-command-subtext">
            Performance metrics, structured incident evidence CSV export, and cryptographic audit proofs
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs flex items-center space-x-1.5 shadow-sm transition"
            title="Export CSV data for analysis and post-incident investigation"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Incident CSV</span>
          </button>

          <button 
            onClick={handleExportJson}
            className="px-3.5 py-2 bg-command-surface hover:bg-command-border border border-command-border text-slate-200 hover:text-sky-400 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export Diagnostics JSON</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Throughput */}
        <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-command-border/60">
            <span className="text-xs font-bold text-slate-200">Request Throughput</span>
            <span className="text-[10px] font-mono text-command-muted uppercase">Lifecycle Stats</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Total Emergency Requests</span>
              <span className="font-mono font-bold text-slate-100">{analytics?.total_requests ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Successfully Completed</span>
              </span>
              <span className="font-mono font-bold text-emerald-400">{analytics?.completed_requests ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                <span>Expired / Timed Out</span>
              </span>
              <span className="font-mono font-bold text-rose-400">{(analytics?.expired_requests ?? 0) + (analytics?.failed_requests ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>Cancelled by Operator</span>
              </span>
              <span className="font-mono font-bold text-amber-400">{analytics?.cancelled_requests ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Latencies */}
        <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-command-border/60">
            <span className="text-xs font-bold text-slate-200">Transit Duration & Latencies</span>
            <span className="text-[10px] font-mono text-command-muted uppercase">Safety Envelopes</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Average Acknowledgment</span>
              <span className="font-mono font-bold text-sky-400">{analytics?.avg_ack_duration_seconds ?? 0}s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Average Priority Hold</span>
              <span className="font-mono font-bold text-sky-400">{analytics?.avg_priority_duration_seconds ?? 0}s</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Heartbeat Timeout Threshold</span>
              <span className="font-mono font-bold text-slate-200">45s (Watchdog)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Mandatory Clearance (All-Red)</span>
              <span className="font-mono font-bold text-amber-400">2.0s</span>
            </div>
          </div>
        </div>

        {/* Hardware & Infrastructure */}
        <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-command-border/60">
            <span className="text-xs font-bold text-slate-200">Hardware & Infrastructure</span>
            <span className="text-[10px] font-mono text-command-muted uppercase">Physical Fleet</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Online Traffic Junctions</span>
              <span className="font-mono font-bold text-emerald-400">{analytics?.online_junctions_count ?? 0} / {analytics?.total_junctions_count ?? 5}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Hardware-Verified LoRa Packets</span>
              <span className="font-mono font-bold text-sky-400">{analytics?.hardware_verified_requests_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Simulated Test Transits</span>
              <span className="font-mono font-bold text-slate-300">{analytics?.simulated_requests_count ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-command-subtext">Test-Zone Advisories Issued</span>
              <span className="font-mono font-bold text-slate-300">{analytics?.total_alerts_issued ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cryptographic Audit Ledger & Chain Integrity Card */}
      <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-command-border">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Cryptographic Audit Ledger (SHA-256 Chained)</h3>
              <p className="text-[11px] text-command-subtext">Immutable log of preemption decisions, state switches, and operator commands</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button 
              onClick={handleVerifyLedger}
              disabled={verifying}
              className="px-3.5 py-1.5 bg-command-surface hover:bg-command-border border border-command-border text-slate-200 hover:text-sky-400 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-sky-400' : 'text-sky-400'}`} />
              <span>{verifying ? 'Verifying Proofs...' : 'Verify Ledger Integrity'}</span>
            </button>
            <button 
              onClick={fetchLedger}
              disabled={loadingLedger}
              className="p-1.5 bg-command-surface hover:bg-command-border border border-command-border text-slate-300 hover:text-sky-400 rounded-lg transition disabled:opacity-50"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? 'animate-spin text-sky-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Verification Result Banner */}
        {verificationResult && (
          <div className={`p-3.5 rounded-lg border text-xs flex items-center space-x-3 transition-all ${
            verificationResult.is_ledger_intact 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {verificationResult.is_ledger_intact 
              ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" /> 
              : <XCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />}
            <div>
              <span className="font-bold text-slate-100 block">
                {verificationResult.is_ledger_intact ? 'Tamper-Evident Verification: PASSED (Cryptographically Valid)' : 'Tamper-Evident Verification: INTEGRITY MISMATCH'}
              </span>
              <p className="opacity-90 text-[11px] mt-0.5">{verificationResult.message}</p>
            </div>
          </div>
        )}

        {/* Entries Table */}
        <div className="overflow-x-auto rounded-lg border border-command-border/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-command-surface text-command-muted border-b border-command-border font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Seq #</th>
                <th className="py-2.5 px-3 font-semibold">Timestamp (UTC)</th>
                <th className="py-2.5 px-3 font-semibold">Event Type</th>
                <th className="py-2.5 px-3 font-semibold">Actor</th>
                <th className="py-2.5 px-3 font-semibold">Entity ID</th>
                <th className="py-2.5 px-3 font-semibold">SHA-256 Hash Chain Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-border/40 font-mono text-[11px]">
              {auditEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-command-muted">
                    No cryptographic ledger entries recorded yet.
                  </td>
                </tr>
              ) : (
                auditEntries.slice(0, 15).map((entry) => (
                  <tr key={entry.id} className="hover:bg-command-surface/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-sky-400">#{entry.sequence_number}</td>
                    <td className="py-2.5 px-3 text-slate-300">{new Date(entry.timestamp).toISOString().replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-100">{entry.event_type}</td>
                    <td className="py-2.5 px-3 text-command-subtext">{entry.actor}</td>
                    <td className="py-2.5 px-3 text-command-subtext">{entry.entity_id ? `${entry.entity_id.slice(0, 12)}...` : 'N/A'}</td>
                    <td className="py-2.5 px-3 text-[11px] text-sky-400 font-mono">
                      <span className="text-command-muted">{entry.previous_hash ? `${entry.previous_hash.slice(0, 8)}...` : 'GENESIS'}</span>
                      <span className="text-command-border mx-1">&rarr;</span>
                      <span className="font-bold text-sky-300">{entry.entry_hash ? `${entry.entry_hash.slice(0, 10)}...` : 'N/A'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
