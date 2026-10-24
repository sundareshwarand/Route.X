import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  SkipForward, 
  Layers, 
  ShieldAlert, 
  WifiOff, 
  GitFork, 
  Activity,
  CheckCircle2,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Info,
  Sparkles
} from 'lucide-react';
import { opsService } from '../services/api';

const SCENARIO_NARRATIVES = {
  STANDARD_CORRIDOR: {
    title: "Scenario 1: Standard Green Corridor Progression",
    problem: "Single ambulance (MEDIC-101) traversing an arterial corridor across multiple consecutive municipal intersections.",
    steps: [
      { num: 1, title: "Dispatch & Corridor Priming", text: "AMB-01 dispatched from JNC-01 towards JNC-05 (City Emergency Trauma Center). Initial ETA calculated at 115s over 1600m." },
      { num: 2, title: "250-Meter Range Preemption", text: "When vehicle crosses 250m threshold approaching JNC-02, a virtual preemption trigger initiates a mandatory 2.0s all-red clearance interval." },
      { num: 3, title: "Priority Green Activation", text: "After clearance verifies conflicting vehicle movements have vacated the intersection, phase transitions to PRIORITY_ACTIVE (green) in direction of travel." },
      { num: 4, title: "Intersection Reversion & Progression", text: "Once the ambulance clears the intersection, the signal reverts safely to normal 4-phase cycle and downstream junction (JNC-03) primes." }
    ],
    safetyNote: "Clearance interval enforces safety: no green signal is granted without verified 2s all-red interval."
  },
  MULTI_AMBULANCE_CONFLICT: {
    title: "Scenario 2: Multi-Ambulance Priority Contention & Urgency Triage",
    problem: "Two emergency vehicles converge on the same intersection (JNC-02) simultaneously from perpendicular directions (West vs North).",
    steps: [
      { num: 1, title: "Simultaneous Approach", text: "AMB-01 (CRITICAL cardiac care) approaches from JNC-01, while AMB-02 (URGENT trauma transfer) approaches from JNC-03." },
      { num: 2, title: "Deterministic Triage Evaluation", text: "Backend coordination scheduler checks urgency weights (CRITICAL: 300, URGENT: 200). AMB-01 is granted active priority." },
      { num: 3, title: "Non-Preemptive Queue Safety", text: "AMB-02 is placed at Queue Position #1 with transparent scheduling reason: 'Awaiting safe clearance sequence (2s all-red) from active vehicle AMB-01'." },
      { num: 4, title: "Sequential Green Handoff", text: "When AMB-01 clears JNC-02, system does NOT flip green instantly; it executes a mandatory 2s all-red phase before giving green to AMB-02." }
    ],
    safetyNote: "Prevents conflicting green states: conflicting directions never receive concurrent priority."
  },
  COMM_LOSS_FAILSAFE: {
    title: "Scenario 3: Gateway Communication Loss & Autonomous Failsafe",
    problem: "Municipal traffic gateway on JNC-03 loses telemetry heartbeat mid-transit due to backhaul link interruption.",
    steps: [
      { num: 1, title: "Corridor Transit in Progress", text: "AMB-01 enters the corridor. Upstream junctions communicate normally via simulated LoRa/MQTT gateway." },
      { num: 2, title: "Heartbeat Failure (T+15s)", text: "JNC-03 gateway telemetry drops. Heartbeat freshness exceeds watchdog threshold (HEARTBEAT_TIMEOUT_SECONDS)." },
      { num: 3, title: "Autonomous Failsafe All-Red", text: "Junction controller autonomously transitions signal to FAILSAFE_ALL_RED. An audit event is logged with severity ALERT." },
      { num: 4, title: "Watchdog Recovery (T+28s)", text: "When heartbeat restores, the watchdog validates signal cycle health and safely resumes normal operation." }
    ],
    safetyNote: "Failsafe default prevents uncontrolled signal states during sensor or network disconnection."
  },
  GRIDLOCK_CONGESTION: {
    title: "Scenario 4: Dynamic Congestion Bottleneck & Dijkstra Reroute",
    problem: "Unexpected severe traffic bottleneck occurs on link JNC-02 -> JNC-04 (delay factor 4.5x), threatening patient transit time.",
    steps: [
      { num: 1, title: "Baseline Route Planning", text: "Original Dijkstra shortest path was planned via JNC-01 -> JNC-02 -> JNC-04 -> JNC-05 (1550m, 111s)." },
      { num: 2, title: "Bottleneck Detection (T+8s)", text: "Live traffic density telemetry detects gridlock on JNC-02 -> JNC-04 link, inflating transit delay by +110s." },
      { num: 3, title: "Dynamic Travel-Time Dijkstra Execution", text: "Graph engine re-evaluates weighted edges using travel-time cost: (distance / velocity) * congestion_multiplier." },
      { num: 4, title: "Diversion via Ring Road Flyover", text: "Vehicle dynamically reroutes via JNC-03 (1600m), reducing overall transit time by 48 seconds compared to congested path." }
    ],
    safetyNote: "Transparent decision support: decision rationale is recorded in immutable audit log."
  }
};

