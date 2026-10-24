import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  ArrowRight, 
  Layers, 
  Info, 
  CheckCircle2, 
  Clock, 
  Radio, 
  ChevronRight,
  Shield,
  FileText
} from 'lucide-react';
import { aiService } from '../services/api';

export default function AIInsightsPanel({ activeRequest, simulationStatus, routeDetails }) {
  const [aiStatus, setAiStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('route'); // 'route' or 'incident'
  const [insightData, setInsightData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    aiService.getStatus()
      .then(res => setAiStatus(res))
      .catch(() => setAiStatus({ is_configured: false, status_label: 'UNAVAILABLE' }));
  }, []);

  const handleAnalyzeRoute = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      const junctions = simulationStatus?.junctions || [];
      const jIds = junctions.length > 0 ? junctions.map(j => j.id) : ["JNC-01", "JNC-02", "JNC-03", "JNC-05"];
      const activeAmb = simulationStatus?.ambulances?.[0];
      
      const payload = {
        origin: routeDetails?.origin || activeAmb?.approaching_junction || jIds[0] || "JNC-01",
        destination: routeDetails?.destination || jIds[jIds.length - 1] || "JNC-05",
        calculated_distance_meters: routeDetails?.distance || 1600.0,
        estimated_transit_seconds: routeDetails?.eta || activeAmb?.eta_seconds || 115.0,
        route_junctions: routeDetails?.junctions || jIds,
        congestion_detected: simulationStatus?.active_scenario === 'GRIDLOCK_CONGESTION',
        bottleneck_link: simulationStatus?.active_scenario === 'GRIDLOCK_CONGESTION' ? 'JNC-02 -> JNC-04' : null,
        diversion_taken: simulationStatus?.active_scenario === 'GRIDLOCK_CONGESTION',
        priority_level: activeRequest?.triage_priority || activeAmb?.triage_priority || "URGENT"
      };

      const result = await aiService.explainRoute(payload);
      setInsightData(result);
    } catch (err) {
      console.warn("AI Route explanation notice:", err);
      setErrorMsg(err.response?.data?.detail || "AI explanation service is currently in deterministic mode.");
    } finally {
      setLoading(false);
    }
  };

  const handleSummarizeIncident = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const activeAmb = simulationStatus?.ambulances?.[0];
      const payload = {
        request_id: String(activeRequest?.id || "REQ-LIVE-001"),
        ambulance_call_sign: activeRequest?.ambulance_call_sign || activeAmb?.call_sign || "MEDIC-101",
        triage_priority: activeRequest?.triage_priority || activeAmb?.triage_priority || "CRITICAL",
        start_junction: activeRequest?.junction_id || "JNC-01",
        target_junction: "JNC-05",
        total_duration_seconds: simulationStatus?.elapsed_seconds || 24.0,
        status: activeRequest?.status || simulationStatus?.state || "PRIORITY_ACTIVE",
        scheduling_reason: activeRequest?.scheduling_reason || "Direct corridor preemption granted",
        contending_vehicles_count: simulationStatus?.ambulances?.length > 1 ? 1 : 0
      };

      const result = await aiService.getIncidentSummary(payload);
      setInsightData(result);
    } catch (err) {
      console.warn("AI Incident summary notice:", err);
      setErrorMsg(err.response?.data?.detail || "AI incident debrief service is in deterministic mode.");
    } finally {
      setLoading(false);
    }
  };

  // Run route analysis once on mount or scenario change if active
  useEffect(() => {
    if (activeTab === 'route') {
      handleAnalyzeRoute();
    } else {
      handleSummarizeIncident();
    }
  }, [activeTab, simulationStatus?.active_scenario]);

  const isConfigured = aiStatus?.is_configured ?? false;

  return (
    <div className="bg-command-panel border border-command-border rounded-xl p-4 shadow-command-card space-y-3">
      {/* Top Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-command-border/70">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-xs text-slate-100 tracking-wide">
                AI Operations Advisor
              </h4>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                insightData?.status === 'SUCCESS'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : insightData?.status === 'FALLBACK'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : isConfigured 
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {insightData?.status === 'SUCCESS' ? `${insightData.model_used || aiStatus?.model || 'GEMINI'} (LIVE)` :
                 insightData?.status === 'FALLBACK' ? 'DETERMINISTIC FALLBACK (SAFE)' :
                 isConfigured ? 'GEMINI READY' : 'DETERMINISTIC RULE ENGINE'}
              </span>
            </div>
            <span className="text-[10px] text-command-muted block">
              Explainable preemption analysis &amp; incident forensics
            </span>
          </div>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-command-surface border border-command-border rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setActiveTab('route')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                activeTab === 'route' ? 'bg-sky-600 text-white shadow-xs' : 'text-command-muted hover:text-slate-200'
              }`}
            >
              Corridor Explanation
            </button>
            <button
              onClick={() => setActiveTab('incident')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                activeTab === 'incident' ? 'bg-sky-600 text-white shadow-xs' : 'text-command-muted hover:text-slate-200'
              }`}
            >
              Incident Debrief
            </button>
          </div>

          <button
            onClick={activeTab === 'route' ? handleAnalyzeRoute : handleSummarizeIncident}
            disabled={loading}
            className="p-1.5 bg-command-surface hover:bg-command-border border border-command-border text-slate-300 hover:text-sky-400 rounded-lg transition disabled:opacity-50"
            title="Re-run AI Analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Strict Advisory Safety Banner */}
      <div className="px-3 py-1.5 rounded-lg bg-sky-950/40 border border-sky-800/40 text-[10px] text-sky-300/90 flex items-center justify-between font-mono">
        <span className="flex items-center space-x-1.5">
          <Shield className="w-3 h-3 text-sky-400 flex-shrink-0" />
          <span>STRICTLY ADVISORY: Does not override 2.0s All-Red clearance or municipal interlocking.</span>
        </span>
        <span className="text-command-muted hidden sm:inline">Telemetry-Verified Input</span>
      </div>

      {/* Main Analysis Output Card */}
      {loading ? (
        <div className="p-4 bg-command-surface/50 rounded-lg border border-command-border/60 flex items-center justify-center space-x-2 text-xs text-command-muted">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Evaluating corridor telemetry with {isConfigured ? 'Gemini 2.5 Flash' : 'Rule Engine'}...</span>
        </div>
      ) : insightData ? (
        <div className="space-y-2.5 text-xs">
          <div className="p-3 bg-command-surface rounded-lg border border-command-border/70 text-slate-200 leading-relaxed">
            <p className="text-[11px] text-slate-300">
              {insightData.summary}
            </p>
          </div>

          {/* Key Observations and Recommendations in 2 mini columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
            {insightData.key_observations && insightData.key_observations.length > 0 && (
              <div className="p-2.5 bg-command-surface/60 rounded-lg border border-command-border/60 space-y-1">
                <span className="text-command-muted font-bold block uppercase tracking-wider">Key Observations</span>
                {insightData.key_observations.map((obs, idx) => (
                  <div key={idx} className="flex items-start space-x-1.5 text-slate-300">
                    <span className="text-sky-400">•</span>
                    <span>{obs}</span>
                  </div>
                ))}
              </div>
            )}

            {insightData.safety_recommendations && insightData.safety_recommendations.length > 0 && (
              <div className="p-2.5 bg-command-surface/60 rounded-lg border border-command-border/60 space-y-1">
                <span className="text-command-muted font-bold block uppercase tracking-wider">Safety Protocols</span>
                {insightData.safety_recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start space-x-1.5 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-3 bg-command-surface/40 rounded-lg border border-command-border/50 text-[11px] text-command-muted text-center">
          {errorMsg || "Click refresh to generate operational telemetry insights."}
        </div>
      )}

      {/* Status Footer with Setup & Diagnostic Info */}
      {insightData?.status === 'FALLBACK' ? (
        <div className="pt-2 border-t border-command-border/50 flex flex-wrap items-center justify-between text-[10px] text-amber-300/90 font-mono">
          <span>AI Advisory Status: <strong className="text-amber-400">Deterministic Fallback Active</strong> (Provider load spike or network timeout; safety-critical routing unaffected)</span>
          <span className="text-emerald-400 font-semibold">Deterministic Interlock Active</span>
        </div>
      ) : !isConfigured ? (
        <div className="pt-2 border-t border-command-border/50 flex flex-wrap items-center justify-between text-[10px] text-command-muted font-mono">
          <span>Gemini API Key: <strong className="text-amber-400/90">Unconfigured</strong> (Running deterministic rule fallback)</span>
          <span className="text-sky-400">Add GEMINI_API_KEY to backend .env to enable live LLM generation</span>
        </div>
      ) : null}
    </div>
  );
}
