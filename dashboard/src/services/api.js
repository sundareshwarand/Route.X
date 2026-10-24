import axios from 'axios';

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ROUTEX_API_URL');
    if (saved) return saved.replace(/\/+$/, '');
    const envBase = import.meta.env.VITE_API_BASE_URL;
    if (envBase) return envBase.replace(/\/+$/, '');
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:8000/api`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
};

export const getWsUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ROUTEX_WS_URL');
    if (saved) return saved;
    const envWs = import.meta.env.VITE_WS_URL;
    if (envWs) return envWs;

    // Dynamically derive WebSocket URL directly from the active API base URL
    try {
      const baseUrl = getBaseUrl();
      const url = new URL(baseUrl);
      const isSecure = url.protocol === 'https:' || url.protocol === 'wss:';
      const wsProtocol = isSecure ? 'wss:' : 'ws:';
      return `${wsProtocol}//${url.host}/ws`;
    } catch {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const hostname = window.location.hostname || 'localhost';
      return `${protocol}//${hostname}:8000/ws`;
    }
  }
  return 'ws://localhost:8000/ws';
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.baseURL = getBaseUrl();
  const token = localStorage.getItem('ROUTEX_TOKEN');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const res = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (res.data.access_token) {
      localStorage.setItem('ROUTEX_TOKEN', res.data.access_token);
      localStorage.setItem('ROUTEX_USER', JSON.stringify(res.data.user));
    }
    return res.data;
  },
  getCurrentUser: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('ROUTEX_TOKEN');
    localStorage.removeItem('ROUTEX_USER');
  }
};