const SCENARIOS = [
  {
    id: 'STANDARD_CORRIDOR',
    name: 'Standard Green Corridor',
    icon: Activity,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    desc: 'AMB-01 travels JNC-01 -> JNC-05. Evaluates sequential 250m approach triggers, 2s all-red clearance, and automatic signal reversion.'
  },
  {
    id: 'MULTI_AMBULANCE_CONFLICT',
    name: 'Multi-Ambulance Priority Contention',
    icon: GitFork,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    desc: 'AMB-01 (Critical) & AMB-02 (Urgent) converge on JNC-02 simultaneously. Enforces non-preemption and safe clearance transition.'
  },
  {
    id: 'COMM_LOSS_FAILSAFE',
    name: 'Communication Loss Failsafe',
    icon: WifiOff,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    desc: 'Gateway heartbeat lost on JNC-03 mid-transit. Demonstrates autonomous failsafe all-red signal state and watchdog recovery.'
  },
  {
    id: 'GRIDLOCK_CONGESTION',
    name: 'Dynamic Congestion & Rerouting',
    icon: Layers,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    desc: 'Bottleneck occurs on link JNC-02 -> JNC-04. Dijkstra shortest path engine triggers dynamic reroute via JNC-03.'
  }
];

export default function ScenarioLab({ simulationStatus, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const [showNarrative, setShowNarrative] = useState(true);
  const activeScenarioId = simulationStatus?.active_scenario || 'STANDARD_CORRIDOR';
  const currentNarrative = SCENARIO_NARRATIVES[activeScenarioId] || SCENARIO_NARRATIVES.STANDARD_CORRIDOR;
  const simState = simulationStatus?.state || 'STOPPED';
  const speed = simulationStatus?.speed_multiplier || 1.0;
  const elapsed = simulationStatus?.elapsed_seconds || 0.0;

  const handleStart = async (scenarioId) => {
    try {
      setLoading(true);
      await opsService.startSimulation(scenarioId, speed);
      onRefresh();
    } catch (err) {
      alert(`Simulation start error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      setLoading(true);
      await opsService.pauseSimulation();
      onRefresh();
    } catch (err) {
      alert(`Simulation pause error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setLoading(true);
      await opsService.resumeSimulation();
      onRefresh();
    } catch (err) {
      alert(`Simulation resume error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      setLoading(true);
      await opsService.resetSimulation();
      onRefresh();
    } catch (err) {
      alert(`Simulation reset error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeed = async (newSpeed) => {
    try {
      setLoading(true);
      await opsService.setSimulationSpeed(newSpeed);
      onRefresh();
    } catch (err) {
      alert(`Speed change error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStep = async (dt = 2.0) => {
    try {
      setLoading(true);
      await opsService.stepSimulation(dt);
      onRefresh();
    } catch (err) {
      alert(`Step error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-command-panel border border-command-border rounded-xl p-5 shadow-command-card space-y-5">
      {/* Header and Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-command-border">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
            <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wider">
              Emergency Operations Scenario Lab
            </h3>
          </div>
          <p className="text-xs text-command-subtext mt-0.5">
            Authoritative municipal traffic preemption simulator &amp; deterministic event engine
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Badge */}
          <div className="px-3 py-1.5 bg-command-surface border border-command-border rounded-lg text-xs font-mono flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${
              simState === 'RUNNING' ? 'bg-emerald-400 animate-ping' :
              simState === 'PAUSED' ? 'bg-amber-400' :
              simState === 'COMPLETED' ? 'bg-sky-400' : 'bg-slate-500'
            }`}></span>
            <span className="text-command-muted">State:</span>
            <span className="font-bold text-slate-100">{simState}</span>
            <span className="text-command-muted">|</span>
            <span className="text-sky-400 font-bold">T+{elapsed}s</span>
          </div>

          {/* Action Buttons */}
          {simState === 'RUNNING' ? (
            <button 
              disabled={loading}
              onClick={handlePause}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause</span>
            </button>
          ) : simState === 'PAUSED' ? (
            <button 
              disabled={loading}
              onClick={handleResume}
              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume</span>
            </button>
          ) : null}

          {/* Step Button */}
          <button 
            disabled={loading}
            onClick={() => handleStep(2.0)}
            title="Advance deterministic simulation by 2 seconds"
            className="px-2.5 py-1.5 bg-command-surface hover:bg-command-border text-slate-200 border border-command-border rounded-lg text-xs font-mono flex items-center space-x-1 transition disabled:opacity-50"
          >
            <SkipForward className="w-3.5 h-3.5 text-sky-400" />
            <span>+2s Step</span>
          </button>

          {/* Reset Button */}
          <button 
            disabled={loading}
            onClick={handleReset}
            className="px-2.5 py-1.5 bg-command-surface hover:bg-command-border text-command-muted hover:text-rose-400 border border-command-border rounded-lg text-xs flex items-center space-x-1 transition disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center bg-command-surface border border-command-border rounded-lg p-0.5 text-xs font-mono">
            {[1.0, 2.0, 5.0].map((s) => (
              <button
                key={s}
                onClick={() => handleSpeed(s)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                  speed === s ? 'bg-sky-600 text-white shadow-xs' : 'text-command-muted hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preset Scenario Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SCENARIOS.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenarioId === sc.id && simState !== 'STOPPED';

          return (
            <div 
              key={sc.id}
              className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                isActive 
                  ? 'bg-command-surface border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.15)] ring-1 ring-sky-500/50' 
                  : 'bg-command-surface/50 border-command-border hover:border-command-border/90'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`p-2 rounded-lg ${sc.bg} ${sc.color} ${sc.border} border`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {isActive && (
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-mono font-bold flex items-center space-x-1 border border-sky-500/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping"></span>
                      <span>ACTIVE</span>
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-xs text-slate-100 mb-1">{sc.name}</h4>
                <p className="text-[11px] text-command-subtext leading-relaxed">{sc.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-command-border/50">
                <button
                  disabled={loading}
                  onClick={() => handleStart(sc.id)}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-1.5 ${
                    isActive 
                      ? 'bg-sky-600 text-white hover:bg-sky-500 shadow-sm' 
                      : 'bg-command-surface hover:bg-command-border text-slate-200 border border-command-border'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isActive ? 'Restart Scenario' : 'Execute Scenario'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guided Demonstration & Scenario Analysis Panel */}
      {currentNarrative && (
        <div className="bg-command-surface/80 border border-command-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <h4 className="font-bold text-xs text-slate-100 tracking-wide">
                Demonstration Guide: {currentNarrative.title}
              </h4>
              <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 text-[10px] font-mono font-bold border border-sky-500/30">
                Viva &amp; Demo Script
              </span>
            </div>

            <button
              onClick={() => setShowNarrative(!showNarrative)}
              className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center space-x-1 transition"
            >
              <span>{showNarrative ? 'Collapse Guide' : 'Expand Demo Walkthrough'}</span>
              {showNarrative ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showNarrative && (
            <div className="space-y-3 pt-2 border-t border-command-border/50 text-xs">
              <div className="p-3 bg-command-panel rounded-lg border border-command-border text-command-subtext">
                <span className="font-bold text-slate-200 font-mono uppercase text-[10px] block mb-1">
                  Operational Problem Under Test
                </span>
                {currentNarrative.problem}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                {currentNarrative.steps.map((st) => (
                  <div key={st.num} className="p-2.5 bg-command-panel rounded-lg border border-command-border space-y-1">
                    <div className="flex items-center space-x-1.5 font-mono text-[10px] text-sky-400 font-bold">
                      <span className="w-4 h-4 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-[10px]">
                        {st.num}
                      </span>
                      <span>{st.title}</span>
                    </div>
                    <p className="text-[11px] text-command-subtext leading-relaxed">
                      {st.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 flex items-center justify-between font-mono">
                <span className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Safety Verification: {currentNarrative.safetyNote}</span>
                </span>
                <span className="text-[10px] text-command-muted">Deterministic Rule Engine</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
