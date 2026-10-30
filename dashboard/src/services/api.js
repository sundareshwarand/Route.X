import axios from 'axios';

export const DEFAULT_CLOUD_API_URL = import.meta.env.VITE_API_BASE_URL || 'https://routex-api.onrender.com/api';

export const normalizeApiUrl = (url) => {
  if (!url) return '';
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned.endsWith('/api')) {
    cleaned = `${cleaned}/api`;
  }
  return cleaned;
};

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // In Capacitor Android app, check if we're on mobile
    const isCapacitor = !!(window.Capacitor || (window.location.protocol === 'https:' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')));

    const saved = localStorage.getItem('ROUTEX_API_URL');
    if (saved && saved.trim()) {
      const normalizedSaved = normalizeApiUrl(saved);
      // On mobile APK, discard any stale localhost/127.0.0.1 left from prior sessions
      if (isCapacitor && (normalizedSaved.includes('localhost') || normalizedSaved.includes('127.0.0.1'))) {
        localStorage.removeItem('ROUTEX_API_URL');
      } else {
        return normalizedSaved;
      }
    }

    const envBase = import.meta.env.VITE_API_BASE_URL;
    if (envBase && envBase.trim()) return normalizeApiUrl(envBase);

    // In Capacitor Android app, default to public cloud endpoint instead of local loopback
    if (isCapacitor) {
      return DEFAULT_CLOUD_API_URL;
    }

    const hostname = window.location.hostname || 'localhost';
    const isHttps = window.location.protocol === 'https:';
    if (isHttps && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // If served on static hosting (e.g. Render static site, Vercel, Netlify, GitHub Pages),
      // point to the cloud API endpoint instead of the static CDN origin
      if (
        hostname.includes('dashboard') ||
        hostname.includes('frontend') ||
        hostname.includes('github.io') ||
        hostname.includes('vercel.app') ||
        hostname.includes('netlify.app') ||
        hostname.includes('pages.dev') ||
        (hostname.endsWith('.onrender.com') && !hostname.includes('routex-api') && !hostname.includes('routex-backend'))
      ) {
        return DEFAULT_CLOUD_API_URL;
      }
      return `${window.location.origin}/api`;
    }
    return `http://${hostname}:8000/api`;
  }
  return normalizeApiUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_CLOUD_API_URL);
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
  timeout: 15000, // 15-second timeout for mobile/cloud networks
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

export const formatAuthError = (err) => {
  if (!err) return 'Unknown authentication error.';

  // 1. Timeout / abort
  if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
    return 'RouteX server is unavailable or starting. Please try again.';
  }

  // 2. Network / DNS / unreachable (no HTTP response received)
  if (!err.response) {
    return 'Cannot connect to the RouteX server.';
  }

  const status = err.response.status;

  // 3. Invalid credentials
  if (status === 401) {
    return 'Invalid email or password.';
  }

  // 4. Inactive account
  if (status === 400 && typeof err.response.data?.detail === 'string' && err.response.data.detail.toLowerCase().includes('inactive')) {
    return 'User account is inactive. Please contact system administrator.';
  }

  // 5. HTTP 404
  if (status === 404) {
    return `RouteX endpoint not found (HTTP 404). Check configured URL at ${getBaseUrl()}`;
  }

  // 6. HTTP 422
  if (status === 422) {
    const details = Array.isArray(err.response.data?.detail)
      ? err.response.data.detail.map(d => d.msg || `${d.loc?.join('.')}: invalid`).join(', ')
      : (err.response.data?.detail || 'Invalid request format');
    return `Request validation error (HTTP 422): ${details}`;
  }

  // 7. HTTP 500 / 502 / 503 / 504
  if (status >= 500) {
    const reqId = err.response.headers?.['x-request-id'] || 'srv';
    if (status === 502 || status === 503 || status === 504) {
      return 'RouteX server is unavailable or starting. Please try again.';
    }
    return `RouteX server error (HTTP ${status}) [Ref: ${reqId}]. Please try again later.`;
  }

  // Explicit detail from backend if present
  if (typeof err.response.data?.detail === 'string') {
    return err.response.data.detail;
  }

  return 'Cannot connect to the RouteX server.';
};

export const authService = {
  testEndpoint: async (targetUrl) => {
    const cleanUrl = normalizeApiUrl(targetUrl || getBaseUrl());
    const healthUrl = cleanUrl.endsWith('/api')
      ? `${cleanUrl.slice(0, -4)}/health`
      : `${cleanUrl}/health`;

    const startTime = Date.now();
    try {
      const res = await axios.get(healthUrl, { timeout: 8000 });
      const latencyMs = Date.now() - startTime;
      return {
        ok: true,
        status: res.status,
        latencyMs,
        data: res.data
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      let errorCategory = 'Cannot connect';
      if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
        errorCategory = 'Timeout / Starting';
      } else if (err.response) {
        errorCategory = `HTTP ${err.response.status}`;
      } else if (err.message) {
        errorCategory = err.message;
      }
      return {
        ok: false,
        latencyMs,
        error: errorCategory,
        status: err.response?.status || 0
      };
    }
  },

  login: async (username, password) => {
    // Email addresses are trimmed and normalized case-insensitively
    const cleanUsername = (username || '').trim().toLowerCase();
    // Passwords must not be modified by normalization
    const rawPassword = password || '';

    try {
      // Primary: standard URLSearchParams encoding for OAuth2 form specification
      const params = new URLSearchParams();
      params.append('username', cleanUsername);
      params.append('password', rawPassword);
      
      const res = await api.post('/auth/login', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (res.data?.access_token) {
        localStorage.setItem('ROUTEX_TOKEN', res.data.access_token);
        localStorage.setItem('ROUTEX_USER', JSON.stringify(res.data.user));
      }
      return res.data;
    } catch (err) {
      // If server returned 401 Unauthorized or 400 Inactive, re-throw immediately
      if (err.response && (err.response.status === 401 || err.response.status === 400)) {
        throw err;
      }
      // If 422, 415 or form serialization issue occurred, attempt JSON login endpoint
      try {
        const jsonRes = await api.post('/auth/login/json', {
          email: cleanUsername,
          password: rawPassword
        });
        if (jsonRes.data?.access_token) {
          localStorage.setItem('ROUTEX_TOKEN', jsonRes.data.access_token);
          localStorage.setItem('ROUTEX_USER', JSON.stringify(jsonRes.data.user));
        }
        return jsonRes.data;
      } catch (jsonErr) {
        throw jsonErr.response ? jsonErr : err;
      }
    }
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