export const opsService = {
  getAnalytics: async () => {
    const res = await api.get('/analytics/summary');
    return res.data;
  },
  exportReport: async () => {
    const res = await api.get('/analytics/export');
    return res.data;
  },
  getJunctions: async () => {
    const res = await api.get('/junctions');
    return res.data;
  },
  getAmbulances: async () => {
    const res = await api.get('/ambulances');
    return res.data;
  },
  updateAmbulanceStatus: async (ambulanceId, status) => {
    const res = await api.patch(`/ambulances/${ambulanceId}/status`, { status });
    return res.data;
  },
  getRequests: async (params = {}) => {
    const res = await api.get('/emergency/requests', { params });
    return res.data;
  },
  createRequest: async (data) => {
    const res = await api.post('/emergency/request', data);
    return res.data;
  },
  cancelRequest: async (requestId, reason) => {
    const res = await api.post(`/emergency/requests/${requestId}/cancel`, { cancellation_reason: reason });
    return res.data;
  },
  completeRequest: async (requestId) => {
    const res = await api.post(`/emergency/requests/${requestId}/complete`);
    return res.data;
  },
  getAlerts: async () => {
    const res = await api.get('/alerts');
    return res.data;
  },
  broadcastTestAlert: async (junctionId, zone, direction) => {
    const res = await api.post(`/alerts/test-broadcast?junction_id=${junctionId}&zone=${zone}&direction=${direction}`);
    return res.data;
  },
  calculateRoute: async (start, destination) => {
    const res = await api.post('/junctions/route/shortest-path', {
      start_junction_id: start,
      destination_junction_id: destination
    });
    return res.data;
  },
  // Hardware test & diagnostics helpers
  simulateLoRaEvent: async (payload) => {
    const res = await api.post('/hardware/event', payload);
    return res.data;
  },
  pollPendingCommand: async (junctionId) => {
    const res = await api.get(`/hardware/pending-commands/${junctionId}`);
    return res.data;
  },
  acknowledgeCommand: async (payload) => {
    const res = await api.post('/hardware/acknowledge', payload);
    return res.data;
  },
  sendHeartbeat: async (payload) => {
    const res = await api.post('/hardware/heartbeat', payload);
    return res.data;
  },
  // Feature Enhancements
  getJunctionQueue: async (junctionId) => {
    const res = await api.get(`/emergency/junction/${junctionId}/queue`);
    return res.data;
  },
  reorderQueue: async (junctionId, requestIds, reason) => {
    const res = await api.post(`/emergency/junction/${junctionId}/queue/reorder`, {
      request_ids: requestIds,
      reason
    });
    return res.data;
  },
  getReliabilitySummary: async () => {
    const res = await api.get('/reliability/summary');
    return res.data;
  },
  getJunctionReliability: async (junctionId) => {
    const res = await api.get(`/reliability/junction/${junctionId}`);
    return res.data;
  },
  getAuditLedger: async () => {
    const res = await api.get('/analytics/audit-ledger');
    return res.data;
  },
  verifyAuditLedger: async () => {
    const res = await api.get('/analytics/audit-ledger/verify');
    return res.data;
  },
  exportAnalyticsCsvUrl: () => {
    return `${getBaseUrl()}/analytics/export/csv`;
  },
  subscribeAlerts: async (clientUuid, zone = 'ZONE-CENTRAL', lat = 28.6139, lon = 77.2090) => {
    const res = await api.post('/alerts/subscribe', {
      client_uuid: clientUuid,
      zone,
      latitude: lat,
      longitude: lon,
      is_simulation: true
    });
    return res.data;
  },
  getAlertDeliveries: async (alertId) => {
    const res = await api.get(`/alerts/${alertId}/deliveries`);
    return res.data;
  },
  checkProximity: async (lat, lon, maxRadius = 1000) => {
    const res = await api.post('/alerts/proximity-check', {
      client_latitude: lat,
      client_longitude: lon,
      max_radius_meters: maxRadius
    });
    return res.data;
  },
  // Authoritative Simulation Engine
  getSimulationStatus: async () => {
    const res = await api.get('/simulation/status');
    return res.data;
  },
  startSimulation: async (scenario = 'STANDARD_CORRIDOR', speedMultiplier = 1.0) => {
    const res = await api.post('/simulation/start', {
      scenario,
      speed_multiplier: speedMultiplier
    });
    return res.data;
  },
  pauseSimulation: async () => {
    const res = await api.post('/simulation/pause');
    return res.data;
  },
  resumeSimulation: async () => {
    const res = await api.post('/simulation/resume');
    return res.data;
  },
  resetSimulation: async () => {
    const res = await api.post('/simulation/reset');
    return res.data;
  },
  setSimulationSpeed: async (speedMultiplier) => {
    const res = await api.post('/simulation/speed', {
      speed_multiplier: speedMultiplier
    });
    return res.data;
  },
  stepSimulation: async (dt = 1.0) => {
    const res = await api.post('/simulation/step', { dt });
    return res.data;
  },
  triggerScenario: async (scenarioName, speedMultiplier = 1.0) => {
    const res = await api.post(`/simulation/scenario/${scenarioName}?speed_multiplier=${speedMultiplier}`);
    return res.data;
  },
  // Hospital and Route Comparison
  getHospitals: async () => {
    const res = await api.get('/hospitals');
    return res.data;
  },
  getHospital: async (hospitalId) => {
    const res = await api.get(`/hospitals/${hospitalId}`);
    return res.data;
  },
  compareRoutes: async (payload) => {
    const res = await api.post('/hospitals/route/compare', payload);
    return res.data;
  }
};

export const aiService = {
  getStatus: async () => {
    try {
      const res = await api.get('/ai/status');
      return res.data;
    } catch (err) {
      return {
        is_configured: false,
        model: 'gemini-2.5-flash',
        provider: 'Google Gemini',
        status_label: 'UNAVAILABLE',
        disclaimer: 'AI advisory module pending backend restart or unconfigured.'
      };
    }
  },
  explainRoute: async (routeData) => {
    const res = await api.post('/ai/explain-route', routeData);
    return res.data;
  },
  getIncidentSummary: async (incidentData) => {
    const res = await api.post('/ai/incident-summary', incidentData);
    return res.data;
  }
};


