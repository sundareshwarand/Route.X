import React, { useState } from 'react';
import { 
  Terminal, 
  Radio, 
  Send, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowUp, 
  ArrowRight, 
  Activity, 
  Cpu, 
  RefreshCw, 
  Zap,
  Trash2,
  HardDrive
} from 'lucide-react';
import { opsService } from '../services/api';

export default function DiagnosticsTesting({ onRefresh }) {
  const [ambulanceId, setAmbulanceId] = useState('AMB-01');
  const [junctionId, setJunctionId] = useState('JNC-01');
  const [direction, setDirection] = useState('STRAIGHT');
  const [seqNumber, setSeqNumber] = useState(101);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (tag, data) => {
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      tag,
      data
    };
    setLogs(prev => [entry, ...prev.slice(0, 30)]);
  };

  // 1. Simulate ESP32 LoRa Packet
  const handleTransmitLoRa = async (dir) => {
    const chosenDir = dir || direction;
    try {
      setLoading(true);
      const uuid = 'sim-' + Math.random().toString(36).substring(2, 9);
      const payload = {
        ver: 1,
        id: uuid,
        amb: ambulanceId,
        dir: chosenDir,
        seq: seqNumber,
        ts: Date.now(),
        junction_id: junctionId,
        rssi: -68,
        snr: 8.5,
        crc_valid: true,
        is_hardware_verified: false
      };
      addLog('TX_LORA_PACKET', payload);
      const res = await opsService.simulateLoRaEvent(payload);
      addLog('RX_SERVER_RESP', res);
      setSeqNumber(prev => prev + 1);
      onRefresh();
    } catch (err) {
      addLog('ERROR_LORA_TX', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Simulate NodeMCU Poll
  const handlePollPending = async () => {
    try {
      setLoading(true);
      addLog('POLL_NODE_MCU', { junction_id: junctionId });
      const res = await opsService.pollPendingCommand(junctionId);
      addLog('RESP_NODE_MCU_POLL', res);
      onRefresh();
    } catch (err) {
      addLog('ERROR_POLL', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Simulate NodeMCU ACK Priority Active
  const handleAckPriority = async (reqId) => {
    try {
      setLoading(true);
      const payload = {
        request_id: reqId || 'sim-active-req',
        junction_id: junctionId,
        status: 'PRIORITY_ACTIVE',
        signal_state: 'PRIORITY_ACTIVE',
        active_direction: direction,
        execution_notes: 'Prototype LED outputs driven to Priority Green',
        is_hardware_verified: false
      };
      addLog('ACK_SIGNAL_PRIORITY', payload);
      const res = await opsService.acknowledgeCommand(payload);
      addLog('RESP_ACK_PRIORITY', res);
      onRefresh();
    } catch (err) {
      addLog('ERROR_ACK', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Simulate Safe Reversion
  const handleAckRevert = async (reqId) => {
    try {
      setLoading(true);
      const payload = {
        request_id: reqId || 'sim-active-req',
        junction_id: junctionId,
        status: 'COMPLETED',
        signal_state: 'NORMAL_CYCLE',
        is_hardware_verified: false
      };
      addLog('REVERT_SAFE_CYCLE', payload);
      const res = await opsService.acknowledgeCommand(payload);
      addLog('RESP_REVERT_SAFE', res);
      onRefresh();
    } catch (err) {
      addLog('ERROR_REVERT', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Simulate Gateway Heartbeat
  const handleSendHeartbeat = async () => {
    try {
      setLoading(true);
      const payload = {
        hardware_id: `ESP8266-${junctionId}`,
        junction_id: junctionId,
        ip_address: '192.168.1.188',
        free_heap: 27400,
        uptime_seconds: 4800,
        wifi_rssi: -58,
        firmware_version: '1.0.0-PROTOTYPE'
      };
      addLog('TX_GATEWAY_HEARTBEAT', payload);
      const res = await opsService.sendHeartbeat(payload);
      addLog('RESP_HEARTBEAT', res);
      onRefresh();
    } catch (err) {
      addLog('ERROR_HEARTBEAT', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-command-panel border border-command-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-command-subtle">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-command-text tracking-tight">Virtual Hardware & Diagnostics Laboratory</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
              RF PROTOCOL TEST BENCH
            </span>
          </div>
          <p className="text-xs text-command-subtext">
            Simulate physical LoRa button packet transmissions and NodeMCU traffic gateway state machines.
          </p>
        </div>
        <span className="px-3 py-1 bg-command-surface border border-command-border rounded-lg text-xs font-mono text-emerald-400 font-semibold flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>TEST HARNESS ARMED</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Virtual Transmitters */}
        <div className="space-y-6">
          {/* Virtual ESP32 Card */}
          <div className="bg-command-panel border border-command-border rounded-xl p-5 space-y-4 shadow-command-subtle">
            <div className="flex items-center space-x-2 pb-3 border-b border-command-border">
              <Radio className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-sm text-command-text tracking-tight">Virtual ESP32 In-Vehicle Transmitter</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-command-muted block mb-1">Vehicle Unit</label>
                <select 
                  value={ambulanceId}
                  onChange={(e) => setAmbulanceId(e.target.value)}
                  className="w-full bg-command-surface border border-command-border rounded-lg p-2 font-mono text-command-text text-xs focus:outline-none focus:border-sky-500 transition"
                >
                  <option value="AMB-01">AMB-01 (MEDIC-101)</option>
                  <option value="AMB-02">AMB-02 (RESCUE-202)</option>
                  <option value="AMB-03">AMB-03 (PARAMEDIC-303)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-command-muted block mb-1">Target Controller</label>
                <select 
                  value={junctionId}
                  onChange={(e) => setJunctionId(e.target.value)}
                  className="w-full bg-command-surface border border-command-border rounded-lg p-2 font-mono text-command-text text-xs focus:outline-none focus:border-sky-500 transition"
                >
                  <option value="JNC-01">JNC-01 (Central Avenue)</option>
                  <option value="JNC-02">JNC-02 (Hospital Way)</option>
                  <option value="JNC-03">JNC-03 (Ring Road Flyover)</option>
                  <option value="JNC-04">JNC-04 (Tech Blvd Crossing)</option>
                  <option value="JNC-05">JNC-05 (Trauma Corridor)</option>
                </select>
              </div>
            </div>

            {/* 3 Physical Hardware Push Buttons */}
            <div>
              <label className="text-[10px] font-mono uppercase text-command-muted block mb-2 font-bold tracking-wider">
                Simulate 3-Button Dashboard Input:
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  disabled={loading}
                  onClick={() => handleTransmitLoRa('LEFT')}
                  className="p-4 bg-command-surface hover:bg-slate-800 border-2 border-command-border hover:border-sky-400 rounded-xl flex flex-col items-center justify-center space-y-2 group transition shadow-command-subtle disabled:opacity-50"
                >
                  <ArrowLeft className="w-5 h-5 text-sky-400 group-hover:-translate-x-1 transition" />
                  <span className="font-mono font-bold text-xs text-command-text">LEFT</span>
                  <span className="text-[9px] text-command-muted font-mono">Lane A</span>
                </button>

                <button 
                  disabled={loading}
                  onClick={() => handleTransmitLoRa('STRAIGHT')}
                  className="p-4 bg-command-surface hover:bg-slate-800 border-2 border-command-border hover:border-sky-400 rounded-xl flex flex-col items-center justify-center space-y-2 group transition shadow-command-subtle disabled:opacity-50"
                >
                  <ArrowUp className="w-5 h-5 text-sky-400 group-hover:-translate-y-1 transition" />
                  <span className="font-mono font-bold text-xs text-command-text">STRAIGHT</span>
                  <span className="text-[9px] text-command-muted font-mono">Main Arterial</span>
                </button>

                <button 
                  disabled={loading}
                  onClick={() => handleTransmitLoRa('RIGHT')}
                  className="p-4 bg-command-surface hover:bg-slate-800 border-2 border-command-border hover:border-sky-400 rounded-xl flex flex-col items-center justify-center space-y-2 group transition shadow-command-subtle disabled:opacity-50"
                >
                  <ArrowRight className="w-5 h-5 text-sky-400 group-hover:translate-x-1 transition" />
                  <span className="font-mono font-bold text-xs text-command-text">RIGHT</span>
                  <span className="text-[9px] text-command-muted font-mono">Lane B</span>
                </button>
              </div>
            </div>
          </div>

          {/* Virtual NodeMCU Gateway */}
          <div className="bg-command-panel border border-command-border rounded-xl p-5 space-y-4 shadow-command-subtle">
            <div className="flex items-center space-x-2 pb-3 border-b border-command-border">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-command-text tracking-tight">Virtual NodeMCU ESP8266 Gateway Emulator</h3>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button 
                disabled={loading}
                onClick={handlePollPending}
                className="px-3 py-2 bg-command-surface hover:bg-command-border border border-command-border rounded-lg text-xs font-mono font-medium text-command-text transition disabled:opacity-50"
              >
                1. Poll Pending Queue
              </button>

              <button 
                disabled={loading}
                onClick={() => handleAckPriority()}
                className="px-3 py-2 bg-command-red/10 border border-command-red/30 hover:bg-command-red/20 text-command-red rounded-lg text-xs font-mono font-semibold transition disabled:opacity-50"
              >
                2. ACK Priority Active
              </button>

              <button 
                disabled={loading}
                onClick={() => handleAckRevert()}
                className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-mono font-semibold transition disabled:opacity-50"
              >
                3. ACK Safe Reversion
              </button>

              <button 
                disabled={loading}
                onClick={handleSendHeartbeat}
                className="px-3 py-2 bg-command-surface hover:bg-command-border border border-command-border rounded-lg text-xs font-mono font-medium text-sky-400 transition disabled:opacity-50"
              >
                Send Heartbeat Ping
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry Console */}
        <div className="bg-command-panel border border-command-border rounded-xl p-5 flex flex-col h-[530px] shadow-command-subtle">
          <div className="flex items-center justify-between pb-3 border-b border-command-border mb-3">
            <div className="flex items-center space-x-2 text-xs font-bold font-mono text-command-text">
              <Terminal className="w-4 h-4 text-sky-400" />
              <span>RF PACKET STREAM & STATE TRACE</span>
            </div>
            <button 
              onClick={() => setLogs([])}
              className="text-[11px] font-mono text-command-muted hover:text-command-text flex items-center space-x-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>CLEAR</span>
            </button>
          </div>

          <div className="flex-1 bg-command-bg rounded-lg p-3 font-mono text-[11px] overflow-y-auto space-y-2.5 border border-command-border/50">
            {logs.length === 0 ? (
              <div className="text-command-muted py-16 text-center text-xs space-y-2">
                <HardDrive className="w-6 h-6 mx-auto text-command-muted/50" />
                <p>Telemetry stream idle.</p>
                <p className="text-[10px]">Trigger buttons on the left to inject LoRa RF packets and poll gateway state machines.</p>
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="border-b border-command-surface/60 pb-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-sky-400 font-bold bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">{log.tag}</span>
                    <span className="text-command-muted">{log.time}</span>
                  </div>
                  <pre className="text-command-subtext text-[10px] overflow-x-auto whitespace-pre-wrap leading-relaxed bg-command-surface/50 p-2 rounded">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
